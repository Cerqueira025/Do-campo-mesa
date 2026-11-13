<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_checks', function (Blueprint $table): void {
            $table->id();
            $table->uuid('run_id')->index();
            $table->string('service', 20)->index();
            $table->string('status', 24)->index();
            $table->string('message');
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamp('checked_at')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_checks');
    }
};
