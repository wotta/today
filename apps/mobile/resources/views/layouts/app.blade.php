<!DOCTYPE html>
<html lang="en" class="h-full" data-theme="{{ $appTheme ?? 'auto' }}">
<head>
    <meta charset="utf-8">
    {{-- maximum-scale + user-scalable=no stops iOS from auto-zooming when a text
         field is focused (the "typing zooms the page" annoyance). --}}
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="theme-color" content="#f7f5f6" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#171413" media="(prefers-color-scheme: dark)">
    <title>@yield('title', config('app.name', 'Today'))</title>

    {{-- No-FOUC: apply the server-stored theme (on <html data-theme>) before first
         paint. 'auto' resolves against the OS preference. Mirrors resources/js/theme.js. --}}
    <script>
        (function () {
            try {
                var t = document.documentElement.dataset.theme || 'auto';
                var dark = t === 'dark' || (t === 'auto' &&
                    window.matchMedia('(prefers-color-scheme: dark)').matches);
                document.documentElement.classList.toggle('dark', dark);
                document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
            } catch (e) {}
        })();
    </script>

    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-full font-sans antialiased">
    @yield('body')

    {{-- Native bottom navigation (NativePHP EDGE) — renders as a real native
         tab bar outside the web view; ignored in a plain browser. --}}
    <native:bottom-nav label-visibility="labeled">
        <native:bottom-nav-item id="today" icon="calendar" label="Today"
            url="{{ route('planner') }}" :active="request()->routeIs('planner')" />
        <native:bottom-nav-item id="settings" icon="settings" label="Settings"
            url="{{ route('settings') }}" :active="request()->routeIs('settings')" />
    </native:bottom-nav>
</body>
</html>
