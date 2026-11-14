<?php

namespace Database\Factories;

use App\Models\ServiceCheck;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class ServiceCheckFactory extends Factory
{
    protected $model = ServiceCheck::class;

    public function definition(): array
    {
        return ['run_id' => (string) Str::uuid(), 'service' => 'api', 'status' => 'ok', 'message' => 'Serviço respondeu à verificação.', 'duration_ms' => 5, 'checked_at' => now()];
    }
}
