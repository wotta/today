<?php

declare(strict_types=1);

use App\Domain\Gist\GistException;

it('maps HTTP status codes to a kind', function (int $status, string $kind) {
    expect(GistException::fromStatus($status))
        ->kind->toBe($kind)
        ->status->toBe($status);
})->with([
    'unauthorized' => [401, 'unauthorized'],
    'not found' => [404, 'not-found'],
    'forbidden → rate-limited' => [403, 'rate-limited'],
    'too many requests → rate-limited' => [429, 'rate-limited'],
    'server error → unknown' => [500, 'unknown'],
    'teapot → unknown' => [418, 'unknown'],
]);

it('gives a user-facing message per kind', function (int $status, string $needle) {
    expect(GistException::fromStatus($status)->userMessage())->toContain($needle);
})->with([
    'token hint' => [401, 'token'],
    'gist id hint' => [404, 'Gist ID'],
    'rate limit hint' => [403, 'rate limit'],
    'connection hint' => [500, 'connection'],
]);

it('defaults its message from kind and status', function () {
    expect((new GistException('unknown', 0))->getMessage())
        ->toBe('Gist request failed (unknown, 0)');
});
