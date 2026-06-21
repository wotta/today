<?php

namespace App\Providers;

use App\Domain\Settings\SettingRepository;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Hand the stored appearance to the shared layout so the no-FOUC
        // bootstrap can apply it before first paint.
        View::composer('layouts.app', function ($view) {
            $view->with('appTheme', app(SettingRepository::class)->theme());
        });
    }
}
