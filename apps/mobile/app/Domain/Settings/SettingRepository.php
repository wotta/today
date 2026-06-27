<?php

declare(strict_types=1);

namespace App\Domain\Settings;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * Tiny key-value settings store (SQLite `settings` table). User credentials
 * are encrypted at rest with the app key — a step up from the extension,
 * which keeps them in plain chrome.storage.local.
 */
class SettingRepository
{
    private const PAT = 'gist_pat';

    private const GIST_ID = 'gist_id';

    private const ETAG = 'gist_etag';

    private const THEME = 'app_theme';

    private const S3_ENDPOINT = 's3_endpoint';

    private const S3_BUCKET = 's3_bucket';

    private const S3_REGION = 's3_region';

    private const S3_ACCESS_KEY_ID = 's3_access_key_id';

    private const S3_SECRET_ACCESS_KEY = 's3_secret_access_key';

    private const S3_PUBLIC_BASE_URL = 's3_public_base_url';

    /** @var list<string> */
    private const THEMES = ['light', 'dark', 'auto'];

    public function get(string $key): ?string
    {
        return DB::table('settings')->where('key', $key)->value('value');
    }

    public function set(string $key, ?string $value): void
    {
        DB::table('settings')->updateOrInsert(
            ['key' => $key],
            ['value' => $value, 'updated_at' => now(), 'created_at' => now()],
        );
    }

    public function forget(string $key): void
    {
        DB::table('settings')->where('key', $key)->delete();
    }

    /** Gist config, or null unless BOTH a PAT and gist id are present. */
    public function gistConfig(): ?array
    {
        $stored = $this->get(self::PAT);
        $pat = $stored ? Crypt::decryptString($stored) : '';
        $gistId = (string) ($this->get(self::GIST_ID) ?? '');

        if ($pat === '' || $gistId === '') {
            return null;
        }

        return ['pat' => $pat, 'gistId' => $gistId];
    }

    public function setGistConfig(string $pat, string $gistId): void
    {
        $this->set(self::PAT, Crypt::encryptString(trim($pat)));
        $this->set(self::GIST_ID, trim($gistId));
    }

    public function clearGistConfig(): void
    {
        $this->forget(self::PAT);
        $this->forget(self::GIST_ID);
        $this->forget(self::ETAG);
    }

    /** Cached gist ETag for conditional GETs; null until a pull has run. */
    public function gistEtag(): ?string
    {
        return $this->get(self::ETAG);
    }

    public function setGistEtag(?string $etag): void
    {
        $this->set(self::ETAG, $etag);
    }

    /**
     * Appearance: 'light' | 'dark' | 'auto'. Stored server-side so the choice
     * survives an app restart — the mobile web view may wipe localStorage.
     */
    public function theme(): string
    {
        $theme = $this->get(self::THEME);

        return in_array($theme, self::THEMES, true) ? $theme : 'auto';
    }

    public function setTheme(string $theme): void
    {
        $this->set(self::THEME, in_array($theme, self::THEMES, true) ? $theme : 'auto');
    }

    /** S3/R2 config, or null unless every upload + public-link field is present. */
    public function s3Config(): ?array
    {
        $endpoint = $this->stripTrailingSlash((string) ($this->get(self::S3_ENDPOINT) ?? ''));
        $bucket = trim((string) ($this->get(self::S3_BUCKET) ?? ''), " \t\n\r\0\x0B/");
        $region = trim((string) ($this->get(self::S3_REGION) ?? '')) ?: 'auto';
        $accessKeyId = $this->decryptSetting(self::S3_ACCESS_KEY_ID);
        $secretAccessKey = $this->decryptSetting(self::S3_SECRET_ACCESS_KEY);
        $publicBaseUrl = $this->stripTrailingSlash((string) ($this->get(self::S3_PUBLIC_BASE_URL) ?? ''));

        if ($endpoint === '' || $bucket === '' || $accessKeyId === '' || $secretAccessKey === '' || $publicBaseUrl === '') {
            return null;
        }

        return [
            'endpoint' => $endpoint,
            'bucket' => $bucket,
            'region' => $region,
            'accessKeyId' => $accessKeyId,
            'secretAccessKey' => $secretAccessKey,
            'publicBaseUrl' => $publicBaseUrl,
        ];
    }

    /** @param array{endpoint:string,bucket:string,region?:string,accessKeyId:string,secretAccessKey:string,publicBaseUrl:string} $config */
    public function setS3Config(array $config): void
    {
        $this->set(self::S3_ENDPOINT, $this->stripTrailingSlash($config['endpoint']));
        $this->set(self::S3_BUCKET, trim($config['bucket'], " \t\n\r\0\x0B/"));
        $this->set(self::S3_REGION, trim($config['region'] ?? '') ?: 'auto');
        $this->set(self::S3_ACCESS_KEY_ID, Crypt::encryptString(trim($config['accessKeyId'])));
        $this->set(self::S3_SECRET_ACCESS_KEY, Crypt::encryptString(trim($config['secretAccessKey'])));
        $this->set(self::S3_PUBLIC_BASE_URL, $this->stripTrailingSlash($config['publicBaseUrl']));
    }

    public function clearS3Config(): void
    {
        $this->forget(self::S3_ENDPOINT);
        $this->forget(self::S3_BUCKET);
        $this->forget(self::S3_REGION);
        $this->forget(self::S3_ACCESS_KEY_ID);
        $this->forget(self::S3_SECRET_ACCESS_KEY);
        $this->forget(self::S3_PUBLIC_BASE_URL);
    }

    private function decryptSetting(string $key): string
    {
        $stored = $this->get($key);

        return $stored ? trim(Crypt::decryptString($stored)) : '';
    }

    private function stripTrailingSlash(string $value): string
    {
        return rtrim(trim($value), '/');
    }
}
