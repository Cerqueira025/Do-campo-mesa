@extends('layouts.backoffice')
@section('title', 'Histórico')
@section('content')
<p>Resultados das verificações. Os registos com mais de 30 dias são eliminados na verificação seguinte.</p>
<form class="filters panel" method="get" action="{{ route('history') }}">
    <label>Serviço<select name="service"><option value="">Todos os serviços</option>@foreach(\App\Models\ServiceCheck::SERVICES as $value => $label)<option value="{{ $value }}" @selected(request('service') === $value)>{{ $label }}</option>@endforeach</select></label>
    <label>Resultado<select name="status"><option value="">Todos os resultados</option>@foreach(\App\Models\ServiceCheck::STATUSES as $value => $label)<option value="{{ $value }}" @selected(request('status') === $value)>{{ $label }}</option>@endforeach</select></label>
    <button class="button" type="submit">Filtrar</button>
</form>
@if($errors->any())<p role="alert">Escolha filtros e uma página válidos.</p>@endif
<p>{{ $checks->total() }} {{ $checks->total() === 1 ? 'resultado' : 'resultados' }} · Página {{ $checks->currentPage() }} de {{ $checks->lastPage() }}</p>
<div class="service-grid">
    @forelse($checks as $check)
        <x-service-check :check="$check" />
    @empty
        <p>Não existem verificações para os filtros escolhidos.</p>
    @endforelse
</div>
<nav class="pagination" aria-label="Paginação do histórico">
    @if($checks->previousPageUrl())<a class="button button--light" rel="prev" href="{{ $checks->previousPageUrl() }}">Anterior</a>@endif
    @if($checks->nextPageUrl())<a class="button button--light" rel="next" href="{{ $checks->nextPageUrl() }}">Seguinte</a>@endif
</nav>
@endsection
