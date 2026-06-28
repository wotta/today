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

    private const AGENDA_GRANULARITY = 'agenda_granularity';

    /** @var list<string> */
    private const THEMES = ['light', 'dark', 'auto'];

    /** @var list<int> */
    private const AGENDA_GRANULARITIES = [60, 30, 15];

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

    public function agendaGranularity(): int
    {
        $granularity = (int) ($this->get(self::AGENDA_GRANULARITY) ?? 60);

        return in_array($granularity, self::AGENDA_GRANULARITIES, true) ? $granularity : 60;
    }

    public function setAgendaGranularity(int $minutes): void
    {
        $this->set(
            self::AGENDA_GRANULARITY,
            (string) (in_array($minutes, self::AGENDA_GRANULARITIES, true) ? $minutes : 60),
        );
    }
}
