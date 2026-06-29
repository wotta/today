<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Planner\DayRepository;
use App\Domain\Settings\SettingRepository;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Today\Core\AgendaSlot;

class PlannerController extends Controller
{
    public function __construct(
        private readonly DayRepository $days,
        private readonly SettingRepository $settings,
    ) {}

    public function show(Request $request)
    {
        $today = Carbon::today();

        // Accept ?date=YYYY-MM-DD; fall back to today on anything malformed.
        $raw = (string) $request->query('date', '');
        $date = preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)
            ? Carbon::createFromFormat('Y-m-d', $raw)->startOfDay()
            : $today->copy();

        $day = $this->days->load($date->toDateString());
        $agendaGranularity = $this->settings->agendaGranularity();

        // Weekday strip (Sun … Sat); each cell jumps to that day in the view week.
        $letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        $names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        $activeDow = (int) $date->dayOfWeek; // 0 = Sunday
        $weekdays = [];
        foreach ($letters as $i => $letter) {
            $cell = $date->copy()->addDays($i - $activeDow);
            $weekdays[] = [
                'letter' => $letter,
                'name' => $names[$i],
                'date' => $cell->toDateString(),
                'dom' => $cell->day,
                'active' => $i === $activeDow,
                'isToday' => $cell->isSameDay($today),
            ];
        }

        return view('planner', [
            'day' => $day,
            'date' => $date->toDateString(),
            'longDate' => $date->format('F j, Y'),
            'weekdayName' => $date->format('l'),
            'monthDay' => $date->format('F j'),
            'prevDate' => $date->copy()->subDay()->toDateString(),
            'nextDate' => $date->copy()->addDay()->toDateString(),
            'todayDate' => $today->toDateString(),
            'isToday' => $date->isSameDay($today),
            'weekdays' => $weekdays,
            'currentHour' => $this->currentAgendaHour($date, $today),
            'agendaSlotMinutes' => $this->settings->agendaSlotMinutes(),
        ]);
    }

    /**
     * @return list<array{key: int|string, label: string, major: bool, index: int}>
     */
    private function agendaSlots(int $granularity): array
    {
        $slots = [];
        $step = max(15, $granularity);
        $index = 0;

        for ($minutes = AgendaSlot::START_HOUR * 60; $minutes <= AgendaSlot::END_HOUR * 60; $minutes += $step) {
            $hour = intdiv($minutes, 60);
            $minute = $minutes % 60;
            $slot = $hour + ($minute / 60);

            $slots[] = [
                'key' => AgendaSlot::key($slot),
                'label' => sprintf('%d:%02d', $hour > 24 ? $hour - 24 : $hour, $minute),
                'major' => $minute === 0,
                'index' => $index++,
            ];
        }

        return $slots;
    }

    /** The "now" agenda slot (6–26, mapping 0–2am to 24–26) when viewing today; else null. */
    private function currentAgendaSlot(Carbon $date, Carbon $today, int $granularity): int|string|null
    {
        if (! $date->isSameDay($today)) {
            return null;
        }

        $now = Carbon::now();
        $h = (int) $now->hour;
        $mapped = $h <= AgendaSlot::END_HOUR - 24 ? $h + 24 : $h;
        $slot = $mapped + (floor($now->minute / $granularity) * $granularity / 60);

        return AgendaSlot::isValid((string) $slot) ? AgendaSlot::key($slot) : null;
    }
}
