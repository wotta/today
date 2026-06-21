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
