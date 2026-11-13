<?php

namespace Tests\Feature;

use App\Http\Controllers\ServiceController;
use App\Models\ServiceCheck;
use App\Services\ServiceMonitor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Yaml\Yaml;
use Tests\TestCase;

class BackofficeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('k', 32)), 'backoffice.site_url' => 'http://127.0.0.1:5173', 'backoffice.api_url' => 'http://127.0.0.1:3000', 'backoffice.secret' => str_repeat('s', 32)]);
        Http::preventStrayRequests();
    }

    private function sessionData(): array
    {
        return ['backoffice' => ['token' => 'private-token', 'expires_at' => time() + 3600]];
    }

    private function fakeServices(): void
    {
        Http::fake([
            '*/api/auth/eu' => Http::response(['nome' => 'Administrador', 'papel' => 'administrador']),
            '*/api/health' => Http::response(['status' => 'ok']),
            '*/api/admin/services' => Http::response(['results' => [
                ['service' => 'mongodb', 'status' => 'ok', 'durationMs' => 2],
                ['service' => 'socketio', 'status' => 'ok', 'durationMs' => 3],
            ]]),
            '*/api-docs/' => Http::response('<html>swagger-ui</html>'),
            '*/api-docs/openapi.yaml' => Http::response("openapi: 3.0.3\npaths: {}"),
        ]);
    }

    public function test_entry_creates_state_and_redirects_only_to_configured_site(): void
    {
        $response = $this->get('/entrar?redirect=https://example.org');
        $state = session('entry.state');
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $state);
        $response->assertRedirect('http://127.0.0.1:5173/admin/backoffice?state='.$state);
        Http::assertNothingSent();
    }

    public function test_valid_exchange_creates_private_session_and_replay_fails(): void
    {
        $state = str_repeat('a', 64);
        Http::fake(['*/api/internal/backoffice/exchange' => Http::response(['token' => 'private-token', 'expiresAt' => time() + 3600, 'utilizador' => ['papel' => 'administrador']])]);
        $response = $this->withSession(['entry' => ['state' => $state, 'expires_at' => time() + 60]])->withHeader('Origin', 'http://127.0.0.1:5173')->post('/entrada', ['state' => $state, 'code' => str_repeat('b', 64)]);
        $response->assertRedirect('/servicos')->assertSessionHas('backoffice.token', 'private-token')->assertSessionMissing('entry');
        $this->post('/entrada', ['state' => $state, 'code' => str_repeat('b', 64)])->assertForbidden();
        $this->assertStringNotContainsString('private-token', $response->getContent());
    }

    public function test_wrong_origin_state_and_expired_entry_are_refused_before_exchange(): void
    {
        foreach ([['http://evil.test', 'a', 60], ['http://127.0.0.1:5173', 'c', 60], ['http://127.0.0.1:5173', 'a', -1]] as [$origin, $state, $seconds]) {
            $this->withSession(['entry' => ['state' => str_repeat('a', 64), 'expires_at' => time() + $seconds]])->withHeader('Origin', $origin)->post('/entrada', ['state' => str_repeat($state, 64), 'code' => str_repeat('b', 64)])->assertForbidden();
        }
        Http::assertNothingSent();
    }

    public function test_expired_session_cannot_open_history(): void
    {
        $this->withSession(['backoffice' => ['token' => 'old', 'expires_at' => time() - 1]])->get('/historico')->assertRedirect('/entrar');
        Http::assertNothingSent();
    }

    public function test_role_change_and_unauthorized_response_invalidate_session(): void
    {
        foreach ([Http::response(['papel' => 'comprador']), Http::response([], 401), Http::response([], 403)] as $reply) {
            Http::fake(['*/api/auth/eu' => $reply]);
            $this->withSession($this->sessionData())->get('/historico')->assertForbidden()->assertSessionMissing('backoffice');
        }
    }

    public function test_api_connection_failure_blocks_all_protected_content_but_keeps_session_for_retry(): void
    {
        ServiceCheck::factory()->create(['message' => 'HISTORICO_PRIVADO']);
        Http::fake(['*/api/auth/eu' => Http::failedConnection()]);
        $this->withSession($this->sessionData())->get('/historico?service=api')
            ->assertStatus(503)
            ->assertSee('A validação da sessão está temporariamente indisponível.')
            ->assertSee(route('history', ['service' => 'api']))
            ->assertDontSee('HISTORICO_PRIVADO')
            ->assertSessionHas('backoffice');
        $this->postJson('/servicos/verificar')->assertStatus(503)
            ->assertJsonPath('message', 'A validação da sessão está temporariamente indisponível. Tente novamente dentro de instantes.')
            ->assertJsonMissingPath('html');
        $this->assertDatabaseCount('service_checks', 1);
    }

    public function test_page_and_history_reads_do_not_create_checks(): void
    {
        $this->fakeServices();
        $this->withSession($this->sessionData())->get('/servicos')->assertOk();
        $this->get('/historico')->assertOk();
        $this->assertDatabaseCount('service_checks', 0);
        Http::assertSentCount(2);
    }

    public function test_check_saves_five_results_and_removes_only_records_older_than_thirty_days(): void
    {
        $this->fakeServices();
        ServiceCheck::factory()->create(['checked_at' => now()->subDays(31)]);
        ServiceCheck::factory()->create(['checked_at' => now()->subDays(29), 'service' => 'storage', 'status' => 'not_implemented', 'message' => 'Mensagem histórica']);
        $response = $this->withSession($this->sessionData())->postJson('/servicos/verificar')->assertOk();
        $html = $response->json('html');
        $this->assertSame(5, substr_count($html, '<article '));
        $this->assertStringContainsString('Armazenamento Cloud', $html);
        $this->assertStringContainsString('Não implementado', $html);
        $this->assertStringContainsString('As fotografias dos produtos são guardadas localmente.', $html);
        $this->get('/historico?service=storage&status=not_implemented')->assertOk()->assertSee('2 resultados')->assertSee('Mensagem histórica');
        $this->assertDatabaseCount('service_checks', 6);
        $this->assertDatabaseHas('service_checks', ['service' => 'storage', 'status' => 'not_implemented']);
        $this->assertDatabaseHas('service_checks', ['service' => 'swagger', 'status' => 'ok']);
        $this->assertSame(1, ServiceCheck::where('checked_at', '>=', now()->subMinute())->distinct()->count('run_id'));
    }

    public function test_check_returns_its_own_cards_when_another_run_is_newer(): void
    {
        $this->fakeServices();
        ServiceCheck::created(function (ServiceCheck $check): void {
            if ($check->service === 'storage') {
                ServiceCheck::factory()->make(['checked_at' => now()->addSecond(), 'message' => 'Resultado de outra execução'])->saveQuietly();
            }
        });

        $html = $this->withSession($this->sessionData())->postJson('/servicos/verificar')->assertOk()->json('html');

        $this->assertSame(5, substr_count($html, '<article '));
        $this->assertStringNotContainsString('Resultado de outra execução', $html);
        $this->get('/servicos')->assertOk()->assertSee('Resultado de outra execução');
    }

    public function test_dependency_failure_is_unknown_and_bad_service_responses_are_failures(): void
    {
        Http::fake([
            '*/api/auth/eu' => Http::response(['nome' => 'Admin', 'papel' => 'administrador']),
            '*/api/health' => Http::response(['status' => 'wrong']),
            '*/api/admin/services' => Http::failedConnection(),
            '*/api-docs/' => Http::response('wrong'),
            '*/api-docs/openapi.yaml' => Http::response('not a specification'),
        ]);
        $this->withSession($this->sessionData())->postJson('/servicos/verificar')->assertOk();
        $this->assertDatabaseHas('service_checks', ['service' => 'api', 'status' => 'failure']);
        $this->assertDatabaseHas('service_checks', ['service' => 'mongodb', 'status' => 'unknown']);
        $this->assertDatabaseHas('service_checks', ['service' => 'swagger', 'status' => 'failure']);
    }

    public function test_recent_median_uses_up_to_twenty_successful_timings_in_the_last_thirty_days(): void
    {
        $this->fakeServices();
        ServiceCheck::factory()->count(20)->create(['checked_at' => now()->subDays(2), 'duration_ms' => 900]);
        ServiceCheck::factory()->count(19)->create(['checked_at' => now()->subDay(), 'duration_ms' => 40]);
        ServiceCheck::factory()->create(['checked_at' => now()->subMinute(), 'status' => 'failure', 'duration_ms' => 5000]);
        ServiceCheck::factory()->create(['checked_at' => now()->subDays(31), 'service' => 'mongodb', 'duration_ms' => 5000]);

        $this->withSession($this->sessionData())->get('/servicos')->assertOk()->assertSee('40 ms (20 medições)');
        $html = $this->postJson('/servicos/verificar')->assertOk()->json('html');
        $this->assertStringContainsString('40 ms (20 medições)', $html);
        $this->assertStringContainsString('2 ms (1 medição)', $html);
        $this->assertSame(4, substr_count($html, 'Mediana recente'));
        $this->assertSame(1, substr_count($html, 'Evolução da duração'));
        $this->assertMatchesRegularExpression('/'.str_repeat('40, ', 19).'\d+"/', $html);
    }

    public function test_chart_shows_a_rounded_scale_and_highlights_the_latest_measurement(): void
    {
        $template = '<x-service-timing-chart :durations="$durations" />';

        $this->blade($template, ['durations' => [3, 3, 28]])
            ->assertSeeInOrder(['40 ms', '30 ms', '20 ms', '10 ms', '0 ms'])
            ->assertSee('Mais recente · 28 ms');
        $this->blade($template, ['durations' => [0, 0]])
            ->assertSeeInOrder(['4 ms', '3 ms', '2 ms', '1 ms', '0 ms'])
            ->assertSee('Mais recente · 0 ms');
    }

    public function test_history_filters_and_paginates_without_triggering_checks(): void
    {
        $this->fakeServices();
        ServiceCheck::factory()->count(27)->create();
        ServiceCheck::factory()->create(['service' => 'mongodb', 'status' => 'failure']);
        $response = $this->withSession($this->sessionData())->get('/historico?service=api&status=ok');
        $response->assertOk()->assertSee('27 resultados')->assertSee('Seguinte')->assertDontSee('MongoDB</h2>', false);
        $this->get('/historico?service=api&status=ok&page=2')->assertOk()->assertSee('Anterior');
        $this->assertDatabaseCount('service_checks', 28);
        Http::assertSentCount(2);
    }

    public function test_same_session_cannot_start_concurrent_checks(): void
    {
        $this->fakeServices();
        $request = Request::create('/servicos/verificar', 'POST');
        $request->setLaravelSession(app('session')->driver());
        $request->session()->put($this->sessionData());
        $lock = Cache::store('file')->lock('service-check:'.hash('sha256', $request->session()->getId()), 45);
        $this->assertTrue($lock->get());
        try {
            $response = app(ServiceController::class)->check($request, app(ServiceMonitor::class));
            $this->assertSame(409, $response->getStatusCode());
            $this->assertDatabaseCount('service_checks', 0);
        } finally {
            $lock->release();
        }
    }

    public function test_write_failure_is_explicit_and_releases_lock(): void
    {
        $this->fakeServices();
        $this->mock(ServiceMonitor::class, function ($mock): void {
            $mock->shouldReceive('run')->once()->andThrow(new \RuntimeException('private details'));
        });
        $this->withSession($this->sessionData())->postJson('/servicos/verificar')->assertStatus(500)->assertJson(['message' => 'Não foi possível guardar a verificação. Os resultados não foram conservados.'])->assertJsonMissingPath('html')->assertDontSee('private details');
        $this->assertDatabaseCount('service_checks', 0);
    }

    public function test_real_openapi_document_can_be_read_by_the_runtime_yaml_parser(): void
    {
        $specification = Yaml::parseFile(base_path('../../docs/openapi.yaml'));
        $this->assertSame('3.0.3', $specification['openapi']);
        $this->assertArrayHasKey('/admin/services', $specification['paths']);
    }

    public function test_logout_clears_only_backoffice_session_and_returns_to_site(): void
    {
        $this->withSession($this->sessionData())->post('/sair')->assertRedirect('http://127.0.0.1:5173/admin')->assertSessionMissing('backoffice');
        Http::assertNothingSent();
    }
}
