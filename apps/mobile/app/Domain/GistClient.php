<?php

declare(strict_types=1);

namespace App\Domain;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Today\Core\Day;

/**
 * GitHub Gist storage backend — a PHP port of the extension's gist.ts. A single
 * private gist holds `today-data.json`:
 *   { "version": 1, "exportedAt": ISO, "days": { "YYYY-MM-DD": DayEntry } }
 * The extension, the MCP server and this app all read/write that same envelope,
 * so the data stays shared across devices.
 */
class GistClient
{
    private const API = 'https://api.github.com';
    private const FILE = 'today-data.json';

    private function http(string $pat): PendingRequest
    {
        return Http::withHeaders([
            'Authorization' => "Bearer {$pat}",
            'Accept' => 'application/vnd.github+json',
        ])->timeout(15);
    }

    /** Find a gist already holding today-data.json (also validates the PAT). */
    public function findGistWithData(string $pat): ?string
    {
        $res = $this->http($pat)->get(self::API . '/gists', ['per_page' => 100]);
        $this->guard($res->status());

        foreach ($res->json() as $gist) {
            if (isset($gist['files'][self::FILE])) {
                return $gist['id'];
            }
        }

        return null;
    }

    /** Create a new private gist seeded with an empty envelope; returns its id. */
    public function createGist(string $pat): string
    {
        $seed = ['version' => 1, 'exportedAt' => now()->toIso8601String(), 'days' => (object) []];
        $res = $this->http($pat)->post(self::API . '/gists', [
            'description' => 'Today planner data',
            'public' => false,
            'files' => [self::FILE => ['content' => json_encode($seed, JSON_PRETTY_PRINT)]],
        ]);
        $this->guard($res->status());

        return $res->json('id');
    }

    /** Verify a gist exists and is reachable with this PAT. */
    public function verifyGist(string $pat, string $gistId): void
    {
        $this->guard($this->http($pat)->get(self::API . "/gists/{$gistId}")->status());
    }

    /** @return array<string, array> the full days map from the gist. */
    public function loadDays(string $pat, string $gistId): array
    {
        $res = $this->http($pat)->get(self::API . "/gists/{$gistId}");
        $this->guard($res->status());

        // NB: access via the array, not $res->json('files.today-data.json') —
        // the dot in the filename would be read as a nested key path.
        $file = $res->json('files')[self::FILE] ?? null;
        if (! $file) {
            return [];
        }

        // GitHub truncates large file content; fetch the raw blob if so.
        $text = ($file['truncated'] ?? false) && ! empty($file['raw_url'])
            ? Http::timeout(15)->get($file['raw_url'])->body()
            : ($file['content'] ?? '');

        $parsed = json_decode($text, true);

        return is_array($parsed['days'] ?? null) ? $parsed['days'] : [];
    }

    /** @param array<string, array> $days */
    public function saveDays(string $pat, string $gistId, array $days): void
    {
        $envelope = [
            'version' => 1,
            'exportedAt' => now()->toIso8601String(),
            'days' => $days ?: (object) [],
        ];
        $res = $this->http($pat)->patch(self::API . "/gists/{$gistId}", [
            'files' => [self::FILE => ['content' => json_encode($envelope, JSON_PRETTY_PRINT)]],
        ]);
        $this->guard($res->status());
    }

    /**
     * Write one day into the gist with a read-modify-write, so we don't clobber
     * edits made elsewhere (extension / MCP server share this gist).
     */
    public function putDay(string $pat, string $gistId, Day $day): void
    {
        $days = $this->loadDays($pat, $gistId);

        if ($this->hasContent($day)) {
            $days[$day->date] = $day->toArray();
        } else {
            unset($days[$day->date]);
        }

        $this->saveDays($pat, $gistId, $days);
    }

    private function hasContent(Day $day): bool
    {
        if ($day->checkItems !== []) {
            return true;
        }
        foreach ($day->agenda as $text) {
            if (trim($text) !== '') {
                return true;
            }
        }

        return false;
    }

    private function guard(int $status): void
    {
        if ($status < 200 || $status >= 300) {
            throw GistException::fromStatus($status);
        }
    }
}
