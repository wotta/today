<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One planner day, keyed by ISO date. `payload` holds the full DayEntry
 * (today/core Day::toArray) — the same wire shape the extension and Gist use.
 */
class DayRecord extends Model
{
    protected $primaryKey = 'date';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['date', 'payload'];

    protected $casts = [
        'payload' => 'array',
    ];
}
