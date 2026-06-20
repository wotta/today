<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Today\Core\AgendaSlot;

/**
 * Validates an incoming DayEntry. Mirrors the extension's DayEntrySchema:
 * check-item shape, agenda hours within 6–26, string values.
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
            'checkItems.*.slot' => ['nullable', 'integer', 'between:' . AgendaSlot::START_HOUR . ',' . AgendaSlot::END_HOUR],
            'checkItems.*.description' => ['nullable', 'string'],
            'agenda' => ['array'],
            'agenda.*' => ['string'],
        ];
    }
}
