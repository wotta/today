<?php

declare(strict_types=1);

use App\Domain\Planner\DayRepository;
use App\Domain\Settings\SettingRepository;
use Illuminate\Support\Facades\Http;

it('returns no changes when not connected', function () {
    Http::fake();

    $this->getJson('/api/sync')
        ->assertOk()
        ->assertExactJson(['changed' => [], 'days' => []]);
});

it('reports changed days', function () {
    app(SettingRepository::class)->setGistConfig('pat-123', 'gist-abc');
    Http::fake([
        'api.github.com/gists/*' => Http::response(
            ['files' => ['today-data.json' => ['content' => json_encode([
                'version' => 1,
                'exportedAt' => '2026-06-21T00:00:00+00:00',
                'days' => ['2026-06-21' => ['date' => '2026-06-21', 'checkItems' => [], 'agenda' => ['9' => 'Standup']]],
            ])]]],
            200,
            ['ETag' => '"v1"'],
        ),
    ]);

    $this->getJson('/api/sync')
        ->assertOk()
        ->assertJsonPath('changed', ['2026-06-21'])
        ->assertJsonPath('days.2026-06-21.agenda.9', 'Standup');
});

it('saves a day locally even when the gist push fails', function () {
    app(SettingRepository::class)->setGistConfig('pat-123', 'gist-abc');
    Http::fake(['api.github.com/*' => Http::response('boom', 500)]);

    $this->putJson('/api/day/2026-06-21', [
        'checkItems' => [['id' => 'a', 'text' => 'Local edit', 'done' => false, 'order' => 0]],
        'agenda' => [],
    ])
        ->assertOk()
        ->assertJson(['ok' => true, 'synced' => false]);

    expect(app(DayRepository::class)->load('2026-06-21')->checkItems[0]->text)->toBe('Local edit');
});

it('preserves extension payload fields and fractional slots when saving a day', function () {
    Http::fake();

    $this->putJson('/api/day/2026-06-22', [
        'checkItems' => [[
            'id' => 'a',
            'text' => 'Detailed task',
            'done' => false,
            'order' => 0,
            'description' => 'Keep this detail',
            'slot' => 14.25,
        ]],
        'agenda' => ['9.5' => 'Deep work'],
        'note' => 'Day-level note',
        'slotNotes' => ['9.25' => 'Prep note'],
    ])
        ->assertOk()
        ->assertJson(['ok' => true, 'synced' => false]);

    $payload = app(DayRepository::class)->load('2026-06-22')->toArray();

    expect($payload['checkItems'][0]['description'])->toBe('Keep this detail')
        ->and($payload['checkItems'][0]['slot'])->toBe(14.25)
        ->and($payload['agenda']['9.5'])->toBe('Deep work')
        ->and($payload['note'])->toBe('Day-level note')
        ->and($payload['slotNotes']['9.25'])->toBe('Prep note');
});

it('rejects check item slots that are not quarter-hour increments', function () {
    $this->putJson('/api/day/2026-06-22', [
        'checkItems' => [['id' => 'a', 'text' => 'Bad slot', 'done' => false, 'order' => 0, 'slot' => 14.1]],
        'agenda' => [],
    ])->assertStatus(422);
});

it('pushes note-only days to the gist as meaningful content', function () {
    app(SettingRepository::class)->setGistConfig('pat-123', 'gist-abc');
    Http::fake([
        'api.github.com/gists/gist-abc' => Http::sequence()
            ->push([
                'files' => ['today-data.json' => ['content' => json_encode([
                    'version' => 1,
                    'exportedAt' => '2026-06-21T00:00:00+00:00',
                    'days' => [],
                ])]],
            ], 200, ['ETag' => '"v1"'])
            ->push([], 200, ['ETag' => '"v2"']),
    ]);

    $this->putJson('/api/day/2026-06-23', [
        'checkItems' => [],
        'agenda' => [],
        'note' => 'Gist note',
        'slotNotes' => ['10.25' => 'Slot note'],
    ])
        ->assertOk()
        ->assertJson(['ok' => true, 'synced' => true]);

    Http::assertSent(function ($request) {
        if ($request->method() !== 'PATCH') {
            return false;
        }

        $data = $request->data();
        $content = $data['files']['today-data.json']['content'] ?? null;
        $payload = json_decode((string) $content, true);

        return ($payload['days']['2026-06-23']['note'] ?? null) === 'Gist note'
            && ($payload['days']['2026-06-23']['slotNotes']['10.25'] ?? null) === 'Slot note';
    });
});
