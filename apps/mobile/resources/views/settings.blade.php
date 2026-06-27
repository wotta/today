@extends('layouts.app')

@section('title', 'Settings · ' . config('app.name', 'Today'))

@php
    $status = session('status');
    $s3Status = session('s3_status');
    $settingsInputClass = 'rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100';
@endphp

@section('body')
<div class="mx-auto w-full max-w-xl px-4" style="padding-top: calc(env(safe-area-inset-top) + 1.5rem); padding-bottom: calc(env(safe-area-inset-bottom) + 2.5rem);">
    <div class="mb-5 flex items-center justify-between">
        <h1 class="text-xl font-semibold tracking-tight text-stone-800 dark:text-stone-100">Settings</h1>
    </div>

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

    {{-- S3 / R2 uploads --}}
    <section class="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <h2 class="text-lg font-semibold tracking-tight text-stone-800 dark:text-stone-100">File uploads (S3 / R2)</h2>
        <p class="mt-1 text-[13px] leading-snug text-stone-500 dark:text-stone-400">
            Upload images and files to your own S3-compatible bucket. The mobile app stores credentials encrypted and uploads server-side, so use a <strong>bucket-scoped</strong> token and a public base URL for saved markdown links.
        </p>

        <form method="POST" action="{{ route('settings.s3.save') }}" class="mt-5 flex flex-col gap-4">
            @csrf

            <label class="flex flex-col gap-1 text-[13px] font-medium text-stone-700 dark:text-stone-200">
                S3 endpoint
                <input type="text" name="endpoint" value="{{ old('endpoint', $s3Config['endpoint']) }}" placeholder="https://<account>.r2.cloudflarestorage.com" autocomplete="off"
                    class="{{ $settingsInputClass }}" />
            </label>

            <div class="flex gap-3">
                <label class="flex flex-1 flex-col gap-1 text-[13px] font-medium text-stone-700 dark:text-stone-200">
                    Bucket
                    <input type="text" name="bucket" value="{{ old('bucket', $s3Config['bucket']) }}" placeholder="my-bucket" autocomplete="off"
                        class="{{ $settingsInputClass }}" />
                </label>
                <label class="flex w-28 flex-col gap-1 text-[13px] font-medium text-stone-700 dark:text-stone-200">
                    Region
                    <input type="text" name="region" value="{{ old('region', $s3Config['region']) }}" placeholder="auto" autocomplete="off"
                        class="{{ $settingsInputClass }}" />
                </label>
            </div>

            <label class="flex flex-col gap-1 text-[13px] font-medium text-stone-700 dark:text-stone-200">
                Access key ID
                <input type="password" name="accessKeyId" value="{{ old('accessKeyId', $s3Config['accessKeyId']) }}" autocomplete="off"
                    class="{{ $settingsInputClass }}" />
            </label>

            <label class="flex flex-col gap-1 text-[13px] font-medium text-stone-700 dark:text-stone-200">
                Secret access key
                <input type="password" name="secretAccessKey" value="{{ old('secretAccessKey', $s3Config['secretAccessKey']) }}" autocomplete="off"
                    class="{{ $settingsInputClass }}" />
            </label>

            <label class="flex flex-col gap-1 text-[13px] font-medium text-stone-700 dark:text-stone-200">
                Public base URL
                <input type="text" name="publicBaseUrl" value="{{ old('publicBaseUrl', $s3Config['publicBaseUrl']) }}" placeholder="https://pub-xxxx.r2.dev" autocomplete="off"
                    class="{{ $settingsInputClass }}" />
            </label>

            <div class="flex flex-wrap items-center gap-3">
                <button type="submit"
                    class="rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white">
                    Save bucket
                </button>
                <button type="submit" formaction="{{ route('settings.s3.test') }}"
                    class="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:border-stone-400 dark:border-stone-600 dark:text-stone-300">
                    Test upload
                </button>
            </div>
        </form>

        @if ($s3Configured)
            <form method="POST" action="{{ route('settings.s3.disconnect') }}" class="mt-3">
                @csrf
                @method('DELETE')
                <button type="submit" class="rounded-md px-3 py-2 text-sm font-medium text-stone-500 transition-colors hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100">Disconnect bucket</button>
            </form>
        @endif

        @if ($s3Status)
            <p class="mt-4 break-all text-[13px] font-medium {{ $s3Status['kind'] === 'error' ? 'text-red-600 dark:text-red-400' : ($s3Status['kind'] === 'tested' || $s3Status['kind'] === 'saved' ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-500 dark:text-stone-400') }}">
                {{ $s3Status['message'] }}
            </p>
        @endif
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

        @if ($status)
            <p class="mt-4 text-[13px] font-medium {{ $status['kind'] === 'error' ? 'text-red-600 dark:text-red-400' : ($status['kind'] === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-500 dark:text-stone-400') }}">
                {{ $status['message'] }}
            </p>
        @endif
    </section>
</div>
@endsection
