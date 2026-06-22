<?php

declare(strict_types=1);

namespace App\Domain\Gist;

use RuntimeException;

/**
 * Typed Gist failure so the UI can tell auth vs missing vs rate-limit apart.
 * Mirrors the extension's GistError.
 */
class GistException extends RuntimeException
{
    public function __construct(
        public readonly string $kind, // unauthorized | not-found | rate-limited | unknown
        public readonly int $status,
        ?string $message = null,
    ) {
        parent::__construct($message ?? "Gist request failed ({$kind}, {$status})");
    }

    public static function fromStatus(int $status): self
    {
        $kind = match (true) {
            $status === 401 => 'unauthorized',
            $status === 404 => 'not-found',
            $status === 403, $status === 429 => 'rate-limited',
            default => 'unknown',
        };

        return new self($kind, $status);
    }

    public function userMessage(): string
    {
        return match ($this->kind) {
            'unauthorized' => 'Invalid token — check the PAT has gist scope',
            'not-found' => 'Gist not found — check the Gist ID',
            'rate-limited' => 'GitHub rate limit hit — try again shortly',
            default => 'Could not reach GitHub — check your connection',
        };
    }
}
