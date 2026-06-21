<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Planner\DayRepository;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Today\Core\AgendaSlot;

class PlannerController extends Controller
{
    public function __construct(private readonly DayRepository $days) {}

    public function show(Request $request)
    {
        $today = Carbon::today();

        // Accept ?date=YYYY-MM-DD; fall back to today on anything malformed.
        $raw = (string) $request->query('date', '');
        $date = preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)
            ? Carbon::createFromFormat('Y-m-d', $raw)->startOfDay()
            : $today->copy();

        $day = $this->days->load($date->toDateString());

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
            'startHour' => AgendaSlot::START_HOUR,
            'endHour' => AgendaSlot::END_HOUR,
        ]);
    }

    /** The "now" agenda hour (6–26, mapping 0–2am to 24–26) when viewing today; else null. */
    private function currentAgendaHour(Carbon $date, Carbon $today): ?int
    {
        if (! $date->isSameDay($today)) {
            return null;
        }

        $h = (int) Carbon::now()->hour;
        $mapped = $h <= AgendaSlot::END_HOUR - 24 ? $h + 24 : $h;

        return $mapped >= AgendaSlot::START_HOUR && $mapped <= AgendaSlot::END_HOUR ? $mapped : null;
    }
}
