@forelse($checks as $check)
    <x-service-check :check="$check" :timing="$timings[$check->service] ?? null" />
@empty
    <p>Ainda não existem verificações guardadas.</p>
@endforelse
