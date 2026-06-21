<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\Gist\GistSync;
use App\Domain\Planner\DayRepository;
use App\Domain\Settings\SettingRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;
use Today\Core\Day;

class GistSyncTest extends TestCase
{
    use RefreshDatabase;

    private function connect(): void
    {
        app(SettingRepository::class)->setGistConfig('pat-123', 'gist-abc');
    }

    /** @param array<string, array> $days */
    private function gistBody(array $days): string
    {
        return json_encode(['version' => 1, 'exportedAt' => '2026-06-21T00:00:00+00:00', 'days' => $days]);
    }

    public function test_pull_upserts_a_new_remote_day_and_stores_the_etag(): void
    {
        $this->connect();
        Http::fake([
            'api.github.com/gists/*' => Http::response(
                ['files' => ['today-data.json' => ['content' => $this->gistBody([
                    '2026-06-21' => ['date' => '2026-06-21', 'checkItems' => [
                        ['id' => 'a', 'text' => 'Ship it', 'done' => false, 'order' => 0],
                    ], 'agenda' => []],
                ])]]],
                200,
                ['ETag' => '"v1"'],
            ),
        ]);

        $result = app(GistSync::class)->pull();

        $this->assertSame(['2026-06-21'], $result['changed']);
        $this->assertSame('Ship it', app(DayRepository::class)->load('2026-06-21')->checkItems[0]->text);
        $this->assertSame('"v1"', app(SettingRepository::class)->gistEtag());
    }

    public function test_pull_returns_no_changes_on_304_and_keeps_the_etag(): void
    {
        $this->connect();
        app(SettingRepository::class)->setGistEtag('"v1"');
        Http::fake(['api.github.com/gists/*' => Http::response('', 304)]);

        $result = app(GistSync::class)->pull();

        $this->assertSame([], $result['changed']);
        $this->assertSame('"v1"', app(SettingRepository::class)->gistEtag());
    }

    public function test_pull_skips_a_remote_day_identical_to_local(): void
    {
        $this->connect();
        $entry = ['date' => '2026-06-21', 'checkItems' => [
            ['id' => 'a', 'text' => 'Same', 'done' => false, 'order' => 0],
        ], 'agenda' => []];
        app(DayRepository::class)->save(Day::fromArray($entry));

        Http::fake([
            'api.github.com/gists/*' => Http::response(
                ['files' => ['today-data.json' => ['content' => $this->gistBody(['2026-06-21' => $entry])]]],
                200,
                ['ETag' => '"v2"'],
            ),
        ]);

        $result = app(GistSync::class)->pull();

        $this->assertSame([], $result['changed']);
    }

    public function test_pull_does_nothing_when_not_connected(): void
    {
        Http::fake();

        $result = app(GistSync::class)->pull();

        $this->assertSame(['changed' => [], 'days' => []], $result);
        Http::assertNothingSent();
    }
}
