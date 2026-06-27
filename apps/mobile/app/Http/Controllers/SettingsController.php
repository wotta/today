<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Gist\GistClient;
use App\Domain\Gist\GistException;
use App\Domain\Gist\GistSync;
use App\Domain\Settings\SettingRepository;
use App\Domain\Upload\S3UploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Throwable;

class SettingsController extends Controller
{
    public function __construct(
        private readonly SettingRepository $settings,
        private readonly GistClient $gist,
        private readonly GistSync $sync,
        private readonly S3UploadService $uploads,
    ) {}

    public function index()
    {
        $config = $this->settings->gistConfig();

        return view('settings', [
            'connected' => $config !== null,
            'gistId' => $config['gistId'] ?? '',
            's3Connected' => $this->settings->s3Config() !== null,
            's3Config' => $this->settings->s3FormConfig(),
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

    public function saveS3Config(Request $request): RedirectResponse
    {
        $existing = $this->settings->s3Config();
        $data = $request->validate([
            'endpoint' => ['required', 'url'],
            'bucket' => ['required', 'string'],
            'region' => ['nullable', 'string'],
            'accessKeyId' => [$existing ? 'nullable' : 'required', 'string'],
            'secretAccessKey' => [$existing ? 'nullable' : 'required', 'string'],
            'publicBaseUrl' => ['required', 'url'],
        ]);

        $this->settings->setS3Config([
            'endpoint' => $data['endpoint'],
            'bucket' => $data['bucket'],
            'region' => $data['region'] ?? 'auto',
            'accessKeyId' => $data['accessKeyId'] ?? '',
            'secretAccessKey' => $data['secretAccessKey'] ?? '',
            'publicBaseUrl' => $data['publicBaseUrl'],
        ]);

        return back()->with('status', ['kind' => 'connected', 'message' => 'Object storage settings saved.']);
    }

    public function disconnectS3(): RedirectResponse
    {
        $this->settings->clearS3Config();

        return back()->with('status', ['kind' => 'idle', 'message' => 'Object storage disconnected.']);
    }

    public function testS3Upload(): RedirectResponse
    {
        try {
            $uploaded = $this->uploads->testUpload();

            return back()->with('status', [
                'kind' => 'connected',
                'message' => 'Test upload succeeded: '.$uploaded['url'],
            ]);
        } catch (RuntimeException $e) {
            return back()->with('status', ['kind' => 'error', 'message' => $e->getMessage()]);
        } catch (Throwable) {
            return back()->with('status', [
                'kind' => 'error',
                'message' => 'Test upload failed. Check the bucket, endpoint, and credentials.',
            ]);
        }
    }
}
