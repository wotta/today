<?php

declare(strict_types=1);

namespace App\Domain\Upload;

use App\Domain\Settings\SettingRepository;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class S3UploadService
{
    public function __construct(private readonly SettingRepository $settings) {}

    /**
     * @return array{key: string, url: string, markdown: string}
     */
    public function upload(UploadedFile $file): array
    {
        $contents = file_get_contents($file->getRealPath());
        if ($contents === false) {
            throw new RuntimeException('Could not read uploaded file.');
        }

        return $this->put($file->getClientOriginalName(), $contents, $file->getMimeType() ?: 'application/octet-stream');
    }

    /**
     * @return array{key: string, url: string, markdown: string}
     */
    public function testUpload(): array
    {
        return $this->put('today-upload-test.txt', 'today upload test', 'text/plain');
    }

    /**
     * @return array{key: string, url: string, markdown: string}
     */
    private function put(string $filename, string $contents, string $contentType): array
    {
        $config = $this->settings->s3Config();
        if ($config === null) {
            throw new RuntimeException('Object storage is not configured.');
        }

        $key = $this->objectKey($filename);
        $disk = Storage::build([
            'driver' => 's3',
            'key' => $config['accessKeyId'],
            'secret' => $config['secretAccessKey'],
            'region' => $config['region'],
            'bucket' => $config['bucket'],
            'endpoint' => $config['endpoint'],
            'use_path_style_endpoint' => true,
            'throw' => true,
        ]);

        $disk->put($key, $contents, [
            'visibility' => 'public',
            'ContentType' => $contentType,
        ]);

        $url = $config['publicBaseUrl'].'/'.$key;

        return [
            'key' => $key,
            'url' => $url,
            'markdown' => $this->markdown($url, $filename, $contentType),
        ];
    }

    private function objectKey(string $filename): string
    {
        $safe = preg_replace('/[^a-zA-Z0-9._-]+/', '-', Str::ascii($filename));
        $safe = trim((string) $safe, '-');
        $safe = substr($safe !== '' ? $safe : 'file', -80);

        return 'today/'.Str::uuid().'-'.$safe;
    }

    private function markdown(string $url, string $filename, string $contentType): string
    {
        $label = trim($filename) !== '' ? trim($filename) : 'file';

        if (str_starts_with($contentType, 'image/')) {
            return "![{$label}]({$url})";
        }

        return "[{$label}]({$url})";
    }
}
