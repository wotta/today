<?php

declare(strict_types=1);

it('renders the planner shell', function () {
    $page = visit('/');

    $page->assertSee('Check')
        ->assertSee('Agenda')
        ->assertNoJavascriptErrors();
});
