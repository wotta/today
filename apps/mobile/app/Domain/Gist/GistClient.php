<?php

declare(strict_types=1);

namespace App\Domain\Gist;

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
        $res = $this->http($pat)->get(self::API.'/gists', ['per_page' => 100]);
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
        $res = $this->http($pat)->post(self::API.'/gists', [
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
        $this->guard($this->http($pat)->get(self::API."/gists/{$gistId}")->status());
    }

    /** @return array<string, array> the full days map from the gist. */
    public function loadDays(string $pat, string $gistId): array
    {
        return $this->pull($pat, $gistId)['days'];
    }

    /**
     * Conditional read of the gist. When $etag is supplied it is sent as
     * If-None-Match; GitHub answers 304 (notModified) when nothing changed,
     * sparing us the body parse and a rate-limit hit.
     *
     * @return array{notModified: bool, etag: ?string, days: array<string, array>}
     */
    public function pull(string $pat, string $gistId, ?string $etag = null): array
    {
        $req = $this->http($pat);
        if ($etag !== null && $etag !== '') {
            $req = $req->withHeaders(['If-None-Match' => $etag]);
        }

        $res = $req->get(self::API."/gists/{$gistId}");

        if ($res->status() === 304) {
            return ['notModified' => true, 'etag' => $etag, 'days' => []];
        }
        $this->guard($res->status());

        // NB: access via the array, not $res->json('files.today-data.json') —
        // the dot in the filename would be read as a nested key path.
        $file = $res->json('files')[self::FILE] ?? null;
        if (! $file) {
            return ['notModified' => false, 'etag' => $res->header('ETag') ?: null, 'days' => []];
        }

        // GitHub truncates large file content; fetch the raw blob if so.
        $text = ($file['truncated'] ?? false) && ! empty($file['raw_url'])
            ? Http::timeout(15)->get($file['raw_url'])->body()
            : ($file['content'] ?? '');

        $parsed = json_decode($text, true);
        $days = is_array($parsed['days'] ?? null) ? $parsed['days'] : [];

        return ['notModified' => false, 'etag' => $res->header('ETag') ?: null, 'days' => $days];
    }

    /**
     * @param  array<string, array>  $days
     * @return ?string the gist's new ETag, for the caller to cache
     */
    public function saveDays(string $pat, string $gistId, array $days): ?string
    {
        $envelope = [
            'version' => 1,
            'exportedAt' => now()->toIso8601String(),
            'days' => $days ?: (object) [],
        ];
        $res = $this->http($pat)->patch(self::API."/gists/{$gistId}", [
            'files' => [self::FILE => ['content' => json_encode($envelope, JSON_PRETTY_PRINT)]],
        ]);
        $this->guard($res->status());

        return $res->header('ETag') ?: null;
    }

    /**
     * Write one day into the gist with a read-modify-write, so we don't clobber
     * edits made elsewhere (extension / MCP server share this gist).
     *
     * @return ?string the gist's new ETag, for the caller to cache
     */
    public function putDay(string $pat, string $gistId, Day $day): ?string
    {
        $days = $this->loadDays($pat, $gistId);

        if ($this->hasContent($day)) {
            $days[$day->date] = $day->toArray();
        } else {
            unset($days[$day->date]);
        }

        return $this->saveDays($pat, $gistId, $days);
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
