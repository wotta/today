<?php

declare(strict_types=1);

namespace Today\Core;

/**
 * A single checklist item. Mirrors the extension's @today/types CheckItem so
 * the wire format stays identical across the extension and the NativePHP apps.
 */
final class CheckItem
{
    public function __construct(
        public readonly string $id,
        public readonly string $text,
        public readonly bool $done,
        public readonly int $order,
        /** Optional long-form detail shown in the item's view/edit modal. */
        public readonly ?string $description = null,
        /** Optional agenda hour (6–26) this item is pinned to. Null = unpinned. */
        public readonly ?int $slot = null,
    ) {
    }

    public static function fromArray(array $data): self
    {
        return new self(
            id: (string) $data['id'],
            text: (string) $data['text'],
            done: (bool) ($data['done'] ?? false),
            order: (int) ($data['order'] ?? 0),
            description: isset($data['description']) ? (string) $data['description'] : null,
            slot: isset($data['slot']) ? (int) $data['slot'] : null,
        );
    }

    public function toArray(): array
    {
        return array_filter([
            'id' => $this->id,
            'text' => $this->text,
            'done' => $this->done,
            'order' => $this->order,
            'description' => $this->description,
            'slot' => $this->slot,
        ], static fn ($v) => $v !== null);
    }
}
