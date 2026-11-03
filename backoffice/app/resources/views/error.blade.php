@extends('layouts.backoffice')
@section('title', 'Acesso indisponível')
@section('content')
<section class="panel" role="alert">
    <p>{{ $message }}</p>
    <a class="button" href="{{ $retry }}">Tentar novamente</a>
</section>
@endsection
