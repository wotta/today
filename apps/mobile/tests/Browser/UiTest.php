<?php

declare(strict_types=1);

use App\Domain\Settings\SettingRepository;

// Read helpers run in the page. Explicit light/dark override the OS scheme, so
// the theme assertions are deterministic regardless of the runner's scheme.
$darkClass = "document.documentElement.classList.contains('dark')";
$dataTheme = 'document.documentElement.dataset.theme';

it('toggles the appearance live when a theme is picked', function () use ($darkClass, $dataTheme) {
    $page = visit('/settings');

    // Pick Dark → the dark class goes on <html> and data-theme updates.
    $page->click('Dark')
        ->assertScript($darkClass, true)
        ->assertScript($dataTheme, 'dark')
        ->assertAriaAttribute('[data-set-theme="dark"]', 'pressed', 'true');

    // Pick Light → dark class comes back off.
    $page->click('Light')
        ->assertScript($darkClass, false)
        ->assertScript($dataTheme, 'light')
        ->assertNoJavaScriptErrors();
});

it('reflects the stored theme on page load', function () use ($darkClass, $dataTheme) {
    app(SettingRepository::class)->setTheme('dark');

    // The no-FOUC bootstrap reads the server-rendered data-theme and paints dark
    // before first frame; the control opens with Dark pressed.
    visit('/settings')
        ->assertScript($dataTheme, 'dark')
        ->assertScript($darkClass, true)
        ->assertAriaAttribute('[data-set-theme="dark"]', 'pressed', 'true');
});
