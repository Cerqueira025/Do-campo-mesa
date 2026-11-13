@props(['durations'])
@php
    $maximum = max($durations);
    $intervals = 4;
    $targetStep = max(1, (int) ceil($maximum / $intervals));
    $magnitude = 10 ** (int) floor(log10($targetStep));
    foreach ([1, 2, 5, 10] as $factor) {
        $step = $factor * $magnitude;
        if ($step >= $targetStep) {
            break;
        }
    }
    $scale = $intervals * $step;
    $last = count($durations) - 1;
    $y = fn (int $duration): float => round(88 - 80 * $duration / $scale, 2);
    $points = array_map(
        fn (int $index, int $duration): string => round(4 + 232 * $index / $last, 2).','.$y($duration),
        array_keys($durations),
        $durations,
    );
@endphp
<figure class="service-timing">
    <figcaption class="service-timing__caption">
        <strong>Evolução da duração</strong>
        <span>Mín. {{ min($durations) }} ms · Máx. {{ $maximum }} ms</span>
    </figcaption>
    <div class="service-timing__plot">
        <div class="service-timing__scale" aria-hidden="true">
            @foreach(range($scale, 0, $step) as $tick)
                <span>{{ $tick }} ms</span>
            @endforeach
        </div>
        <svg class="service-timing__chart" viewBox="0 0 240 96" preserveAspectRatio="none" role="img"
            aria-label="Durações em milissegundos, da medição mais antiga à mais recente: {{ implode(', ', $durations) }}">
            @foreach(range(8, 88, 20) as $line)
                <line x1="4" y1="{{ $line }}" x2="236" y2="{{ $line }}" class="service-timing__grid-line" vector-effect="non-scaling-stroke" />
            @endforeach
            <polyline points="{{ implode(' ', $points) }}" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
            <path d="M 236 {{ $y($durations[$last]) }} h 0" fill="none" stroke="currentColor" stroke-width="7"
                stroke-linecap="round" vector-effect="non-scaling-stroke" />
        </svg>
        <div class="service-timing__order">
            <span>Mais antiga</span>
            <strong>Mais recente · {{ $durations[$last] }} ms</strong>
        </div>
    </div>
</figure>
