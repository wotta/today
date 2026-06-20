<?php

declare(strict_types=1);

namespace App\Domain;

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
    }
}
