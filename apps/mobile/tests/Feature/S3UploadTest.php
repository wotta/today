<?php

declare(strict_types=1);

use App\Domain\Settings\SettingRepository;
use App\Domain\Upload\S3UploadService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Mockery\MockInterface;

function s3Payload(array $overrides = []): array
{
    return array_merge([
        'endpoint' => 'https://example.r2.cloudflarestorage.com/',
        'bucket' => '/today-bucket/',
        'region' => '',
        'accessKeyId' => 'access-key',
        'secretAccessKey' => 'secret-key',
        'publicBaseUrl' => 'https://cdn.example.com/',
    ], $overrides);
}

it('stores s3 credentials encrypted and normalizes public config', function () {
    $repo = app(SettingRepository::class);

    $repo->setS3Config(s3Payload());

    $storedAccessKey = DB::table('settings')->where('key', 's3_access_key_id')->value('value');
    $storedSecret = DB::table('settings')->where('key', 's3_secret_access_key')->value('value');

    expect($storedAccessKey)->not->toBe('access-key')
        ->and($storedSecret)->not->toBe('secret-key')
        ->and(Crypt::decryptString($storedAccessKey))->toBe('access-key')
        ->and(Crypt::decryptString($storedSecret))->toBe('secret-key')
        ->and($repo->s3Config())->toMatchArray([
            'endpoint' => 'https://example.r2.cloudflarestorage.com',
            'bucket' => 'today-bucket',
            'region' => 'auto',
            'accessKeyId' => 'access-key',
            'secretAccessKey' => 'secret-key',
            'publicBaseUrl' => 'https://cdn.example.com',
        ]);
});

it('saves config before running the settings test upload', function () {
    $this->mock(S3UploadService::class, function (MockInterface $mock) {
        $mock->shouldReceive('testUpload')->once()->andReturn([
            'key' => 'today/test.txt',
            'url' => 'https://cdn.example.com/today/test.txt',
            'markdown' => '[today-upload-test.txt](https://cdn.example.com/today/test.txt)',
        ]);
    });

    $this->from('/settings')
        ->post('/settings/s3/test', s3Payload())
        ->assertRedirect('/settings')
        ->assertSessionHas('s3_status.kind', 'tested');

    expect(app(SettingRepository::class)->s3Config())->toMatchArray([
        'endpoint' => 'https://example.r2.cloudflarestorage.com',
        'bucket' => 'today-bucket',
        'region' => 'auto',
    ]);
});

it('uploads files through the json upload endpoint', function () {
    $this->mock(S3UploadService::class, function (MockInterface $mock) {
        $mock->shouldReceive('upload')
            ->once()
            ->with(Mockery::type(UploadedFile::class))
            ->andReturn([
                'key' => 'today/photo.png',
                'url' => 'https://cdn.example.com/today/photo.png',
                'markdown' => '![photo.png](https://cdn.example.com/today/photo.png)',
            ]);
    });

    $this->postJson('/api/uploads', [
        'file' => UploadedFile::fake()->image('photo.png'),
    ])->assertOk()
        ->assertJson([
            'ok' => true,
            'url' => 'https://cdn.example.com/today/photo.png',
            'markdown' => '![photo.png](https://cdn.example.com/today/photo.png)',
        ]);
});

it('builds an on demand s3 disk from saved user settings', function () {
    app(SettingRepository::class)->setS3Config(s3Payload(['region' => 'us-east-1']));

    $disk = Mockery::mock();
    $disk->shouldReceive('put')
        ->once()
        ->with(
            Mockery::pattern('/^today\/[0-9a-f-]+-today-upload-test\.txt$/'),
            'today upload test',
            Mockery::on(fn (array $options) => $options['visibility'] === 'public' && $options['ContentType'] === 'text/plain'),
        );

    Storage::shouldReceive('build')
        ->once()
        ->with(Mockery::on(fn (array $config) => $config['driver'] === 's3'
            && $config['key'] === 'access-key'
            && $config['secret'] === 'secret-key'
            && $config['region'] === 'us-east-1'
            && $config['bucket'] === 'today-bucket'
            && $config['endpoint'] === 'https://example.r2.cloudflarestorage.com'
            && $config['use_path_style_endpoint'] === true
            && $config['throw'] === true))
        ->andReturn($disk);

    $result = app(S3UploadService::class)->testUpload();

    expect($result['url'])->toStartWith('https://cdn.example.com/today/')
        ->and($result['markdown'])->toStartWith('[today-upload-test.txt](https://cdn.example.com/today/');
});
