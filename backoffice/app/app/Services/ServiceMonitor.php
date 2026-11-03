<?php

namespace App\Services;

use App\Models\ServiceCheck;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\Yaml\Yaml;
use Throwable;

class ServiceMonitor
{
    public function __construct(private MarketplaceApi $api) {}

    public function run(string $token): array
    {
        $results = [];
        $results[] = $this->check('api', function (): void {
            $response = $this->api->client()->get('/api/health');
            if (! $response->successful() || $response->json('status') !== 'ok') {
                throw new \RuntimeException;
            }
        });
        $started = hrtime(true);
        try {
            $response = $this->api->client($token)->get('/api/admin/services');
            $remote = $response->json('results');
            if (! $response->successful() || ! is_array($remote)) {
                throw new \RuntimeException;
            }
            foreach (['mongodb', 'socketio'] as $service) {
                $item = collect($remote)->firstWhere('service', $service);
                if (! is_array($item) || ! in_array($item['status'] ?? null, ['ok', 'failure']) || ! is_numeric($item['durationMs'] ?? null)) {
                    throw new \RuntimeException;
                }
                $results[] = $this->result($service, $item['status'], $item['status'] === 'ok' ? 'Serviço respondeu à verificação.' : 'O serviço não respondeu corretamente no prazo de cinco segundos.', (int) $item['durationMs']);
            }
        } catch (Throwable) {
            $results = array_values(array_filter($results, fn (array $item): bool => ! in_array($item['service'], ['mongodb', 'socketio'])));
            foreach (['mongodb', 'socketio'] as $service) {
                $results[] = $this->result($service, 'unknown', 'A API não permitiu obter um diagnóstico deste serviço.', (int) ((hrtime(true) - $started) / 1e6));
            }
        }
        $results[] = $this->check('swagger', function (): void {
            $started = microtime(true);
            $page = $this->api->client()->get('/api-docs/');
            $remaining = 5 - (microtime(true) - $started);
            if ($remaining <= 0) {
                throw new \RuntimeException;
            }
            $specification = $this->api->client()->timeout($remaining)->get('/api-docs/openapi.yaml');
            $spec = Yaml::parse($specification->body());
            if (! $page->successful() || ! str_contains($page->body(), 'swagger-ui') || ! $specification->successful() || ! is_array($spec) || ! isset($spec['openapi'], $spec['paths'])) {
                throw new \RuntimeException;
            }
        });
        $results[] = $this->result('storage', 'not_implemented', 'O projeto não tem um serviço de armazenamento de imagens integrado.', null);
        $runId = (string) Str::uuid();
        DB::transaction(function () use ($results, $runId): void {
            ServiceCheck::where('checked_at', '<', now()->subDays(30))->delete();
            foreach ($results as $result) {
                ServiceCheck::create(['run_id' => $runId, ...$result]);
            }
        });

        return $results;
    }

    private function check(string $service, callable $operation): array
    {
        $start = hrtime(true);
        try {
            $operation();
            $status = 'ok';
            $message = 'Serviço respondeu à verificação.';
        } catch (Throwable) {
            $status = 'failure';
            $message = 'O serviço não respondeu corretamente à verificação.';
        }

        return $this->result($service, $status, $message, (int) ((hrtime(true) - $start) / 1e6));
    }

    private function result(string $service, string $status, string $message, ?int $duration): array
    {
        return ['service' => $service, 'status' => $status, 'message' => $message, 'duration_ms' => $duration, 'checked_at' => now()];
    }
}
