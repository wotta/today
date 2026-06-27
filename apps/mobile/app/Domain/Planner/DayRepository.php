<?php

declare(strict_types=1);

namespace App\Domain\Planner;

use App\Models\DayRecord;
use Today\Core\CheckItem;
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

    /** Merge an imported/synced day into the local day, preserving both sides. */
    public function merge(Day $incoming): ?Day
    {
        $local = $this->load($incoming->date);
        $merged = $this->mergeDay($local, $incoming);

        if ($merged->toArray() === $local->toArray()) {
            return null;
        }

        $this->save($merged);

        return $merged;
    }

    private function mergeDay(Day $local, Day $incoming): Day
    {
        return new Day(
            date: $local->date,
            checkItems: $this->mergeCheckItems($local->checkItems, $incoming->checkItems),
            agenda: $this->mergeSlotMap($local->agenda, $incoming->agenda),
            note: $this->mergeText($local->note, $incoming->note),
            slotNotes: $this->mergeSlotMap($local->slotNotes, $incoming->slotNotes),
        );
    }

    /**
     * @param  list<CheckItem>  $local
     * @param  list<CheckItem>  $incoming
     * @return list<CheckItem>
     */
    private function mergeCheckItems(array $local, array $incoming): array
    {
        $items = array_map(static fn (CheckItem $item) => $item->toArray(), $local);
        $indexes = [];
        $maxOrder = -1;

        foreach ($items as $index => $item) {
            $indexes[$item['id']] = $index;
            $maxOrder = max($maxOrder, (int) ($item['order'] ?? 0));
        }

        foreach ($incoming as $item) {
            $data = $item->toArray();
            $id = $data['id'];

            if (! array_key_exists($id, $indexes)) {
                $data['order'] = ++$maxOrder;
                $indexes[$id] = count($items);
                $items[] = $data;

                continue;
            }

            $items[$indexes[$id]] = $this->mergeCheckItem($items[$indexes[$id]], $data);
        }

        usort($items, static fn (array $a, array $b) => ((int) $a['order']) <=> ((int) $b['order']));

        return array_map(static fn (array $item) => CheckItem::fromArray($item), $items);
    }

    /** @param array<string, mixed> $local @param array<string, mixed> $incoming */
    private function mergeCheckItem(array $local, array $incoming): array
    {
        if (trim((string) ($local['description'] ?? '')) === '' && trim((string) ($incoming['description'] ?? '')) !== '') {
            $local['description'] = $incoming['description'];
        } elseif (($local['description'] ?? null) !== ($incoming['description'] ?? null)) {
            $local['description'] = $this->mergeText($local['description'] ?? null, $incoming['description'] ?? null);
        }

        if (! array_key_exists('slot', $local) && array_key_exists('slot', $incoming)) {
            $local['slot'] = $incoming['slot'];
        }

        return $local;
    }

    /** @param array<int|string, string> $local @param array<int|string, string> $incoming */
    private function mergeSlotMap(array $local, array $incoming): array
    {
        $merged = $local;

        foreach ($incoming as $slot => $text) {
            if (trim((string) $text) === '') {
                continue;
            }

            if (! array_key_exists($slot, $merged) || trim((string) $merged[$slot]) === '') {
                $merged[$slot] = $text;

                continue;
            }

            if ($merged[$slot] !== $text) {
                $merged[$slot] = (string) $this->mergeText((string) $merged[$slot], (string) $text);
            }
        }

        return $merged;
    }

    private function mergeText(?string $local, ?string $incoming): ?string
    {
        $localText = trim($local ?? '');
        $incomingText = trim($incoming ?? '');

        if ($localText === '') {
            return $incomingText === '' ? null : $incoming;
        }

        if ($incomingText === '' || $localText === $incomingText) {
            return $local;
        }

        return rtrim((string) $local)."\n\n".ltrim((string) $incoming);
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
