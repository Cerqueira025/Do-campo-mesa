<!doctype html>
<html lang="pt">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title') · Do Campo à Mesa</title>
    @vite(['resources/css/app.scss', 'resources/js/app.js'])
</head>
<body>
<a class="skip-link" href="#conteudo">Saltar para o conteúdo</a>
<div class="shell">
    <header class="header">
        <a class="brand" href="{{ config('backoffice.site_url') }}/admin">Do Campo à Mesa</a>
        <span>Serviços e sistema</span>
        @if(request()->attributes->has('administrator'))
            <span>{{ request()->attributes->get('administrator') }}</span>
        @endif
    </header>
    <nav class="navigation" aria-label="Backoffice">
        <a href="{{ route('services') }}" @if(request()->routeIs('services')) aria-current="page" @endif>Serviços</a>
        <a href="{{ route('history') }}" @if(request()->routeIs('history')) aria-current="page" @endif>Histórico</a>
        <a href="{{ config('backoffice.site_url') }}/admin">Voltar à administração</a>
        <form method="post" action="{{ route('logout') }}">@csrf<button class="button button--light" type="submit">Sair do backoffice</button></form>
    </nav>
    <main id="conteudo" tabindex="-1">
        <p class="eyebrow">Backoffice técnico</p>
        <h1>@yield('title')</h1>
        @yield('content')
    </main>
    <footer>Do Campo à Mesa · Diagnóstico dos serviços locais</footer>
</div>
</body>
</html>
