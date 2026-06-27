<?php

declare(strict_types=1);

namespace App\Domain\Planner;

use App\Models\DayRecord;
use Today\Core\Day;

/**
 * Local source of truth for planner days. Maps the `day_records` table to and
 * from today/core `Day` value objects. Gist sync (Phase D) layers on top of this.
 */
class DayRepository
{
    /** Load a day, or an empty one if it has never been stored. */
    public function load(string $date): Day
    {
        $record = DayRecord::find($date);

        return $record
            ? Day::fromArray($record->payload)
            : Day::empty($date);
    }

    /** Persist a day. An empty day is removed rather than stored. */
    public function save(Day $day): void
    {
        if ($this->isEmpty($day)) {
            DayRecord::where('date', $day->date)->delete();

            return;
        }

        DayRecord::updateOrCreate(
            ['date' => $day->date],
            ['payload' => $day->toArray()],
        );
    }

    private function isEmpty(Day $day): bool
    {
        if ($day->checkItems !== []) {
            return false;
        }

        foreach ($day->agenda as $text) {
            if (trim($text) !== '') {
                return false;
            }
        }

        if (trim($day->note ?? '') !== '') {
            return false;
        }

        foreach ($day->slotNotes as $text) {
            if (trim($text) !== '') {
                return false;
            }
        }

        return true;
    }
}
