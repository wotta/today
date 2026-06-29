<?php

declare(strict_types=1);

namespace App\Domain\Settings;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * Tiny key-value settings store (SQLite `settings` table). The Gist PAT is
 * encrypted at rest with the app key — a step up from the extension, which
 * keeps it in plain chrome.storage.local.
 */
class SettingRepository
{
    private const PAT = 'gist_pat';

    private const GIST_ID = 'gist_id';

    private const ETAG = 'gist_etag';

    private const THEME = 'app_theme';

    private const AGENDA_SLOT_MINUTES = 'agenda_slot_minutes';

    private const S3_ENDPOINT = 's3_endpoint';

    private const S3_BUCKET = 's3_bucket';

    private const S3_REGION = 's3_region';

    private const S3_ACCESS_KEY_ID = 's3_access_key_id';

    private const S3_SECRET_ACCESS_KEY = 's3_secret_access_key';

    private const S3_PUBLIC_BASE_URL = 's3_public_base_url';

    /** @var list<string> */
    private const THEMES = ['light', 'dark', 'auto'];

    /** @var list<int> */
    private const AGENDA_SLOT_MINUTE_VALUES = [60, 30, 15];

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

    /** Agenda UI granularity in minutes: 60 (default), 30, or 15. */
    public function agendaSlotMinutes(): int
    {
        $minutes = (int) ($this->get(self::AGENDA_SLOT_MINUTES) ?? 60);

        return in_array($minutes, self::AGENDA_SLOT_MINUTE_VALUES, true) ? $minutes : 60;
    }

    public function setAgendaSlotMinutes(int $minutes): void
    {
        $this->set(
            self::AGENDA_SLOT_MINUTES,
            (string) (in_array($minutes, self::AGENDA_SLOT_MINUTE_VALUES, true) ? $minutes : 60),
        );
    }

    /** S3/R2 config, or null unless all upload and public serving fields are present. */
    public function s3Config(): ?array
    {
        $endpoint = $this->trimmed(self::S3_ENDPOINT);
        $bucket = trim($this->trimmed(self::S3_BUCKET), '/');
        $region = $this->trimmed(self::S3_REGION) ?: 'auto';
        $accessKeyId = $this->decrypt(self::S3_ACCESS_KEY_ID);
        $secretAccessKey = $this->decrypt(self::S3_SECRET_ACCESS_KEY);
        $publicBaseUrl = $this->trimmed(self::S3_PUBLIC_BASE_URL);

        if ($endpoint === '' || $bucket === '' || $accessKeyId === '' || $secretAccessKey === '' || $publicBaseUrl === '') {
            return null;
        }

        return [
            'endpoint' => rtrim($endpoint, '/'),
            'bucket' => $bucket,
            'region' => $region,
            'accessKeyId' => $accessKeyId,
            'secretAccessKey' => $secretAccessKey,
            'publicBaseUrl' => rtrim($publicBaseUrl, '/'),
        ];
    }

    /** Display values for the Settings form; the secret access key is never returned. */
    public function s3FormConfig(): array
    {
        return [
            'endpoint' => $this->trimmed(self::S3_ENDPOINT),
            'bucket' => $this->trimmed(self::S3_BUCKET),
            'region' => $this->trimmed(self::S3_REGION) ?: 'auto',
            'accessKeyId' => $this->decrypt(self::S3_ACCESS_KEY_ID),
            'publicBaseUrl' => $this->trimmed(self::S3_PUBLIC_BASE_URL),
            'hasSecretAccessKey' => $this->decrypt(self::S3_SECRET_ACCESS_KEY) !== '',
        ];
    }

    /**
     * @param  array{endpoint: string, bucket: string, region?: string, accessKeyId?: string, secretAccessKey?: string, publicBaseUrl: string}  $config
     */
    public function setS3Config(array $config): void
    {
        $this->set(self::S3_ENDPOINT, rtrim(trim($config['endpoint']), '/'));
        $this->set(self::S3_BUCKET, trim($config['bucket'], " \t\n\r\0\x0B/"));
        $this->set(self::S3_REGION, trim((string) ($config['region'] ?? '')) ?: 'auto');
        $this->set(self::S3_PUBLIC_BASE_URL, rtrim(trim($config['publicBaseUrl']), '/'));

        $accessKeyId = trim((string) ($config['accessKeyId'] ?? ''));
        if ($accessKeyId !== '') {
            $this->set(self::S3_ACCESS_KEY_ID, Crypt::encryptString($accessKeyId));
        }

        $secretAccessKey = trim((string) ($config['secretAccessKey'] ?? ''));
        if ($secretAccessKey !== '') {
            $this->set(self::S3_SECRET_ACCESS_KEY, Crypt::encryptString($secretAccessKey));
        }
    }

    public function clearS3Config(): void
    {
        foreach ([self::S3_ENDPOINT, self::S3_BUCKET, self::S3_REGION, self::S3_ACCESS_KEY_ID, self::S3_SECRET_ACCESS_KEY, self::S3_PUBLIC_BASE_URL] as $key) {
            $this->forget($key);
        }
    }

    private function trimmed(string $key): string
    {
        return trim((string) ($this->get($key) ?? ''));
    }

    private function decrypt(string $key): string
    {
        $stored = $this->get($key);

        return $stored ? Crypt::decryptString($stored) : '';
    }
}
