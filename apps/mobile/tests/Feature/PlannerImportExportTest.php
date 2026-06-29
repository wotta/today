<?php

declare(strict_types=1);

use App\Domain\Planner\DayRepository;
use App\Domain\Settings\SettingRepository;
use Illuminate\Http\UploadedFile;
use Today\Core\Day;

function plannerEnvelope(array $days): string
{
    return json_encode(['version' => 1, 'exportedAt' => '2026-06-27T00:00:00+00:00', 'days' => $days]);
}

it('defaults agenda granularity to 60 minutes and persists allowed values', function () {
    expect(app(SettingRepository::class)->agendaSlotMinutes())->toBe(60);

    $this->post('/settings/agenda', ['agendaSlotMinutes' => 15])
        ->assertRedirect();

    expect(app(SettingRepository::class)->agendaSlotMinutes())->toBe(15);
});

it('rejects unsupported agenda granularity values', function () {
    $this->post('/settings/agenda', ['agendaSlotMinutes' => 45])
        ->assertSessionHasErrors('agendaSlotMinutes');
});

it('exports locally stored planner days as the shared json envelope', function () {
    app(DayRepository::class)->save(Day::fromArray([
        'date' => '2026-06-27',
        'checkItems' => [['id' => 'a', 'text' => 'Export me', 'done' => false, 'order' => 0]],
        'agenda' => ['9' => 'Focus'],
        'note' => 'Day note',
        'slotNotes' => ['9.25' => 'Slot note'],
    ]));

    $response = $this->get('/api/planner/export')
        ->assertOk()
        ->assertHeader('Content-Type', 'application/json');

    $payload = json_decode($response->getContent(), true);

    expect($payload['version'])->toBe(1)
        ->and($payload['days']['2026-06-27']['checkItems'][0]['text'])->toBe('Export me')
        ->and($payload['days']['2026-06-27']['slotNotes']['9.25'])->toBe('Slot note');
});

it('imports json by merging existing days instead of replacing them', function () {
    app(DayRepository::class)->save(Day::fromArray([
        'date' => '2026-06-27',
        'checkItems' => [
            ['id' => 'a', 'text' => 'Keep text', 'done' => false, 'order' => 0, 'description' => 'Keep detail'],
            ['id' => 'local', 'text' => 'Local only', 'done' => false, 'order' => 1],
        ],
        'agenda' => ['9' => 'Local agenda', '10' => 'Keep agenda'],
        'note' => 'Keep note',
        'slotNotes' => ['9.25' => 'Local slot note', '10' => 'Keep slot note'],
    ]));

    $file = UploadedFile::fake()->createWithContent('today.json', plannerEnvelope([
        '2026-06-27' => [
            'date' => '2026-06-27',
            'checkItems' => [
                ['id' => 'a', 'done' => true, 'order' => 2],
                ['id' => 'remote', 'text' => 'Remote only', 'done' => false, 'order' => 3],
            ],
            'agenda' => ['9' => 'Remote agenda'],
            'slotNotes' => ['9.25' => 'Remote slot note'],
        ],
    ]));

    $this->post('/settings/import', ['import' => $file])
        ->assertRedirect()
        ->assertSessionHas('status.message', 'Imported 1 day');

    $payload = app(DayRepository::class)->load('2026-06-27')->toArray();
    $items = collect($payload['checkItems'])->keyBy('id');

    expect($items['a']['text'])->toBe('Keep text')
        ->and($items['a']['done'])->toBeTrue()
        ->and($items['a']['description'])->toBe('Keep detail')
        ->and($items['local']['text'])->toBe('Local only')
        ->and($items['remote']['text'])->toBe('Remote only')
        ->and($payload['agenda']['9'])->toBe('Remote agenda')
        ->and($payload['agenda']['10'])->toBe('Keep agenda')
        ->and($payload['note'])->toBe('Keep note')
        ->and($payload['slotNotes']['9.25'])->toBe('Remote slot note')
        ->and($payload['slotNotes']['10'])->toBe('Keep slot note');
});

it('rejects unrecognised planner import files', function () {
    $file = UploadedFile::fake()->createWithContent('bad.json', json_encode(['days' => []]));

    $this->post('/settings/import', ['import' => $file])
        ->assertRedirect()
        ->assertSessionHas('status.kind', 'error');
});
