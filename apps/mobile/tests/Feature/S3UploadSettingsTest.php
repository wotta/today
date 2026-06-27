<?php

declare(strict_types=1);

use App\Domain\Settings\SettingRepository;
use App\Domain\Upload\S3UploadService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

function s3Payload(array $overrides = []): array
{
    return [
        'endpoint' => 'https://account.r2.cloudflarestorage.com',
        'bucket' => 'today-uploads',
        'region' => 'auto',
        'accessKeyId' => 'key-id',
        'secretAccessKey' => 'secret-key',
        'publicBaseUrl' => 'https://pub.example.com',
        ...$overrides,
    ];
}

it('stores S3 credentials encrypted and returns a complete config immediately', function () {
    app(SettingRepository::class)->setS3Config(s3Payload());

    $config = app(SettingRepository::class)->s3Config();
    $storedAccessKey = DB::table('settings')->where('key', 's3_access_key_id')->value('value');
    $storedSecret = DB::table('settings')->where('key', 's3_secret_access_key')->value('value');

    expect($config)->toMatchArray([
        'endpoint' => 'https://account.r2.cloudflarestorage.com',
        'bucket' => 'today-uploads',
        'region' => 'auto',
        'accessKeyId' => 'key-id',
        'secretAccessKey' => 'secret-key',
        'publicBaseUrl' => 'https://pub.example.com',
    ])
        ->and($storedAccessKey)->not->toBe('key-id')
        ->and(Crypt::decryptString($storedAccessKey))->toBe('key-id')
        ->and($storedSecret)->not->toBe('secret-key')
        ->and(Crypt::decryptString($storedSecret))->toBe('secret-key');
});

it('saves S3 settings from the settings page and preserves blank secrets on later edits', function () {
    $this->post('/settings/uploads', s3Payload())
        ->assertRedirect()
        ->assertSessionHas('status.message', 'Object storage settings saved.');

    $this->post('/settings/uploads', s3Payload([
        'endpoint' => 'https://new.example.com',
        'accessKeyId' => '',
        'secretAccessKey' => '',
    ]))->assertRedirect();

    expect(app(SettingRepository::class)->s3Config())->toMatchArray([
        'endpoint' => 'https://new.example.com',
        'accessKeyId' => 'key-id',
        'secretAccessKey' => 'secret-key',
    ]);
});

it('disconnects S3 settings', function () {
    app(SettingRepository::class)->setS3Config(s3Payload());

    $this->delete('/settings/uploads')->assertRedirect();

    expect(app(SettingRepository::class)->s3Config())->toBeNull();
});

it('runs the S3 test upload from settings', function () {
    $this->mock(S3UploadService::class)
        ->shouldReceive('testUpload')
        ->once()
        ->andReturn([
            'key' => 'today/test.txt',
            'url' => 'https://pub.example.com/today/test.txt',
            'markdown' => '[test.txt](https://pub.example.com/today/test.txt)',
        ]);

    $this->post('/settings/uploads/test')
        ->assertRedirect()
        ->assertSessionHas('status.message', 'Test upload succeeded: https://pub.example.com/today/test.txt');
});

it('returns a markdown link from the generic upload endpoint', function () {
    $this->mock(S3UploadService::class)
        ->shouldReceive('upload')
        ->once()
        ->with(Mockery::type(UploadedFile::class))
        ->andReturn([
            'key' => 'today/photo.png',
            'url' => 'https://pub.example.com/today/photo.png',
            'markdown' => '![photo.png](https://pub.example.com/today/photo.png)',
        ]);

    $this->postJson('/api/uploads', [
        'file' => UploadedFile::fake()->create('photo.png', 12, 'image/png'),
    ])->assertOk()
        ->assertJson([
            'ok' => true,
            'url' => 'https://pub.example.com/today/photo.png',
            'markdown' => '![photo.png](https://pub.example.com/today/photo.png)',
        ]);
});
