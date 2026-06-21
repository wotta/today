<?php

declare(strict_types=1);

use App\Domain\Gist\GistSync;
use App\Domain\Planner\DayRepository;
use App\Domain\Settings\SettingRepository;
use Illuminate\Support\Facades\Http;
use Today\Core\Day;

function connectGist(): void
{
    app(SettingRepository::class)->setGistConfig('pat-123', 'gist-abc');
}

/** @param array<string, array> $days */
function gistBody(array $days): string
{
    return json_encode(['version' => 1, 'exportedAt' => '2026-06-21T00:00:00+00:00', 'days' => $days]);
}

it('upserts a new remote day and stores the etag', function () {
    connectGist();
    Http::fake([
        'api.github.com/gists/*' => Http::response(
            ['files' => ['today-data.json' => ['content' => gistBody([
                '2026-06-21' => ['date' => '2026-06-21', 'checkItems' => [
                    ['id' => 'a', 'text' => 'Ship it', 'done' => false, 'order' => 0],
                ], 'agenda' => []],
            ])]]],
            200,
            ['ETag' => '"v1"'],
        ),
    ]);

    $result = app(GistSync::class)->pull();

    expect($result['changed'])->toBe(['2026-06-21'])
        ->and(app(DayRepository::class)->load('2026-06-21')->checkItems[0]->text)->toBe('Ship it')
        ->and(app(SettingRepository::class)->gistEtag())->toBe('"v1"');
});

it('returns no changes on 304 and keeps the etag', function () {
    connectGist();
    app(SettingRepository::class)->setGistEtag('"v1"');
    Http::fake(['api.github.com/gists/*' => Http::response('', 304)]);

    $result = app(GistSync::class)->pull();

    expect($result['changed'])->toBe([])
        ->and(app(SettingRepository::class)->gistEtag())->toBe('"v1"');
});

it('skips a remote day identical to local', function () {
    connectGist();
    $entry = ['date' => '2026-06-21', 'checkItems' => [
        ['id' => 'a', 'text' => 'Same', 'done' => false, 'order' => 0],
    ], 'agenda' => []];
    app(DayRepository::class)->save(Day::fromArray($entry));

    Http::fake([
        'api.github.com/gists/*' => Http::response(
            ['files' => ['today-data.json' => ['content' => gistBody(['2026-06-21' => $entry])]]],
            200,
            ['ETag' => '"v2"'],
        ),
    ]);

    expect(app(GistSync::class)->pull()['changed'])->toBe([]);
});

it('does nothing when not connected', function () {
    Http::fake();

    expect(app(GistSync::class)->pull())->toBe(['changed' => [], 'days' => []]);
    Http::assertNothingSent();
});
