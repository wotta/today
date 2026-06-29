@extends('layouts.app')

@section('title', 'Settings · ' . config('app.name', 'Today'))

@php
    $status = session('status');
@endphp

@section('body')
<div class="mx-auto w-full max-w-xl px-4" style="padding-top: calc(env(safe-area-inset-top) + 1.5rem); padding-bottom: calc(env(safe-area-inset-bottom) + 2.5rem);">
    <div class="mb-5 flex items-center justify-between">
        <h1 class="text-xl font-semibold tracking-tight text-stone-800 dark:text-stone-100">Settings</h1>
    </div>

    @if ($status)
        <p class="mb-4 rounded-lg border border-stone-200 bg-white px-4 py-3 text-[13px] font-medium shadow-sm dark:border-stone-700 dark:bg-stone-900 {{ $status['kind'] === 'error' ? 'text-red-600 dark:text-red-400' : ($status['kind'] === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-500 dark:text-stone-400') }}">
            {{ $status['message'] }}
        </p>
    @endif

    {{-- Appearance --}}
    <section class="rounded-lg border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <h2 class="text-lg font-semibold tracking-tight text-stone-800 dark:text-stone-100">Appearance</h2>
        <p class="mt-1 text-[13px] leading-snug text-stone-500 dark:text-stone-400">Choose a theme. <strong>Auto</strong> follows your device.</p>
        <div class="mt-3 inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 p-1 dark:border-stone-700 dark:bg-stone-800">
            @foreach (['light' => 'Light', 'auto' => 'Auto', 'dark' => 'Dark'] as $value => $label)
                <button type="button" data-set-theme="{{ $value }}" aria-pressed="false"
                    class="rounded-full px-4 py-1.5 text-[13px] font-medium text-stone-500 transition-colors hover:text-stone-800 aria-pressed:bg-stone-800 aria-pressed:text-white dark:text-stone-400 dark:hover:text-stone-100 dark:aria-pressed:bg-stone-100 dark:aria-pressed:text-stone-900">{{ $label }}</button>
            @endforeach
        </div>
    </section>

    {{-- Agenda --}}
    <section class="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <h2 class="text-lg font-semibold tracking-tight text-stone-800 dark:text-stone-100">Agenda</h2>
        <p class="mt-1 text-[13px] leading-snug text-stone-500 dark:text-stone-400">Choose how finely UI agents can place planner items on the agenda.</p>
        <div class="mt-4 inline-flex rounded-full border border-stone-200 bg-stone-50 p-1 dark:border-stone-700 dark:bg-stone-800" id="agenda-slot-picker">
            @foreach ([60 => '60 min', 30 => '30 min', 15 => '15 min'] as $value => $label)
                <button type="button"
                    data-set-agenda="{{ $value }}"
                    aria-pressed="{{ $agendaSlotMinutes === $value ? 'true' : 'false' }}"
                    class="rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors text-stone-500 hover:text-stone-800 aria-pressed:bg-stone-800 aria-pressed:text-white dark:text-stone-400 dark:hover:text-stone-100 dark:aria-pressed:bg-stone-100 dark:aria-pressed:text-stone-900">
                    {{ $label }}
                </button>
            @endforeach
        </div>
        <script>
        (function () {
            const token = document.querySelector('meta[name="csrf-token"]')?.content ?? '';
            document.getElementById('agenda-slot-picker').addEventListener('click', function (e) {
                const btn = e.target.closest('[data-set-agenda]');
                if (!btn) return;
                const minutes = btn.dataset.setAgenda;
                this.querySelectorAll('[data-set-agenda]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
                fetch('/api/agenda-slot-minutes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token, Accept: 'application/json' },
                    body: JSON.stringify({ agendaSlotMinutes: Number(minutes) }),
                }).catch(() => {});
            });
        })();
        </script>
    </section>

    {{-- Import / export --}}
    <section class="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <h2 class="text-lg font-semibold tracking-tight text-stone-800 dark:text-stone-100">Planner data</h2>
        <p class="mt-1 text-[13px] leading-snug text-stone-500 dark:text-stone-400">Export or import the shared Today JSON format used by the extension and Gist sync.</p>
        <div class="mt-4 flex flex-col gap-3">
            <a href="{{ route('planner.export') }}" class="self-start rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:border-stone-400 dark:border-stone-600 dark:text-stone-300">Export JSON</a>
            <form method="POST" action="{{ route('settings.import') }}" enctype="multipart/form-data" class="flex flex-col gap-3">
                @csrf
                <input type="file" name="import" accept=".json,application/json"
                    class="text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-stone-700 dark:text-stone-300 dark:file:bg-stone-800 dark:file:text-stone-200" />
                <button type="submit" class="self-start rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white">Import JSON</button>
            </form>
        </div>
    </section>

    {{-- GitHub Gist sync --}}
    <section class="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <h2 class="text-lg font-semibold tracking-tight text-stone-800 dark:text-stone-100">GitHub Gist sync</h2>
        <p class="mt-1 text-[13px] leading-snug text-stone-500 dark:text-stone-400">
            Sync your planner to a private GitHub Gist — the same one the browser extension uses. Requires a Personal Access Token with the
            <code class="rounded bg-stone-100 px-1 dark:bg-stone-800">gist</code> scope.
        </p>

        <form method="POST" action="{{ route('settings.gist.connect') }}" class="mt-5 flex flex-col gap-4">
            @csrf
            <label class="flex flex-col gap-1 text-[13px] font-medium text-stone-700 dark:text-stone-200">
                Personal Access Token
                <input type="password" name="pat" placeholder="ghp_…" autocomplete="off"
                    class="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100" />
                <a href="https://github.com/settings/tokens/new?description=Today%20planner&scopes=gist" target="_blank" rel="noreferrer"
                    class="self-start text-[12px] font-normal text-stone-500 underline decoration-stone-300 underline-offset-2 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100">Create a token with the gist scope →</a>
            </label>

            <label class="flex flex-col gap-1 text-[13px] font-medium text-stone-700 dark:text-stone-200">
                Gist ID <span class="font-normal text-stone-400">(optional — leave blank to find or create one)</span>
                <input type="text" name="gistId" value="{{ $gistId }}" placeholder="e.g. 1a2b3c4d…" autocomplete="off"
                    class="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100" />
            </label>

            <div class="flex items-center gap-3">
                <button type="submit"
                    class="rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white">
                    {{ $connected ? 'Save' : 'Connect' }}
                </button>
            </div>
        </form>

        @if ($connected)
            <div class="mt-3 flex items-center gap-3">
                <form method="POST" action="{{ route('settings.gist.sync') }}">
                    @csrf
                    <button type="submit" class="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:border-stone-400 dark:border-stone-600 dark:text-stone-300">Sync now</button>
                </form>
                <form method="POST" action="{{ route('settings.gist.disconnect') }}">
                    @csrf
                    @method('DELETE')
                    <button type="submit" class="rounded-md px-3 py-2 text-sm font-medium text-stone-500 transition-colors hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100">Disconnect</button>
                </form>
            </div>
        @endif
    </section>

    {{-- Object storage uploads --}}
    <section class="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <h2 class="text-lg font-semibold tracking-tight text-stone-800 dark:text-stone-100">S3/R2 uploads</h2>
        <p class="mt-1 text-[13px] leading-snug text-stone-500 dark:text-stone-400">
            Store images and files in an S3-compatible bucket and insert public markdown links into notes or descriptions.
            Credentials are encrypted on this device.
        </p>

        <form method="POST" action="{{ route('settings.uploads.save') }}" class="mt-5 flex flex-col gap-4">
            @csrf
            <label class="flex flex-col gap-1 text-[13px] font-medium text-stone-700 dark:text-stone-200">
                Endpoint
                <input type="url" name="endpoint" value="{{ old('endpoint', $s3Config['endpoint']) }}" placeholder="https://<account>.r2.cloudflarestorage.com" autocomplete="off"
                    class="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100" />
            </label>

            <div class="grid gap-4 sm:grid-cols-2">
                <label class="flex flex-col gap-1 text-[13px] font-medium text-stone-700 dark:text-stone-200">
                    Bucket
                    <input type="text" name="bucket" value="{{ old('bucket', $s3Config['bucket']) }}" placeholder="today-uploads" autocomplete="off"
                        class="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100" />
                </label>

                <label class="flex flex-col gap-1 text-[13px] font-medium text-stone-700 dark:text-stone-200">
                    Region
                    <input type="text" name="region" value="{{ old('region', $s3Config['region']) }}" placeholder="auto"
                        class="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100" />
                </label>
            </div>

            <label class="flex flex-col gap-1 text-[13px] font-medium text-stone-700 dark:text-stone-200">
                Access key ID
                <input type="password" name="accessKeyId" value="{{ old('accessKeyId', $s3Config['accessKeyId']) }}" autocomplete="off"
                    class="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100" />
            </label>

            <label class="flex flex-col gap-1 text-[13px] font-medium text-stone-700 dark:text-stone-200">
                Secret access key
                <input type="password" name="secretAccessKey" placeholder="{{ $s3Config['hasSecretAccessKey'] ? 'Leave blank to keep current secret' : '' }}" autocomplete="off"
                    class="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100" />
            </label>

            <label class="flex flex-col gap-1 text-[13px] font-medium text-stone-700 dark:text-stone-200">
                Public base URL
                <input type="url" name="publicBaseUrl" value="{{ old('publicBaseUrl', $s3Config['publicBaseUrl']) }}" placeholder="https://pub-xxxx.r2.dev" autocomplete="off"
                    class="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100" />
            </label>

            @if ($errors->any())
                <p class="text-[13px] font-medium text-red-600 dark:text-red-400">Check the highlighted fields and try again.</p>
            @endif

            <div class="flex items-center gap-3">
                <button type="submit"
                    class="rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white">
                    {{ $s3Connected ? 'Save uploads' : 'Connect uploads' }}
                </button>
            </div>
        </form>

        @if ($s3Connected)
            <div class="mt-3 flex items-center gap-3">
                <form method="POST" action="{{ route('settings.uploads.test') }}">
                    @csrf
                    <button type="submit" class="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:border-stone-400 dark:border-stone-600 dark:text-stone-300">Test upload</button>
                </form>
                <form method="POST" action="{{ route('settings.uploads.disconnect') }}">
                    @csrf
                    @method('DELETE')
                    <button type="submit" class="rounded-md px-3 py-2 text-sm font-medium text-stone-500 transition-colors hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100">Disconnect</button>
                </form>
            </div>
        @endif
    </section>
</div>
@endsection
