<?php

namespace App\Http\Controllers;

use App\Models\ServiceCheck;
use App\Services\ServiceMonitor;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class ServiceController extends Controller
{
    public function index(): View
    {
        $run = ServiceCheck::latest('checked_at')->latest('id')->value('run_id');
        $checks = $run ? ServiceCheck::where('run_id', $run)->orderBy('id')->get() : collect();

        return view('services', ['checks' => $checks, 'timings' => $this->recentTimings($checks)]);
    }

    public function check(Request $request, ServiceMonitor $monitor): Response
    {
        $lock = Cache::store('file')->lock('service-check:'.hash('sha256', $request->session()->getId()), 45);
        if (! $lock->get()) {
            return response()->json(['message' => 'Já existe uma verificação em curso.'], 409);
        }
        try {
            $checks = $monitor->run($request->session()->get('backoffice.token'));
        } catch (Throwable) {
            return response()->json(['message' => 'Não foi possível guardar a verificação. Os resultados não foram conservados.'], 500);
        } finally {
            $lock->release();
        }

        return response()->json([
            'message' => 'Verificação concluída e guardada.',
            'html' => view('partials.service-checks', ['checks' => $checks, 'timings' => $this->recentTimings($checks)])->render(),
        ]);
    }

    /** @return array<string, array{median: int, durations: list<int>}> */
    private function recentTimings(iterable $checks): array
    {
        $timings = [];
        $since = now()->subDays(30);
        foreach ($checks as $check) {
            if ($check->service === 'storage') {
                continue;
            }

            $durations = ServiceCheck::where('service', $check->service)
                ->where('status', 'ok')
                ->whereNotNull('duration_ms')
                ->where('checked_at', '>=', $since)
                ->where('id', '<=', $check->id)
                ->latest('checked_at')->latest('id')
                ->limit(20)
                ->pluck('duration_ms');

            if ($durations->isNotEmpty()) {
                $timings[$check->service] = [
                    'median' => (int) round($durations->median()),
                    'durations' => $durations->reverse()->values()->all(),
                ];
            }
        }

        return $timings;
    }

    public function history(Request $request): View
    {
        $filters = $request->validate(['service' => 'nullable|in:'.implode(',', array_keys(ServiceCheck::SERVICES)), 'status' => 'nullable|in:'.implode(',', array_keys(ServiceCheck::STATUSES)), 'page' => 'nullable|integer|min:1']);
        $query = ServiceCheck::query();
        foreach (['service', 'status'] as $field) {
            if (! empty($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }

        return view('history', ['checks' => $query->orderByDesc('checked_at')->orderByDesc('id')->paginate(25)->withQueryString()]);
    }
}
