<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

class MarketplaceApi
{
    public function client(?string $token = null): PendingRequest
    {
        $client = Http::baseUrl(rtrim(config('backoffice.api_url'), '/'))->acceptJson()->connectTimeout(2)->timeout(5);

        return $token ? $client->withToken($token) : $client;
    }
}
