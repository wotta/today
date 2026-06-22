<?php

declare(strict_types=1);

use App\Domain\Settings\SettingRepository;

it('defaults to auto', function () {
    expect(app(SettingRepository::class)->theme())->toBe('auto');
});

it('persists the theme so it survives a fresh repository', function () {
    $this->postJson('/api/theme', ['theme' => 'dark'])
        ->assertOk()
        ->assertJson(['ok' => true]);

    // A new instance reads from storage — i.e. it would survive a restart.
    expect(app(SettingRepository::class)->theme())->toBe('dark');
});

it('rejects an invalid theme', function () {
    $this->postJson('/api/theme', ['theme' => 'neon'])->assertStatus(422);
});
