@extends('layouts.backoffice')
@section('title', 'Serviços')
@section('content')
<p>Verifique a disponibilidade dos serviços. Os resultados são guardados durante 30 dias.</p>
<form method="post" action="{{ route('services.check') }}" data-service-check>
    @csrf
    <button class="button" type="submit">Verificar agora</button>
</form>
<p role="status" aria-live="polite" data-check-message></p>
<div class="service-grid" data-check-results>
    @forelse($checks as $check)
        <x-service-check :check="$check" />
    @empty
        <p>Ainda não existem verificações guardadas.</p>
    @endforelse
</div>
<noscript><p>Ative o JavaScript para iniciar e apresentar as verificações nesta página.</p></noscript>
@endsection
