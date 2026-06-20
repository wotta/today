<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\DayRepository;
use App\Http\Requests\SaveDayRequest;
use Illuminate\Http\JsonResponse;
use Today\Core\AgendaSlot;
use Today\Core\Day;

class DayApiController extends Controller
{
    public function __construct(private readonly DayRepository $days)
    {
    }

    /** Persist the full DayEntry for {date}. Route-constrains date to YYYY-MM-DD. */
    public function update(SaveDayRequest $request, string $date): JsonResponse
    {
        $data = $request->validated();

        // Keep only agenda hours inside the planner range; coerce keys to int.
        $agenda = [];
        foreach (($data['agenda'] ?? []) as $hour => $text) {
            $h = (int) $hour;
            if ($h >= AgendaSlot::START_HOUR && $h <= AgendaSlot::END_HOUR && trim((string) $text) !== '') {
                $agenda[$h] = (string) $text;
            }
        }

        $day = Day::fromArray([
            'date' => $date,
            'checkItems' => $data['checkItems'] ?? [],
            'agenda' => $agenda,
        ]);

        $this->days->save($day);

        return response()->json(['ok' => true]);
    }
}
