<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>{{ config('app.name') }}</title>
    <style>
        :root { color-scheme: light dark; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
            background: #f6f6f4;
            color: #1c1c1e;
            padding: env(safe-area-inset-top) 1rem 2rem;
        }
        h1 { font-size: 1.5rem; margin: 1rem 0 0.25rem; }
        .date { color: #8a8a8e; margin: 0 0 1.5rem; }
        h2 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #8a8a8e; margin: 1.5rem 0 0.5rem; }
        ul { list-style: none; padding: 0; margin: 0; }
        .item { display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 0.8rem; background: #fff; border-radius: 10px; margin-bottom: 0.4rem; }
        .item.done span { text-decoration: line-through; color: #b0b0b5; }
        .box { width: 1.1rem; height: 1.1rem; border: 2px solid #c7c7cc; border-radius: 5px; flex: none; display: grid; place-items: center; font-size: 0.8rem; }
        .item.done .box { background: #34c759; border-color: #34c759; color: #fff; }
        .slot { margin-left: auto; font-size: 0.75rem; color: #007aff; background: #e8f0fe; padding: 0.1rem 0.5rem; border-radius: 6px; }
        .row { display: flex; gap: 0.8rem; padding: 0.5rem 0.8rem; background: #fff; border-radius: 10px; margin-bottom: 0.3rem; }
        .hour { font-variant-numeric: tabular-nums; color: #8a8a8e; flex: none; width: 3rem; }
        @media (prefers-color-scheme: dark) {
            body { background: #000; color: #f2f2f7; }
            .item, .row { background: #1c1c1e; }
            h1 { color: #fff; }
        }
    </style>
</head>
<body>
    <h1>{{ config('app.name') }}</h1>
    <p class="date">{{ $day->date }}</p>

    <h2>Checklist</h2>
    <ul>
        @foreach ($day->checkItems as $item)
            <li class="item {{ $item->done ? 'done' : '' }}">
                <span class="box">{{ $item->done ? '✓' : '' }}</span>
                <span>{{ $item->text }}</span>
                @if ($item->slot !== null)
                    <span class="slot">{{ $item->slot }}:00</span>
                @endif
            </li>
        @endforeach
    </ul>

    <h2>Agenda</h2>
    @forelse ($day->agenda as $hour => $text)
        <div class="row"><span class="hour">{{ $hour }}:00</span><span>{{ $text }}</span></div>
    @empty
        <p class="date">No agenda entries.</p>
    @endforelse
</body>
</html>
