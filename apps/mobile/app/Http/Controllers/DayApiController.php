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

        $day = Day::fromArray([
            'date' => $date,
            'checkItems' => $data['checkItems'] ?? [],
            'agenda' => $this->slotMap($data['agenda'] ?? []),
            'note' => $data['note'] ?? null,
            'slotNotes' => $this->slotMap($data['slotNotes'] ?? []),
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

    /** @return array<int|string,string> */
    private function slotMap(array $map): array
    {
        $out = [];
        foreach ($map as $slot => $text) {
            $key = AgendaSlot::key($slot);
            if ($key !== null && trim((string) $text) !== '') {
                $out[$key] = (string) $text;
            }
        }

        return $out;
    }
}
