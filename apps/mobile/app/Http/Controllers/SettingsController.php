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
use Illuminate\Http\Response;

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
            'agendaSlotMinutes' => $this->settings->agendaSlotMinutes(),
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

    /** Persist the planner agenda granularity choice. */
    public function setAgendaSlotMinutes(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'agendaSlotMinutes' => ['required', 'integer', 'in:60,30,15'],
        ]);

        $this->settings->setAgendaSlotMinutes((int) $data['agendaSlotMinutes']);

        return back()->with('status', ['kind' => 'connected', 'message' => 'Agenda granularity saved.']);
    }

    /** Download all locally stored planner days as the shared JSON envelope. */
    public function exportPlanner(): Response
    {
        $content = json_encode([
            'version' => 1,
            'exportedAt' => now()->toIso8601String(),
            'days' => $this->days->all(),
        ], JSON_PRETTY_PRINT);

        return response($content, 200, [
            'Content-Type' => 'application/json',
            'Content-Disposition' => 'attachment; filename="today-export-'.now()->toDateString().'.json"',
        ]);
    }

    /** Import a shared JSON envelope and merge each incoming day locally. */
    public function importPlanner(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'import' => ['required', 'file'],
        ]);

        $text = file_get_contents($data['import']->getRealPath());
        $parsed = json_decode($text, true);
        if (
            ! is_array($parsed)
            || ($parsed['version'] ?? null) !== 1
            || ! is_array($parsed['days'] ?? null)
        ) {
            return back()->with('status', ['kind' => 'error', 'message' => 'Unrecognised import format.']);
        }

        $result = $this->days->merge($parsed['days']);
        $imported = count($result['changed']);
        $skipped = $result['skipped'];
        $message = $imported === 0
            ? "Nothing new — {$skipped} day".($skipped === 1 ? '' : 's').' skipped'
            : "Imported {$imported} day".($imported === 1 ? '' : 's').($skipped > 0 ? ", skipped {$skipped}" : '');

        return back()->with('status', ['kind' => 'connected', 'message' => $message]);
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
}
