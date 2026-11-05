@extends('layouts.backoffice')
@section('title', 'Serviços')
@section('content')
<p>Verifique a disponibilidade dos serviços. Os resultados são guardados durante 30 dias.</p>
<p>A mediana e os gráficos usam até 20 verificações bem-sucedidas dos últimos 30 dias. Cada gráfico tem a sua escala e mostra as medições da mais antiga à mais recente.</p>
<form method="post" action="{{ route('services.check') }}" data-service-check>
    @csrf
    <button class="button" type="submit">Verificar agora</button>
</form>
<p role="status" aria-live="polite" data-check-message></p>
<div class="service-grid" data-check-results>
    @include('partials.service-checks')
</div>
<noscript><p>Ative o JavaScript para iniciar e apresentar as verificações nesta página.</p></noscript>
@endsection
