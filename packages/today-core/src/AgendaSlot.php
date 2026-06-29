<?php

declare(strict_types=1);

namespace Today\Core;

/**
 * One agenda slot. The planner runs 6:00 -> 26:00 (Japanese-planner style,
 * where 24=midnight, 25=1am, 26=2am) and supports quarter-hour precision.
 */
final class AgendaSlot
{
    /** First hour shown in the agenda. */
    public const START_HOUR = 6;

    /** Last hour shown in the agenda. */
    public const END_HOUR = 26;

    /** Smallest supported slot step, in hours. */
    public const STEP = 0.25;

    public function __construct(
        public readonly int|float $hour,
        public readonly string $text = '',
        public readonly ?string $note = null,
    ) {
        if (! self::isValid($hour)) {
            throw new \InvalidArgumentException(
                "Agenda slot {$hour} is outside the 6-26 range or is not on a quarter-hour.",
            );
        }
    }

    public static function isValid(int|float|string $slot): bool
    {
        if (! is_numeric($slot)) {
            return false;
        }

        $value = (float) $slot;
        if ($value < self::START_HOUR || $value > self::END_HOUR) {
            return false;
        }

        return abs(($value / self::STEP) - round($value / self::STEP)) < 0.00001;
    }

    public static function normalizeValue(int|float|string $slot): int|float|null
    {
        if (! self::isValid($slot)) {
            return null;
        }

        $value = (float) $slot;
        $rounded = round($value);

        return abs($value - $rounded) < 0.00001 ? (int) $rounded : $value;
    }

    public static function key(int|float|string $slot): int|string|null
    {
        $value = self::normalizeValue($slot);
        if ($value === null) {
            return null;
        }

        if (is_int($value)) {
            return $value;
        }

        return rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');
    }
}
