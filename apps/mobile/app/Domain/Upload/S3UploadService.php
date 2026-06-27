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

    public function configured(): bool
    {
        return $this->settings->s3Config() !== null;
    }

    /** @return array{key:string,url:string,markdown:string} */
    public function upload(UploadedFile $file): array
    {
        $path = $file->getRealPath();
        if ($path === false) {
            throw new RuntimeException('Could not read the uploaded file.');
        }

        $stream = fopen($path, 'rb');
        if ($stream === false) {
            throw new RuntimeException('Could not read the uploaded file.');
        }

        try {
            return $this->put(
                $file->getClientOriginalName() ?: 'file',
                $stream,
                $file->getMimeType() ?: 'application/octet-stream',
            );
        } finally {
            fclose($stream);
        }
    }

    /** @return array{key:string,url:string,markdown:string} */
    public function testUpload(): array
    {
        return $this->put('today-upload-test.txt', 'today upload test', 'text/plain');
    }

    /** @param resource|string $contents */
    private function put(string $filename, mixed $contents, string $contentType): array
    {
        $config = $this->settings->s3Config();
        if ($config === null) {
            throw new RuntimeException('S3/R2 uploads are not configured.');
        }

        $key = $this->objectKey($filename);
        Storage::build([
            'driver' => 's3',
            'key' => $config['accessKeyId'],
            'secret' => $config['secretAccessKey'],
            'region' => $config['region'],
            'bucket' => $config['bucket'],
            'endpoint' => $config['endpoint'],
            'use_path_style_endpoint' => true,
            'throw' => true,
        ])->put($key, $contents, [
            'visibility' => 'public',
            'ContentType' => $contentType,
        ]);

        $url = $config['publicBaseUrl'].'/'.$key;

        return [
            'key' => $key,
            'url' => $url,
            'markdown' => $this->markdownFor($filename, $url, $contentType),
        ];
    }

    private function objectKey(string $filename): string
    {
        $safe = preg_replace('/[^a-zA-Z0-9._-]+/', '-', $filename) ?: 'file';
        $safe = trim($safe, '-');
        $safe = substr($safe !== '' ? $safe : 'file', -80);

        return 'today/'.Str::uuid()->toString().'-'.$safe;
    }

    private function markdownFor(string $filename, string $url, string $contentType): string
    {
        $label = trim(str_replace(["\r", "\n", '[', ']'], ' ', $filename)) ?: 'file';

        return str_starts_with($contentType, 'image/') ? "![{$label}]({$url})" : "[{$label}]({$url})";
    }
}
