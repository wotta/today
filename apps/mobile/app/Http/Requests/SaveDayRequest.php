<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Today\Core\AgendaSlot;

/**
 * Validates an incoming DayEntry. Mirrors the extension's DayEntrySchema:
 * check-item shape, agenda slots within 6-26, string values.
 */
class SaveDayRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'checkItems' => ['array'],
            'checkItems.*.id' => ['required', 'string'],
            'checkItems.*.text' => ['present', 'string'],
            'checkItems.*.done' => ['boolean'],
            'checkItems.*.order' => ['integer'],
            'checkItems.*.slot' => ['nullable', 'numeric', $this->agendaSlotRule()],
            'checkItems.*.description' => ['nullable', 'string'],
            'agenda' => ['array'],
            'agenda.*' => ['string'],
            'note' => ['nullable', 'string'],
            'slotNotes' => ['array'],
            'slotNotes.*' => ['string'],
        ];
    }

    private function agendaSlotRule(): \Closure
    {
        return static function (string $attribute, mixed $value, \Closure $fail): void {
            if (! AgendaSlot::isValid($value)) {
                $fail("The {$attribute} field must be a quarter-hour slot between 6 and 26.");
            }
        };
    }
}
