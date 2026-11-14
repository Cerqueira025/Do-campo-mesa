# Backoffice técnico — Do Campo à Mesa

Painel Laravel 13 com Blade e Eloquent, aberto pelo botão **Serviços e sistema** na administração React. A execução sem infraestrutura Cloud foi acordada com o professor. A gestão do marketplace mantém-se no React e na API Node.js.

## Preparação local

Requisitos: PHP 8.5 com PDO SQLite (versão usada pelas dependências bloqueadas), Composer, Node.js e a base MongoDB já configurada para a API. Não há criação de novas contas administrativas nem cópia dos dados do marketplace para SQLite.

1. Na raiz da aplicação Laravel (`backoffice`), executar `composer install` e `npm ci`.
2. Copiar `.env.example` para `.env` se ainda não existir. Executar `php artisan key:generate` apenas se `APP_KEY` estiver vazia.
3. Gerar um segredo aleatório com pelo menos 32 caracteres e colocar o mesmo `BACKOFFICE_SECRET` em `api/.env` e no `.env` do Laravel. Não usar `JWT_SECRET` para este propósito. Nunca colocar este segredo no frontend.
4. Manter `DB_CONNECTION=sqlite`, `SESSION_DRIVER=database` e `SESSION_ENCRYPT=true`. Criar `database/database.sqlite` se necessário e executar `php artisan migrate`.
5. Na pasta `api`, executar `npm ci` e `npm run db:init` para preparar também a coleção `backoffice_codes` e os índices únicos/TTL. Não é necessário repetir o seed.
6. Na pasta Laravel, executar `npm run build` para preparar os estilos e JavaScript.

Usar **127.0.0.1 nos três endereços**; misturar localhost e 127.0.0.1 quebra a associação da sessão na entrada.

| Configuração                   | Valor local                                 |
| ------------------------------ | ------------------------------------------- |
| Laravel `APP_URL`              | `http://127.0.0.1:8000`                     |
| Laravel `MARKETPLACE_API_URL`  | `http://127.0.0.1:3000`                     |
| Laravel `MARKETPLACE_SITE_URL` | `http://127.0.0.1:5173`                     |
| Frontend `VITE_BACKOFFICE_URL` | `http://127.0.0.1:8000` (valor por defeito) |

`MARKETPLACE_SITE_URL` é a origem exata autorizada, sem caminho. Os endereços de regresso são fixos e não vêm de parâmetros recebidos. Reiniciar a API e o Laravel depois de alterar configurações; reiniciar o Vite depois de alterar variáveis do frontend.

## Arranque

No Windows, depois da preparação, `npm start` na raiz do repositório abre os três
serviços em janelas separadas. Consulta [o arranque conjunto](../../README.md#arrancar-todos-os-serviços-no-windows)
para pré-requisitos e paragem.

Para arranque manual, abrir três terminais nas pastas indicadas:

```powershell
# api
npm run dev
```

```powershell
# frontend
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

```powershell
# backoffice
php artisan serve --host=127.0.0.1 --port=8000
```

Abrir `http://127.0.0.1:5173/admin`, entrar com uma conta administrativa existente e selecionar **Serviços e sistema**. A instalação base do Laravel já não tem página de boas-vindas.

## Funcionamento e limites

A entrada usa um identificador ligado à sessão Laravel e um código aleatório de utilização única com validade máxima de 60 segundos. Só o hash do código fica no MongoDB. O Laravel troca-o por autenticação através de um segredo entre servidores. A sessão é regenerada e o JWT fica encriptado na sessão SQLite, com a expiração original. O código e o JWT não passam no endereço do browser.

Cada pedido protegido reconfirma a conta e o papel na API. 401/403 terminam a sessão do backoffice; indisponibilidade bloqueia o acesso e permite tentar novamente. **Voltar à administração** mantém as sessões. **Sair do backoffice** termina apenas a sessão Laravel; o site continua autenticado. O logout do React também não revoga o JWT já emitido: a sessão Laravel continua sujeita à sua expiração e à validação do papel atual.

Ao abrir **Serviços**, o JavaScript inicia um POST com proteção CSRF. O botão **Verificar agora** permite repetir. Não existem agendadores, verificações periódicas nem repetição automática após falha. Sem JavaScript não há verificação automática. O servidor impede verificações simultâneas na mesma sessão através de um lock local.

- API: resposta HTTP e conteúdo esperado de `/api/health`.
- MongoDB: `ping` real pela ligação existente da API.
- Socket.io: ligação WebSocket temporária e evento `diagnostico` com confirmação, sem entrar em salas de leilões.
- Swagger: página `/api-docs/` e YAML legível com os campos `openapi` e `paths` em `/api-docs/openapi.yaml`; o diagnóstico não valida integralmente o contrato OpenAPI.
- Armazenamento Cloud: **Não implementado**. As fotografias dos produtos são guardadas localmente.

Cada teste tem um orçamento máximo de cinco segundos. A falha em obter o diagnóstico pela API produz **Não foi possível verificar** para os serviços dependentes. Os testes comprovam as capacidades indicadas, não o funcionamento completo dos fluxos de negócio. Não existem ações de reinício ou configuração dos serviços.

O histórico SQLite guarda serviço, estado, mensagem sanitizada, duração, data e identificador de execução. Mostra 25 resultados por página com filtros de serviço e estado. A execução seguinte elimina registos com mais de 30 dias. Abrir o histórico não cria nem elimina verificações. A gravação dos cinco resultados e a limpeza são transacionais; se falharem, o painel indica que os resultados não foram guardados.

Preservar `database/database.sqlite` para manter o histórico. Não o adicionar ao Git. O backoffice usa os tokens e breakpoints SCSS do frontend como fonte comum de apresentação. Laravel Boost foi instalado em desenvolvimento por exigência do `AGENTS.md` desta pasta.

## Swagger e verificação

A API publica Swagger UI em `http://127.0.0.1:3000/api-docs/`. Usa a especificação existente em `docs/openapi.yaml`, com os novos endpoints de entrada e diagnóstico. O servidor OpenAPI é relativo (`/api`), permitindo usar **Authorize** e **Try it out** na mesma origem. A autorização do Swagger não é persistida entre carregamentos. Reiniciar a API depois de editar a especificação OpenAPI, que é carregada no arranque.

Executar `npm test` na API, `npm test`, `npm run lint` e `npm run build` no frontend, e `php artisan test --compact` e `npm run build` no Laravel. A raiz disponibiliza as verificações de estilo partilhadas. Testes Laravel usam SQLite em memória e HTTP simulado; os testes normais da API não precisam da base de demonstração. Dois testes MongoDB de concorrência continuam opcionais através da configuração de testes já existente.
