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

    /** @return array<string, array> */
    public function all(): array
    {
        return DayRecord::query()
            ->orderBy('date')
            ->get()
            ->mapWithKeys(fn (DayRecord $record) => [
                $record->date => Day::fromArray($record->payload + ['date' => $record->date])->toArray(),
            ])
            ->all();
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

    /**
     * Merge external DayEntry payloads into local days without treating omitted
     * fields as deletes. Returns changed payloads for the planner to patch.
     *
     * @param  array<string, array>  $incoming
     * @return array{changed: list<string>, days: array<string, array>, skipped: int}
     */
    public function merge(array $incoming): array
    {
        $changed = [];
        $payloads = [];
        $skipped = 0;

        foreach ($incoming as $date => $entry) {
            if (! is_array($entry)) {
                $skipped++;
                continue;
            }

            $date = (string) ($entry['date'] ?? $date);
            if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                $skipped++;
                continue;
            }

            try {
                $merged = Day::fromArray($this->mergePayload($this->load($date)->toArray(), $entry + ['date' => $date]));
            } catch (\Throwable) {
                $skipped++;
                continue;
            }

            $payload = $merged->toArray();
            if ($payload === $this->load($date)->toArray()) {
                $skipped++;
                continue;
            }

            $this->save($merged);
            $changed[] = $date;
            $payloads[$date] = $payload;
        }

        return ['changed' => $changed, 'days' => $payloads, 'skipped' => $skipped];
    }

    /** @param array<string,mixed> $local @param array<string,mixed> $incoming */
    private function mergePayload(array $local, array $incoming): array
    {
        $merged = $local + [
            'date' => (string) $incoming['date'],
            'checkItems' => [],
            'agenda' => [],
        ];
        $merged['date'] = (string) $incoming['date'];

        if (array_key_exists('checkItems', $incoming) && is_array($incoming['checkItems'])) {
            $merged['checkItems'] = $this->mergeCheckItems($local['checkItems'] ?? [], $incoming['checkItems']);
        }

        if (array_key_exists('agenda', $incoming) && is_array($incoming['agenda'])) {
            $merged['agenda'] = $this->mergeTextMap($local['agenda'] ?? [], $incoming['agenda']);
        }

        if (array_key_exists('note', $incoming)) {
            if ($incoming['note'] === null) {
                unset($merged['note']);
            } else {
                $merged['note'] = (string) $incoming['note'];
            }
        }

        if (array_key_exists('slotNotes', $incoming) && is_array($incoming['slotNotes'])) {
            $merged['slotNotes'] = $this->mergeTextMap($local['slotNotes'] ?? [], $incoming['slotNotes']);
        }

        return $merged;
    }

    /** @param list<array<string,mixed>> $local @param list<array<string,mixed>> $incoming */
    private function mergeCheckItems(array $local, array $incoming): array
    {
        $byId = [];
        foreach ($local as $item) {
            if (is_array($item) && isset($item['id'])) {
                $byId[(string) $item['id']] = $item;
            }
        }

        foreach ($incoming as $item) {
            if (! is_array($item) || ! isset($item['id']) || (string) $item['id'] === '') {
                continue;
            }

            $id = (string) $item['id'];
            $byId[$id] = array_key_exists($id, $byId)
                ? array_merge($byId[$id], $item)
                : $item;
        }

        return array_values($byId);
    }

    /** @param array<int|string,string> $local @param array<int|string,mixed> $incoming */
    private function mergeTextMap(array $local, array $incoming): array
    {
        $merged = $local;
        foreach ($incoming as $slot => $text) {
            if ($text === null || trim((string) $text) === '') {
                unset($merged[$slot]);
            } else {
                $merged[$slot] = (string) $text;
            }
        }

        return $merged;
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
