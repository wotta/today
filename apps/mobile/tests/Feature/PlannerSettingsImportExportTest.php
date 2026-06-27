<?php

declare(strict_types=1);

use App\Domain\Planner\DayRepository;
use App\Domain\Settings\SettingRepository;
use Illuminate\Http\UploadedFile;
use Today\Core\Day;

it('persists the agenda granularity setting', function () {
    expect(app(SettingRepository::class)->agendaGranularity())->toBe(60);

    $this->post('/settings/planner/granularity', ['agendaGranularity' => 15])
        ->assertRedirect();

    expect(app(SettingRepository::class)->agendaGranularity())->toBe(15);

    $this->post('/settings/planner/granularity', ['agendaGranularity' => 45])
        ->assertSessionHasErrors('agendaGranularity');
});

it('renders planner agenda slots from the stored granularity', function () {
    app(SettingRepository::class)->setAgendaGranularity(30);
    $this->withoutVite();

    $this->get('/')
        ->assertOk()
        ->assertSee('30 min')
        ->assertSee('Agenda at 6:30');
});

it('exports planner data as the shared JSON envelope', function () {
    app(DayRepository::class)->save(Day::fromArray([
        'date' => '2026-06-24',
        'checkItems' => [],
        'agenda' => ['9.50' => 'Focus'],
        'note' => 'Export me',
    ]));

    $response = $this->get('/settings/planner/export')->assertOk();
    $payload = json_decode($response->getContent(), true);

    expect($payload['version'])->toBe(1)
        ->and($payload['days']['2026-06-24']['agenda']['9.5'])->toBe('Focus')
        ->and($payload['days']['2026-06-24']['note'])->toBe('Export me');
});

it('imports JSON by merging existing days field by field', function () {
    app(DayRepository::class)->save(Day::fromArray([
        'date' => '2026-06-25',
        'checkItems' => [['id' => 'local', 'text' => 'Local task', 'done' => false, 'order' => 0]],
        'agenda' => ['9' => 'Local focus'],
        'note' => 'Local note',
        'slotNotes' => ['9.25' => 'Local slot note'],
    ]));

    $file = UploadedFile::fake()->createWithContent('today.json', json_encode([
        'version' => 1,
        'exportedAt' => '2026-06-25T00:00:00+00:00',
        'days' => [
            '2026-06-25' => [
                'date' => '2026-06-25',
                'checkItems' => [['id' => 'remote', 'text' => 'Remote task', 'done' => false, 'order' => 0]],
                'agenda' => ['9' => 'Remote focus', '9.5' => 'Remote follow-up'],
                'note' => 'Remote note',
                'slotNotes' => ['9.25' => 'Remote slot note', '10' => 'Prep'],
            ],
        ],
    ]));

    $this->post('/settings/planner/import', ['plannerData' => $file])->assertRedirect();

    $payload = app(DayRepository::class)->load('2026-06-25')->toArray();

    expect(array_column($payload['checkItems'], 'id'))->toBe(['local', 'remote'])
        ->and($payload['agenda']['9'])->toBe("Local focus\n\nRemote focus")
        ->and($payload['agenda']['9.5'])->toBe('Remote follow-up')
        ->and($payload['note'])->toBe("Local note\n\nRemote note")
        ->and($payload['slotNotes']['9.25'])->toBe("Local slot note\n\nRemote slot note")
        ->and($payload['slotNotes'][10])->toBe('Prep');
});
