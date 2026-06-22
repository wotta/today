<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('day_records', function (Blueprint $table) {
            // ISO date "YYYY-MM-DD" is the natural primary key — one row per day.
            $table->string('date')->primary();
            // Full DayEntry payload (today/core Day::toArray) as JSON.
            $table->json('payload');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('day_records');
    }
};
