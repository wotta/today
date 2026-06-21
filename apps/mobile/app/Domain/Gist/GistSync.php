<?php

declare(strict_types=1);

namespace App\Domain\Gist;

use App\Domain\Planner\DayRepository;
use App\Domain\Settings\SettingRepository;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Today\Core\Day;

/**
 * Coordinates Gist <-> local sync. Both the pull (poll for remote edits) and the
 * push (write one day) run under a single lock so they never interleave inside
 * this app — a poll can't read-modify-write on top of an in-flight push.
 *
 * Pull is UPSERT-ONLY: it adds/updates days from the Gist but never deletes a
 * local day that is absent remotely, because that day might be a fresh local
 * edit not yet pushed (offline). Cross-device deletes therefore don't propagate
 * via pull — an accepted trade-off to avoid clobbering unsynced local writes.
 */
class GistSync
{
    private const LOCK = 'gist-sync';

    public function __construct(
        private readonly GistClient $gist,
        private readonly DayRepository $days,
        private readonly SettingRepository $settings,
    ) {}

    /**
     * Poll the Gist for remote changes and merge them locally. Cheap on the
     * common path: a 304 (nothing changed) skips the body parse entirely.
     *
     * @return array{changed: list<string>, days: array<string, array>}
     *                                                                  changed dates + their fresh payloads, for the frontend to patch in place
     */
    public function pull(): array
    {
        $config = $this->settings->gistConfig();
        if ($config === null) {
            return ['changed' => [], 'days' => []];
        }

        // get() returns false if a push currently holds the lock — skip this
        // poll; the next tick picks the change up.
        $result = Cache::lock(self::LOCK, 10)->get(function () use ($config) {
            $res = $this->gist->pull($config['pat'], $config['gistId'], $this->settings->gistEtag());

            if ($res['notModified']) {
                return ['changed' => [], 'days' => []];
            }

            $merged = $this->merge($res['days']);
            $this->settings->setGistEtag($res['etag']);

            return $merged;
        });

        return $result ?: ['changed' => [], 'days' => []];
    }

    /**
     * Push one day to the Gist under the shared lock. Returns false when the
     * Gist isn't configured; may throw GistException on a network/auth failure
     * (the caller decides whether to swallow it).
     */
    public function pushDay(Day $day): bool
    {
        $config = $this->settings->gistConfig();
        if ($config === null) {
            return false;
        }

        // block() waits briefly for an in-flight pull to finish rather than
        // dropping the write. If the lock can't be taken in time, report
        // not-synced — the local save stands and the next edit retries.
        try {
            return (bool) Cache::lock(self::LOCK, 10)->block(5, function () use ($config, $day) {
                $etag = $this->gist->putDay($config['pat'], $config['gistId'], $day);
                $this->settings->setGistEtag($etag);

                return true;
            });
        } catch (LockTimeoutException) {
            return false;
        }
    }

    /**
     * Full import ignoring the cached ETag — used when (re)connecting a Gist.
     * Returns the number of days pulled.
     */
    public function importAll(string $pat, string $gistId): int
    {
        try {
            return (int) Cache::lock(self::LOCK, 10)->block(5, function () use ($pat, $gistId) {
                $res = $this->gist->pull($pat, $gistId);
                $this->merge($res['days']);
                $this->settings->setGistEtag($res['etag']);

                return count($res['days']);
            });
        } catch (LockTimeoutException) {
            throw new GistException('unknown', 0, 'Sync is busy — try again in a moment.');
        }
    }

    /**
     * Upsert remote days into the local store, skipping ones already identical.
     *
     * @param  array<string, array>  $remote
     * @return array{changed: list<string>, days: array<string, array>}
     */
    private function merge(array $remote): array
    {
        $changed = [];
        $payloads = [];

        foreach ($remote as $date => $entry) {
            $remoteDay = Day::fromArray($entry + ['date' => (string) $date]);
            $local = $this->days->load((string) $date);

            if ($remoteDay->toArray() === $local->toArray()) {
                continue; // unchanged — no write, don't report it
            }

            $this->days->save($remoteDay);
            $changed[] = (string) $date;
            $payloads[(string) $date] = $remoteDay->toArray();
        }

        return ['changed' => $changed, 'days' => $payloads];
    }
}
