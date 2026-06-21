<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\Settings\SettingRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ThemeTest extends TestCase
{
    use RefreshDatabase;

    public function test_theme_defaults_to_auto(): void
    {
        $this->assertSame('auto', app(SettingRepository::class)->theme());
    }

    public function test_theme_is_persisted_and_survives_a_fresh_repository(): void
    {
        $this->postJson('/api/theme', ['theme' => 'dark'])
            ->assertOk()
            ->assertJson(['ok' => true]);

        // A new instance reads from storage — i.e. it would survive a restart.
        $this->assertSame('dark', app(SettingRepository::class)->theme());
    }

    public function test_invalid_theme_is_rejected(): void
    {
        $this->postJson('/api/theme', ['theme' => 'neon'])
            ->assertStatus(422);
    }
}
