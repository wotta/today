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

it('preserves extension fields and fractional slots from remote days', function () {
    connectGist();
    Http::fake([
        'api.github.com/gists/*' => Http::response(
            ['files' => ['today-data.json' => ['content' => gistBody([
                '2026-06-22' => [
                    'date' => '2026-06-22',
                    'checkItems' => [[
                        'id' => 'a',
                        'text' => 'Remote detail',
                        'done' => false,
                        'order' => 0,
                        'description' => 'Remote description',
                        'slot' => 15.75,
                    ]],
                    'agenda' => ['9.5' => 'Remote focus'],
                    'note' => 'Remote day note',
                    'slotNotes' => ['9.25' => 'Remote slot note'],
                ],
            ])]]],
            200,
            ['ETag' => '"v3"'],
        ),
    ]);

    app(GistSync::class)->pull();

    $payload = app(DayRepository::class)->load('2026-06-22')->toArray();

    expect($payload['checkItems'][0]['description'])->toBe('Remote description')
        ->and($payload['checkItems'][0]['slot'])->toBe(15.75)
        ->and($payload['agenda']['9.5'])->toBe('Remote focus')
        ->and($payload['note'])->toBe('Remote day note')
        ->and($payload['slotNotes']['9.25'])->toBe('Remote slot note');
});

it('merges remote days without replacing fields omitted by the payload', function () {
    connectGist();
    app(DayRepository::class)->save(Day::fromArray([
        'date' => '2026-06-24',
        'checkItems' => [
            ['id' => 'a', 'text' => 'Local text', 'done' => false, 'order' => 0, 'description' => 'Local detail'],
            ['id' => 'local', 'text' => 'Local only', 'done' => false, 'order' => 1],
        ],
        'agenda' => ['9' => 'Local agenda', '10' => 'Keep agenda'],
        'note' => 'Local note',
        'slotNotes' => ['9.25' => 'Local slot note', '10' => 'Keep slot note'],
    ]));

    Http::fake([
        'api.github.com/gists/*' => Http::response(
            ['files' => ['today-data.json' => ['content' => gistBody([
                '2026-06-24' => [
                    'date' => '2026-06-24',
                    'checkItems' => [
                        ['id' => 'a', 'done' => true, 'order' => 2],
                        ['id' => 'remote', 'text' => 'Remote only', 'done' => false, 'order' => 3],
                    ],
                    'agenda' => ['9' => 'Remote agenda'],
                    'slotNotes' => ['9.25' => 'Remote slot note'],
                ],
            ])]]],
            200,
            ['ETag' => '"v4"'],
        ),
    ]);

    app(GistSync::class)->pull();

    $payload = app(DayRepository::class)->load('2026-06-24')->toArray();
    $items = collect($payload['checkItems'])->keyBy('id');

    expect($items['a']['text'])->toBe('Local text')
        ->and($items['a']['done'])->toBeTrue()
        ->and($items['a']['description'])->toBe('Local detail')
        ->and($items['local']['text'])->toBe('Local only')
        ->and($items['remote']['text'])->toBe('Remote only')
        ->and($payload['agenda']['9'])->toBe('Remote agenda')
        ->and($payload['agenda']['10'])->toBe('Keep agenda')
        ->and($payload['note'])->toBe('Local note')
        ->and($payload['slotNotes']['9.25'])->toBe('Remote slot note')
        ->and($payload['slotNotes']['10'])->toBe('Keep slot note');
});

it('stores note-only days locally as meaningful content', function () {
    app(DayRepository::class)->save(Day::fromArray([
        'date' => '2026-06-23',
        'checkItems' => [],
        'agenda' => [],
        'note' => 'Local note',
        'slotNotes' => ['8.25' => 'Local slot note'],
    ]));

    $payload = app(DayRepository::class)->load('2026-06-23')->toArray();

    expect($payload['note'])->toBe('Local note')
        ->and($payload['slotNotes']['8.25'])->toBe('Local slot note');
});

it('does nothing when not connected', function () {
    Http::fake();

    expect(app(GistSync::class)->pull())->toBe(['changed' => [], 'days' => []]);
    Http::assertNothingSent();
});
