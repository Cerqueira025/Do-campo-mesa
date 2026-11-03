<?php

namespace App\Http\Controllers;

use App\Services\MarketplaceApi;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BackofficeAuthController extends Controller
{
    public function start(Request $request): RedirectResponse
    {
        $state = bin2hex(random_bytes(32));
        $request->session()->put('entry', ['state' => $state, 'expires_at' => time() + 60]);

        return redirect()->away(rtrim(config('backoffice.site_url'), '/').'/admin/backoffice?state='.$state);
    }

    public function exchange(Request $request, MarketplaceApi $api): Response
    {
        $entry = $request->session()->pull('entry');
        $origin = $request->header('Origin');
        $site = rtrim(config('backoffice.site_url'), '/');
        if ($origin !== $site || ! is_array($entry) || ($entry['expires_at'] ?? 0) <= time() || ! is_string($request->input('state')) || ! hash_equals($entry['state'], $request->input('state')) || ! is_string($request->input('code')) || ! preg_match('/^[a-f0-9]{64}$/', $request->input('code'))) {
            return response()->view('error', ['message' => 'Esta entrada é inválida ou expirou. Abra novamente pelo site.', 'retry' => route('entry.start')], 403);
        }
        try {
            $response = $api->client()->withHeaders(['X-Backoffice-Secret' => config('backoffice.secret') ?? ''])->post('/api/internal/backoffice/exchange', $request->only('code', 'state'));
        } catch (ConnectionException) {
            return response()->view('error', ['message' => 'Não foi possível contactar a API. Inicie novamente a entrada.', 'retry' => route('entry.start')], 503);
        }
        $data = $response->json();
        if (! $response->successful() || ! is_array($data) || ! is_string($data['token'] ?? null) || ! is_int($data['expiresAt'] ?? null) || $data['expiresAt'] <= time() || ($data['utilizador']['papel'] ?? null) !== 'administrador') {
            return response()->view('error', ['message' => 'Não foi possível autorizar a entrada. Abra novamente pelo site.', 'retry' => route('entry.start')], 403);
        }
        $request->session()->regenerate();
        $request->session()->put('backoffice', ['token' => $data['token'], 'expires_at' => $data['expiresAt']]);

        return redirect()->route('services');
    }

    public function logout(Request $request): RedirectResponse
    {
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->away(rtrim(config('backoffice.site_url'), '/').'/admin');
    }
}
