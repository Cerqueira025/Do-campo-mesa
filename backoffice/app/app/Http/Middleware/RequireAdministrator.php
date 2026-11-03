<?php

namespace App\Http\Middleware;

use App\Services\MarketplaceApi;
use Closure;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireAdministrator
{
    public function __construct(private MarketplaceApi $api) {}

    public function handle(Request $request, Closure $next): Response
    {
        $session = $request->session()->get('backoffice');
        if (! is_array($session) || ($session['expires_at'] ?? 0) <= time()) {
            $request->session()->forget('backoffice');

            return redirect()->route('entry.start');
        }
        try {
            $response = $this->api->client($session['token'])->get('/api/auth/eu');
        } catch (ConnectionException) {
            return $this->unavailable();
        }
        if (in_array($response->status(), [401, 403]) || ($response->successful() && $response->json('papel') !== 'administrador')) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return response()->view('error', ['message' => 'A sessão terminou ou a conta já não tem permissão.', 'retry' => route('entry.start')], 403);
        }
        if (! $response->successful() || ! is_string($response->json('nome'))) {
            return $this->unavailable();
        }
        $request->attributes->set('administrator', $response->json('nome'));
        $result = $next($request);
        $result->headers->set('Cache-Control', 'no-store');

        return $result;
    }

    private function unavailable(): Response
    {
        return response()->view('error', ['message' => 'Não foi possível confirmar a sessão na API. O acesso está temporariamente bloqueado.', 'retry' => route('services')], 503)->header('Cache-Control', 'no-store');
    }
}
