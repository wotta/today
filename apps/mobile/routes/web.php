<?php

use App\Http\Controllers\PlannerController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PlannerController::class, 'show'])->name('planner');
