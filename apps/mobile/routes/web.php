<?php

use App\Http\Controllers\DayApiController;
use App\Http\Controllers\PlannerController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\SyncController;
use App\Http\Controllers\UploadController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PlannerController::class, 'show'])->name('planner');

Route::put('/api/day/{date}', [DayApiController::class, 'update'])
    ->where('date', '\d{4}-\d{2}-\d{2}')
    ->name('day.update');

Route::get('/api/sync', [SyncController::class, 'pull'])->name('sync');
Route::post('/api/uploads', [UploadController::class, 'store'])->name('uploads.store');

Route::post('/api/theme', [SettingsController::class, 'setTheme'])->name('theme.update');
Route::post('/api/agenda-slot-minutes', [SettingsController::class, 'setAgendaSlotMinutesApi'])->name('agenda-slot-minutes.update');
Route::get('/api/planner/export', [SettingsController::class, 'exportPlanner'])->name('planner.export');

Route::get('/settings', [SettingsController::class, 'index'])->name('settings');
Route::post('/settings/agenda', [SettingsController::class, 'setAgendaSlotMinutes'])->name('settings.agenda');
Route::post('/settings/import', [SettingsController::class, 'importPlanner'])->name('settings.import');
Route::post('/settings/gist', [SettingsController::class, 'connectGist'])->name('settings.gist.connect');
Route::delete('/settings/gist', [SettingsController::class, 'disconnectGist'])->name('settings.gist.disconnect');
Route::post('/settings/gist/sync', [SettingsController::class, 'syncNow'])->name('settings.gist.sync');
Route::post('/settings/uploads', [SettingsController::class, 'saveS3Config'])->name('settings.uploads.save');
Route::delete('/settings/uploads', [SettingsController::class, 'disconnectS3'])->name('settings.uploads.disconnect');
Route::post('/settings/uploads/test', [SettingsController::class, 'testS3Upload'])->name('settings.uploads.test');
