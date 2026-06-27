<?php

declare(strict_types=1);

namespace Today\Core;

/**
 * A single day's planner entry, keyed by ISO date. Mirrors the extension's
 * @today/types DayEntry. Agenda/slot-note maps are keyed by agenda slot
 * (6-26, quarter-hour precision). JSON object keys arrive as strings.
 */
final class Day
{
    private const DATE_RE = '/^\d{4}-\d{2}-\d{2}$/';

    public function __construct(
        /** ISO date "YYYY-MM-DD" — primary key. */
        public readonly string $date,
        /** @var list<CheckItem> */
        public readonly array $checkItems = [],
        /** @var array<int|string,string> slot => free text */
        public readonly array $agenda = [],
        /** Freeform markdown note for the whole day. */
        public readonly ?string $note = null,
        /** @var array<int|string,string> slot => markdown note */
        public readonly array $slotNotes = [],
    ) {
        if (! preg_match(self::DATE_RE, $date)) {
            throw new \InvalidArgumentException("Invalid ISO date: {$date}");
        }
    }

    public static function empty(string $date): self
    {
        return new self(date: $date);
    }

    public static function fromArray(array $data): self
    {
        return new self(
            date: (string) $data['date'],
            checkItems: array_map(
                static fn (array $i) => CheckItem::fromArray($i),
                $data['checkItems'] ?? [],
            ),
            agenda: self::intKeyed($data['agenda'] ?? []),
            note: isset($data['note']) ? (string) $data['note'] : null,
            slotNotes: self::intKeyed($data['slotNotes'] ?? []),
        );
    }

    public function toArray(): array
    {
        return array_filter([
            'date' => $this->date,
            'checkItems' => array_map(static fn (CheckItem $i) => $i->toArray(), $this->checkItems),
            'agenda' => $this->agenda,
            'note' => $this->note,
            'slotNotes' => $this->slotNotes ?: null,
        ], static fn ($v) => $v !== null);
    }

    /** @return array<int|string,string> */
    private static function intKeyed(array $map): array
    {
        $out = [];
        foreach ($map as $slot => $text) {
            $key = AgendaSlot::key($slot);
            if ($key !== null) {
                $out[$key] = (string) $text;
            }
        }

        return $out;
    }
}
