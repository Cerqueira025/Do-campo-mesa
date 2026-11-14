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
<header class="header">
    <div class="shell header__inner">
        <a class="brand" href="{{ config('backoffice.site_url') }}/admin">
            <span class="brand__mark" aria-hidden="true"></span>
            <span>
                <strong>Do Campo à Mesa</strong>
                <span class="brand__subtitle">Serviços e sistema</span>
            </span>
        </a>
        @if(request()->attributes->has('administrator'))
            <span class="header__account">{{ request()->attributes->get('administrator') }}</span>
        @endif
    </div>
</header>
<div class="shell">
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
