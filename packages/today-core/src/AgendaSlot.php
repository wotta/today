<?php

declare(strict_types=1);

namespace Today\Core;

/**
 * One hour of the agenda. The planner runs 6:00 → 26:00 (Japanese-planner
 * style, where 24=midnight, 25=1am, 26=2am).
 */
final class AgendaSlot
{
    /** First hour shown in the agenda. */
    public const START_HOUR = 6;

    /** Last hour shown in the agenda. */
    public const END_HOUR = 26;

    public function __construct(
        public readonly int $hour,
        public readonly string $text = '',
        public readonly ?string $note = null,
    ) {
        if ($hour < self::START_HOUR || $hour > self::END_HOUR) {
            throw new \InvalidArgumentException(
                "Agenda hour {$hour} is outside the 6–26 range.",
            );
        }
    }
}
