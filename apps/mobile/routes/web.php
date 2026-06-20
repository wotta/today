<?php

use App\Http\Controllers\DayApiController;
use App\Http\Controllers\PlannerController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PlannerController::class, 'show'])->name('planner');

Route::put('/api/day/{date}', [DayApiController::class, 'update'])
    ->where('date', '\d{4}-\d{2}-\d{2}')
    ->name('day.update');
