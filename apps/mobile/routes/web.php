<?php

use Illuminate\Support\Facades\Route;
use Today\Core\AgendaSlot;
use Today\Core\Day;

Route::get('/', function () {
    // Demo data built from the shared today/core domain — same wire shape the
    // browser extension uses via @today/types. A real build swaps this for the
    // synced backend (MCP/Gist).
    $day = Day::fromArray([
        'date' => now()->toDateString(),
        'checkItems' => [
            ['id' => '1', 'text' => 'Ship monorepo experiment', 'done' => true, 'order' => 0],
            ['id' => '2', 'text' => 'Wire mobile to today/core', 'done' => false, 'order' => 1, 'slot' => 9],
            ['id' => '3', 'text' => 'Extract @today/ui', 'done' => false, 'order' => 2],
        ],
        'agenda' => ['9' => 'Standup', '14' => 'Deep work'],
    ]);

    return view('today', [
        'day' => $day,
        'startHour' => AgendaSlot::START_HOUR,
        'endHour' => AgendaSlot::END_HOUR,
    ]);
});
