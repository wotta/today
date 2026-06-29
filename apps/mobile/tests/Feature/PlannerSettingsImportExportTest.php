<?php

declare(strict_types=1);

use App\Domain\Planner\DayRepository;
use App\Domain\Settings\SettingRepository;
use Illuminate\Http\UploadedFile;
use Today\Core\Day;

it('persists the agenda granularity setting', function () {
    expect(app(SettingRepository::class)->agendaSlotMinutes())->toBe(60);

    $this->post('/settings/agenda', ['agendaSlotMinutes' => 15])
        ->assertRedirect();

    expect(app(SettingRepository::class)->agendaSlotMinutes())->toBe(15);

    $this->post('/settings/agenda', ['agendaSlotMinutes' => 45])
        ->assertSessionHasErrors('agendaSlotMinutes');
});

it('exports planner data as the shared JSON envelope', function () {
    app(DayRepository::class)->save(Day::fromArray([
        'date' => '2026-06-24',
        'checkItems' => [],
        'agenda' => ['9.50' => 'Focus'],
        'note' => 'Export me',
    ]));

    $response = $this->get('/api/planner/export')->assertOk();
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

    $this->post('/settings/import', ['import' => $file])->assertRedirect();

    $payload = app(DayRepository::class)->load('2026-06-25')->toArray();
    $ids = array_column($payload['checkItems'], 'id');

    expect($ids)->toContain('local')
        ->and($ids)->toContain('remote')
        ->and($payload['agenda']['9'])->toBe('Remote focus')
        ->and($payload['agenda']['9.5'])->toBe('Remote follow-up')
        ->and($payload['note'])->toBe('Remote note')
        ->and($payload['slotNotes']['9.25'])->toBe('Remote slot note')
        ->and($payload['slotNotes']['10'])->toBe('Prep');
});
