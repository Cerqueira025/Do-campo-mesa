@props(['check'])
<article class="panel service-check">
    <div class="service-check__heading">
        <h2>{{ \App\Models\ServiceCheck::SERVICES[$check->service] }}</h2>
        <span class="status status--{{ $check->status }}">{{ \App\Models\ServiceCheck::STATUSES[$check->status] }}</span>
    </div>
    <p>{{ $check->message }}</p>
    <dl>
        <div><dt>Verificado em</dt><dd><time datetime="{{ $check->checked_at->toIso8601String() }}">{{ $check->checked_at->timezone('Europe/Lisbon')->format('d/m/Y H:i:s') }}</time></dd></div>
        <div><dt>Duração</dt><dd>{{ $check->duration_ms === null ? 'Não aplicável' : $check->duration_ms.' ms' }}</dd></div>
    </dl>
</article>
