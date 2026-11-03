$ErrorActionPreference = 'Stop'

try {
    $commands = @{}
    foreach ($name in @('node.exe', 'npm.cmd', 'php.exe', 'powershell.exe')) {
        $command = Get-Command $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $command) {
            throw "Comando em falta: $name. Instala Node.js 22.14+ e PHP 8.5 e confirma o PATH."
        }
        $commands[$name] = $command.Source
    }

    $nodeVersion = & $commands['node.exe'] --version
    if ($LASTEXITCODE -ne 0 -or [version]($nodeVersion.TrimStart('v')) -lt [version]'22.14.0') {
        throw 'E necessario Node.js 22.14 ou superior.'
    }

    $requirements = @(
        @{ Path = 'api/.env'; Help = 'Copia api/.env.example para api/.env e configura a API e o MongoDB Atlas.' }
        @{ Path = 'backoffice/app/.env'; Help = 'Segue a preparacao local em backoffice/app/README.md, incluindo APP_KEY e BACKOFFICE_SECRET.' }
        @{ Path = 'api/node_modules/express/package.json'; Help = 'Executa npm --prefix api ci.' }
        @{ Path = 'frontend/node_modules/vite/bin/vite.js'; Help = 'Executa npm --prefix frontend ci.' }
        @{ Path = 'backoffice/app/vendor/autoload.php'; Help = 'Executa composer --working-dir=backoffice/app install.' }
        @{ Path = 'backoffice/app/database/database.sqlite'; Help = 'Cria a base SQLite e executa php artisan migrate em backoffice/app, conforme o respetivo README.' }
        @{ Path = 'backoffice/app/public/build/manifest.json'; Help = 'Executa npm --prefix backoffice/app ci e npm --prefix backoffice/app run build.' }
    )

    $missing = @($requirements | Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $_.Path) -PathType Leaf)
    })
    if ($missing.Count -gt 0) {
        foreach ($requirement in $missing) {
            Write-Host ("Em falta: {0}. {1}" -f $requirement.Path, $requirement.Help)
        }
        throw 'Conclui a preparacao antes de iniciar os servicos.'
    }

    $services = @(
        @{ Name = 'API'; Directory = 'api'; Command = "& '$($commands['npm.cmd'].Replace("'", "''"))' run dev"; Url = 'http://127.0.0.1:3000' }
        @{ Name = 'Frontend'; Directory = 'frontend'; Command = "& '$($commands['npm.cmd'].Replace("'", "''"))' run dev -- --host 127.0.0.1 --port 5173 --strictPort"; Url = 'http://127.0.0.1:5173' }
        @{ Name = 'Backoffice'; Directory = 'backoffice/app'; Command = "& '$($commands['php.exe'].Replace("'", "''"))' artisan serve --host=127.0.0.1 --port=8000"; Url = 'http://127.0.0.1:8000' }
    )

    foreach ($service in $services) {
        $directory = Join-Path $PSScriptRoot $service.Directory
        $childCommand = @"
`$Host.UI.RawUI.WindowTitle = 'Do Campo a Mesa - $($service.Name)'
Set-Location -LiteralPath '$($directory.Replace("'", "''"))'
$($service.Command)
"@
        $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($childCommand))
        Start-Process -FilePath $commands['powershell.exe'] -WorkingDirectory $directory -WindowStyle Normal -ArgumentList @(
            '-NoLogo', '-NoProfile', '-NoExit', '-EncodedCommand', $encodedCommand
        )
        Write-Host ("{0}: janela aberta. Endereco esperado: {1}" -f $service.Name, $service.Url)
    }

    Write-Host 'Consulta os logs nas janelas abertas. Usa Ctrl+C em cada janela para parar o respetivo servico.'
} catch {
    Write-Host ("Erro no arranque: {0}" -f $_.Exception.Message)
    exit 1
}
