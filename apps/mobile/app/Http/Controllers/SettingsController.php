<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Gist\GistClient;
use App\Domain\Gist\GistException;
use App\Domain\Gist\GistSync;
use App\Domain\Planner\DayRepository;
use App\Domain\Settings\SettingRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Today\Core\Day;

class SettingsController extends Controller
{
    public function __construct(
        private readonly SettingRepository $settings,
        private readonly GistClient $gist,
        private readonly GistSync $sync,
        private readonly DayRepository $days,
    ) {}

    public function index()
    {
        $config = $this->settings->gistConfig();

        return view('settings', [
            'connected' => $config !== null,
            'gistId' => $config['gistId'] ?? '',
            'agendaGranularity' => $this->settings->agendaGranularity(),
            'agendaGranularities' => [60, 30, 15],
        ]);
    }

    /** Connect (or re-point) the Gist backend, then import its days locally. */
    public function connectGist(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'pat' => ['required', 'string'],
            'gistId' => ['nullable', 'string'],
        ]);

        $pat = trim($data['pat']);
        $existing = trim((string) ($data['gistId'] ?? ''));

        try {
            if ($existing !== '') {
                $this->gist->verifyGist($pat, $existing);
                $id = $existing;
            } else {
                // Reuse an existing today-data.json gist before creating one, so a
                // second device doesn't spawn a duplicate. (Also validates the PAT.)
                $id = $this->gist->findGistWithData($pat) ?? $this->gist->createGist($pat);
            }

            $this->settings->setGistConfig($pat, $id);
            $imported = $this->sync->importAll($pat, $id);

            return back()->with('status', [
                'kind' => 'connected',
                'message' => "Connected — gist: {$id} ({$imported} days imported)",
            ]);
        } catch (GistException $e) {
            return back()->with('status', ['kind' => 'error', 'message' => $e->userMessage()]);
        }
    }

    /** Persist the appearance choice so it survives an app restart. */
    public function setTheme(Request $request): JsonResponse
    {
        $data = $request->validate([
            'theme' => ['required', 'in:light,dark,auto'],
        ]);

        $this->settings->setTheme($data['theme']);

        return response()->json(['ok' => true]);
    }

    public function setAgendaGranularity(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'agendaGranularity' => ['required', 'integer', 'in:60,30,15'],
        ]);

        $this->settings->setAgendaGranularity((int) $data['agendaGranularity']);

        return back()->with('status', [
            'kind' => 'connected',
            'message' => "Agenda granularity set to {$data['agendaGranularity']} minutes.",
        ]);
    }

    public function exportPlannerData(): JsonResponse
    {
        $filename = 'today-export-'.now()->toDateString().'.json';

        return response()->json([
            'version' => 1,
            'exportedAt' => now()->toIso8601String(),
            'days' => $this->days->all() ?: (object) [],
        ], 200, [
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ], JSON_PRETTY_PRINT);
    }

    public function importPlannerData(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'plannerData' => ['required', 'file', 'max:2048'],
        ]);

        $text = file_get_contents($data['plannerData']->getRealPath());
        $days = is_string($text) ? $this->decodePlannerDays($text) : null;
        if ($days === null) {
            return back()->with('status', ['kind' => 'error', 'message' => 'Import failed — unrecognised JSON format.']);
        }

        $merged = 0;
        $skipped = 0;
        foreach ($days as $date => $entry) {
            try {
                $day = Day::fromArray($entry + ['date' => (string) $date]);
            } catch (\Throwable) {
                $skipped++;

                continue;
            }

            if ($this->days->merge($day) === null) {
                $skipped++;
            } else {
                $merged++;
            }
        }

        return back()->with('status', [
            'kind' => 'connected',
            'message' => "Imported {$merged} day".($merged === 1 ? '' : 's').($skipped > 0 ? ", skipped {$skipped}" : '').'.',
        ]);
    }

    public function disconnectGist(): RedirectResponse
    {
        $this->settings->clearGistConfig();

        return back()->with('status', ['kind' => 'idle', 'message' => 'Disconnected.']);
    }

    /** Pull the latest days from the Gist into the local store. */
    public function syncNow(): RedirectResponse
    {
        $config = $this->settings->gistConfig();
        if ($config === null) {
            return back()->with('status', ['kind' => 'error', 'message' => 'Not connected.']);
        }

        try {
            $imported = $this->sync->importAll($config['pat'], $config['gistId']);

            return back()->with('status', ['kind' => 'connected', 'message' => "Synced — {$imported} days pulled"]);
        } catch (GistException $e) {
            return back()->with('status', ['kind' => 'error', 'message' => $e->userMessage()]);
        }
    }

    /** @return array<string, array>|null */
    private function decodePlannerDays(string $text): ?array
    {
        $parsed = json_decode($text, true);
        if (! is_array($parsed) || ($parsed['version'] ?? null) !== 1 || ! is_array($parsed['days'] ?? null)) {
            return null;
        }

        $days = [];
        foreach ($parsed['days'] as $date => $entry) {
            if (is_string($date) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) && is_array($entry)) {
                $days[$date] = $entry;
            }
        }

        return $days;
    }
}
