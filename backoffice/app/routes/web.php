<?php

use App\Http\Controllers\BackofficeAuthController;
use App\Http\Controllers\ServiceController;
use App\Http\Middleware\RequireAdministrator;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/servicos');
Route::get('/entrar', [BackofficeAuthController::class, 'start'])->name('entry.start');
Route::post('/entrada', [BackofficeAuthController::class, 'exchange'])->name('entry.exchange');
Route::post('/sair', [BackofficeAuthController::class, 'logout'])->name('logout');
Route::middleware(RequireAdministrator::class)->group(function (): void {
    Route::get('/servicos', [ServiceController::class, 'index'])->name('services');
    Route::post('/servicos/verificar', [ServiceController::class, 'check'])->name('services.check');
    Route::get('/historico', [ServiceController::class, 'history'])->name('history');
});
