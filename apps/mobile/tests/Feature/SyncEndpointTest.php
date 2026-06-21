<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\Planner\DayRepository;
use App\Domain\Settings\SettingRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SyncEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_sync_endpoint_returns_no_changes_when_not_connected(): void
    {
        Http::fake();

        $this->getJson('/api/sync')
            ->assertOk()
            ->assertExactJson(['changed' => [], 'days' => []]);
    }

    public function test_sync_endpoint_reports_changed_days(): void
    {
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
    }

    public function test_day_save_succeeds_locally_even_when_gist_push_fails(): void
    {
        app(SettingRepository::class)->setGistConfig('pat-123', 'gist-abc');
        Http::fake(['api.github.com/*' => Http::response('boom', 500)]);

        $this->putJson('/api/day/2026-06-21', [
            'checkItems' => [['id' => 'a', 'text' => 'Local edit', 'done' => false, 'order' => 0]],
            'agenda' => [],
        ])
            ->assertOk()
            ->assertJson(['ok' => true, 'synced' => false]);

        $this->assertSame('Local edit', app(DayRepository::class)->load('2026-06-21')->checkItems[0]->text);
    }
}
