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

        return view('services', ['checks' => $run ? ServiceCheck::where('run_id', $run)->orderBy('id')->get() : collect()]);
    }

    public function check(Request $request, ServiceMonitor $monitor): Response
    {
        $lock = Cache::store('file')->lock('service-check:'.hash('sha256', $request->session()->getId()), 45);
        if (! $lock->get()) {
            return response()->json(['message' => 'Já existe uma verificação em curso.'], 409);
        }
        try {
            $monitor->run($request->session()->get('backoffice.token'));

            return response()->json(['message' => 'Verificação concluída e guardada.']);
        } catch (Throwable) {
            return response()->json(['message' => 'Não foi possível guardar a verificação. Os resultados não foram conservados.'], 500);
        } finally {
            $lock->release();
        }
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
