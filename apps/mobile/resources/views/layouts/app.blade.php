<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="theme-color" content="#f7f5f6" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#171413" media="(prefers-color-scheme: dark)">
    <title>@yield('title', config('app.name', 'Today'))</title>

    {{-- No-FOUC: apply the stored theme before first paint. Mirrors resources/js/theme.js. --}}
    <script>
        (function () {
            try {
                var t = localStorage.getItem('today:theme') || 'auto';
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
