<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Gist\GistException;
use App\Domain\Gist\GistSync;
use App\Domain\Planner\DayRepository;
use App\Http\Requests\SaveDayRequest;
use Illuminate\Http\JsonResponse;
use Today\Core\AgendaSlot;
use Today\Core\Day;

class DayApiController extends Controller
{
    public function __construct(
        private readonly DayRepository $days,
        private readonly GistSync $sync,
    ) {}

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

        // Best-effort push to the Gist so the extension/other devices see it.
        // A network/auth failure must not fail the local edit.
        $synced = false;
        try {
            $synced = $this->sync->pushDay($day);
        } catch (GistException) {
            // swallow — local save already succeeded; sync retries on next edit
        }

        return response()->json(['ok' => true, 'synced' => $synced]);
    }
}
