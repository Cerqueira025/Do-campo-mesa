# Do Campo à Mesa

Plataforma web para aproximar produtores locais de consumidores e restauração.
[Enunciado do projeto](Do_Campo_a_Mesa_Enunciado.pdf)

## Estrutura

- `frontend/` — aplicação React + TypeScript, criada com Vite.
- `api/` — API REST em Node.js + Express, ligada ao MongoDB Atlas.
- `backoffice/app/` — backoffice técnico Laravel com diagnóstico de serviços e histórico SQLite.
- `docs/` — documentação técnica e especificação OpenAPI.

As imagens dos produtos são ficheiros WebP locais do frontend, com variantes de 480 e 960 px.
O frontend associa-as pelo nome do produto; a API não recebe nem devolve imagens.
Para acrescentar uma imagem, consulta [as instruções do frontend](frontend/README.md#imagens-dos-produtos).

## Quick Start

Requisitos: Node.js 22.14 ou superior, MongoDB com suporte a transações
(replica set, como o Atlas) e, para o backoffice, PHP 8.5 com PDO SQLite e Composer,
conforme as dependências bloqueadas.

1. Clona o repositório e entra na pasta:

```powershell
git clone https://github.com/Cerqueira025/Do-campo-mesa.git
cd Do-campo-mesa
```

2. Inicia o Frontend:

```powershell
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

3. Inicia a API (depois de instalar as dependências):

```powershell
cd api
npm ci
npm run db:init
npm run db:seed
npm run dev
```

Executa os comandos de cada serviço num terminal separado, a partir da raiz do
repositório. Antes de iniciar a API, configura `api/.env` a partir de `api/.env.example`.
O seed destina-se apenas a desenvolvimento/demonstração. Para bases antigas com
leilões, segue primeiro as migrações descritas abaixo.
É necessário Node.js 22.14 ou superior. A API só aceita pedidos depois de se ligar ao MongoDB.

### Arrancar todos os serviços no Windows

Depois da preparação inicial da API, do frontend e do
[backoffice Laravel](backoffice/app/README.md#preparação-local), executa na raiz:

```powershell
npm start
```

O script `start.ps1` abre três janelas PowerShell, identificadas pelo serviço:

| Serviço            | Endereço              |
| ------------------ | --------------------- |
| Frontend           | http://127.0.0.1:5173 |
| API                | http://127.0.0.1:3000 |
| Backoffice Laravel | http://127.0.0.1:8000 |

Swagger está disponível em http://127.0.0.1:3000/api-docs/ e Socket.IO arranca
com a API. O MongoDB continua no Atlas. Mantém `PORT=3000` na configuração da API
e usa `127.0.0.1` no browser para preservar a sessão de entrada no backoffice.

É necessário Node.js 22.14+, npm e PHP 8.5 no PATH, dependências instaladas,
os ficheiros `api/.env` e `backoffice/app/.env` configurados, SQLite preparado
com as migrações e assets do Laravel compilados. Se faltar um ficheiro necessário,
o script indica a preparação em falta antes de abrir as janelas. Instalações,
migrações, seed e compilação são passos prévios ao arranque.

Consulta os logs em cada janela para confirmar o arranque ou identificar erros.
Para parar os serviços, usa `Ctrl+C` em cada janela. As janelas permanecem abertas
para consultar os logs. Evita repetir `npm start` enquanto os serviços estiverem ativos.

Também podes executar o script por caminho absoluto a partir de outra pasta:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\caminho\Do-campo-mesa\start.ps1"
```

## Lint

Na raiz do projeto, instala as ferramentas de lint e as dependências do frontend:

```powershell
npm ci
npm --prefix frontend ci
composer --working-dir=backoffice/app install
```

É necessário Node.js 22.14 ou superior, além de PHP e Composer compatíveis com o
backoffice. Não é necessário iniciar os servidores nem ligar à base de dados.

Executa todas as verificações a partir da raiz:

```powershell
npm run lint
```

| Comando                 | Verificação                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `npm run lint:frontend` | ESLint existente do frontend React/TypeScript.                                                |
| `npm run lint:js`       | ESLint da API (incluindo testes e scripts), JavaScript do backoffice e configurações de lint. |
| `npm run lint:php`      | Laravel Pint em modo de verificação (`--test`).                                               |
| `npm run lint:styles`   | Stylelint dos estilos CSS/SCSS do frontend e do backoffice.                                   |
| `npm run lint:format`   | Prettier verifica a formatação de JS/TS, CSS/SCSS, JSON e Markdown.                           |

Os comandos apenas verificam os ficheiros, sem aplicar correções. O comando global
executa as verificações por esta ordem e para na primeira falha, com código de saída
diferente de zero. Usa os comandos individuais para consultar os restantes resultados.
Dependências e ficheiros gerados ficam fora da análise. Problemas já existentes
também são reportados; a configuração não implica uma limpeza geral do código.

## Base de dados MongoDB

Configuração local (não colocar credenciais no Git):

```dotenv
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@HOST/
MONGODB_DB_NAME=do_campo_a_mesa
PORT=3000
SEED_PASSWORD=CampoMesaDemo123!
JWT_SECRET=replace-with-at-least-32-random-characters
```

Usa o URI de ligação do Atlas, com o utilizador da base de dados e a password
codificada para URL. Autoriza o IP da máquina em Network Access no Atlas.
As variáveis de ambiente do serviço também podem fornecer esta configuração.

Dentro de `api/`, `npm run db:init` cria as coleções e os índices declarados,
sem apagar coleções, documentos ou índices existentes. `npm run db:seed`
também inicializa a estrutura e insere apenas exemplos que ainda não existam,
identificados por `_id` fixo. Repetir o seed não duplica nem atualiza exemplos;
alterar `SEED_PASSWORD` também não altera passwords de contas já criadas.
Usar o seed apenas na base de desenvolvimento/demonstração.

| Coleção            | Organização                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `users`            | Conta, papel e perfil do produtor embebido; email único e password com hash bcrypt.                                                   |
| `products`         | Produtor referenciado, preço, unidade e stock.                                                                                        |
| `orders`           | Comprador e produtor referenciados; linhas embebidas com nome, preço e unidade no momento da compra.                                  |
| `auctions`         | Produtor referenciado, lista obrigatória de produtos com quantidade/unidade por linha, lote, início/fim e licitação atual embebida.   |
| `bids`             | Histórico separado de licitações, referenciado por leilão e comprador.                                                                |
| `reviews`          | Autor e encomenda referenciados; um único alvo, produto ou produtor, e estado de moderação. Índice único por autor, encomenda e alvo. |
| `backoffice_codes` | Hash de código de entrada, utilizador, estado de associação da sessão e expirações; índices único e TTL.                              |

Valores monetários (`preco`, `precoUnitario`, `total`, `precoBase`, `incremento`
e `valor`) são inteiros em cêntimos: `150` representa 1,50 €.
Quantidades e stock admitem frações. O total da encomenda soma cada linha
arredondada a cêntimos (`Math.round(precoUnitario * quantidade)`).
Datas usam o tipo Date; `createdAt` e `updatedAt` são automáticos.

Cada comprador pode avaliar uma vez cada produto e uma vez o produtor de uma
encomenda entregue própria. Uma nova encomenda permite voltar a avaliar esses
alvos. Repetições devolvem `409` com “Já avaliou este alvo nesta encomenda.”,
sem alterar a avaliação original, mesmo que esteja oculta ou denunciada.

Antes de disponibilizar esta regra numa base existente, executa `npm run db:init`
dentro de `api/` para criar o índice `review_author_order_target_unique`.
Iniciar ou reiniciar a API não cria índices automaticamente. O índice único é
necessário para impedir também pedidos simultâneos. Se já existirem avaliações
duplicadas por autor, encomenda e alvo, a criação do índice falha; o comando não
apaga nem escolhe avaliações para conservar. Resolve esses dados separadamente
e repete `npm run db:init` antes de disponibilizar a API.

As validações são aplicadas pelo Mongoose, não por validadores nativos nas
coleções. Escritas diretas no Atlas não passam pelos schemas. Referências
`ObjectId` não são chaves estrangeiras: permissões, existência dos alvos,
stock, transições de estado e elegibilidade das avaliações serão verificadas
nos endpoints. Atualizações usam validação de documento; a criação de encomenda
reserva stock numa transação MongoDB.

O seed completo define 18 utilizadores, 39 produtos, 27 encomendas, 12 leilões,
27 licitações e 38 avaliações (161 documentos). A expansão funcional acrescenta
141 documentos aos 20 exemplos originais, sem substituir documentos existentes.
Inclui produtores aceites, pendentes e rejeitados, encomendas entregues elegíveis
para avaliações e leilões agendados, ativos e terminados.
O conjunto é validado antes da primeira escrita, incluindo as relações com
exemplos já existentes. Conflitos interrompem a execução sem corrigir esses dados.
Consulta [os cenários funcionais](docs/dados-funcionais.md) para contas, IDs e resultados esperados.
As datas dos leilões são relativas à primeira execução e ficam preservadas
nas seguintes; o seed não reinicia leilões expirados.

Contas fictícias: `admin@example.test`, `ana@example.test`,
`restaurante@example.test`, `produtor@example.test`, `pendente@example.test`
e `rejeitado@example.test`. A password inicial é `SEED_PASSWORD` ou,
se omitida, `CampoMesaDemo123!`. A coleção Bruno usa essa password por defeito;
se o seed foi executado com outra, atualiza `demoPassword` em
`bruno/environments/local.bru`. O comando não apresenta hashes nem credenciais
de ligação.

## API REST e coleção Bruno

Leilões recebem `produtos: [{ produtoId, quantidade }]`, com pelo menos um produto
distinto, publicado e pertencente ao produtor autenticado. O servidor obtém a unidade
de cada produto; o preço base e as licitações referem-se ao lote completo.
As respostas incluem `produtos: [{ produtoId: { _id, nome, ... }, quantidade, unidade }]`.
Um produto associado a qualquer leilão, incluindo terminado, não pode ser apagado (`409`).
Se qualquer produto ficar indisponível, o leilão completo é omitido da lista pública
e o detalhe devolve `404`.

O stock representa a quantidade disponível para novas vendas. A criação do leilão
não o desconta: o lote começa `agendado`, com `reservaStock: pendente`, e exige uma
data de fim futura. No início, a API tenta reservar todos os produtos numa transação.
Só fica `ativo` após a reserva; falta de stock ou indisponibilidade cancela o lote
sem descontos parciais. `motivoCancelamento` indica `stock-insuficiente`,
`produto-indisponivel` ou `produtor-indisponivel`.
Ao terminar sem vencedor, o stock é devolvido uma única vez (`libertada`); com
vencedor, mantém-se descontado (`atribuida`) e nasce uma encomenda única por leilão.
O total é o lance vencedor do lote; cada produto mantém nome, quantidade e unidade,
sem um preço individual fictício. A encomenda fica pendente até o vencedor escolher
levantamento ou entrega no detalhe; para entrega, indica a morada. Só então passa
a `confirmada` e o produtor pode avançar o estado. Leilões já terminados não são
convertidos retroativamente.
Enquanto houver quantidades com reserva `reservada`, alterar stock ou unidade
do produto devolve `409`. Depois da atribuição do lote ao vencedor, essa reserva
já não bloqueia a edição. Os restantes dados continuam editáveis.

O processamento corre no arranque, antes de aceitar pedidos, e após cada ciclo
aguarda cinco segundos antes do seguinte. Atrasos incluem o tempo da base de dados.
Finaliza leilões antes de iniciar os seguintes, por data e ID, e recupera trabalho
pendente após reiniciar. Um leilão cujo intervalo inteiro tenha passado sem reserva
termina com `sem-reserva`, sem alterações ao stock. Falhas técnicas são repetidas
no ciclo seguinte; não são motivos de cancelamento. Leituras GET não escrevem.
Destaque e detalhe consultam a API a cada cinco segundos; o contador local nunca
ativa um leilão sem confirmação do servidor.

Para bases com leilões no formato antigo, para a API e executa dentro de `api/`:

```powershell
npm run db:migrate:auction-products
npm run db:migrate:auction-stock
npm run db:init
npm run dev
```

A migração é explícita e não corre no arranque nem no seed. Converte cada associação
antiga numa lista de uma linha e remove `produtoId`, `quantidade` e `unidade` do topo.
Preserva IDs, timestamps e licitações; pode ser repetida. Valida todos os documentos
antes de escrever e interrompe com os IDs problemáticos se houver dados incompletos
ou formatos misturados. Não corrige produtos órfãos. Mantém a API parada até concluir
as duas migrações e a criação dos índices. A migração `auction-stock` marca os
antigos já terminados como `sem-reserva`, sem deduções retroativas, e coloca os
restantes em `agendado`/`pendente`. Documentos já migrados ficam intactos.
A API recusa arrancar se ainda houver documentos sem estado de reserva.
Numa base nova basta o processo normal de init/seed; exemplos ainda por terminar
começam pendentes e só ficam ativos depois de o servidor reservar o lote.

`docs/openapi.yaml` descreve os endpoints de autenticação, produtos,
produtores, encomendas, avaliações, leilões, administração e integração do backoffice.
A API publica a especificação em `/api-docs/openapi.yaml` e Swagger UI em `/api-docs/`,
com **Authorize** e **Try it out**. Reinicia a API depois de alterar a especificação,
que é carregada no arranque. Os pedidos usam JWT onde exigido;
os valores monetários enviados e devolvidos pela API são cêntimos inteiros.
O filtro `precoMin`/`precoMax` do catálogo recebe euros.

### Testar a API no Swagger

Com a API iniciada, abre http://127.0.0.1:3000/api-docs/.

1. Expande uma consulta pública, por exemplo `GET /health`, e escolhe
   **Try it out → Execute**. A interface mostra o pedido curl, o código HTTP
   e o corpo da resposta.
2. Executa `POST /auth/login` com uma conta de demonstração e a respetiva
   password. O exemplo usa `produtor@example.test` e a password por defeito
   do seed; ajusta-a se a conta tiver outra password.
3. Copia apenas o valor de `token`, abre **Authorize**, cola-o em `bearerAuth`
   sem o prefixo `Bearer` e confirma em **Authorize → Close**.
4. Executa `GET /auth/eu` para confirmar a sessão. O token é enviado nas
   operações protegidas; sem token recebem `401`, e um papel sem permissão
   recebe `403`. Usa **Logout** no diálogo para remover a autorização.
   A autorização não é conservada ao recarregar a página.
5. Com um produtor aprovado, cria um produto descartável em `POST /products`.
   A resposta é `201`, com `Location` e o `_id` criado. Usa esse ID para testar
   `PUT /products/{id}` com apenas `{"nome":"Produto atualizado"}` (`200`)
   e `DELETE /products/{id}` (`204`, sem corpo). A eliminação exige que o
   produto não tenha leilões associados.

Os pedidos executam operações reais na base de demonstração configurada.
Obtém IDs nas consultas da API; os exemplos de encomenda e leilão exigem IDs
existentes e quantidades compatíveis com a unidade e o stock. Nos leilões,
substitui também as datas por um intervalo futuro. As áreas administrativas
apresentam os filtros e respostas específicos de cada recurso. A troca interna
do backoffice é uma integração entre servidores; não introduzas o segredo
de integração no Swagger.

Para validar a especificação e executar os testes dedicados, dentro de `api/`:

```powershell
npm run test:docs
```

Estes testes verificam OpenAPI 3.0.3, referências, exemplos, cobertura das rotas,
schemas de respostas, segurança, publicação do YAML e recursos da interface.
Executam ainda login e CRUD através de um servidor temporário com persistência
simulada; não precisam de Atlas nem alteram dados reais. Também fazem parte de
`npm test` e do workflow de testes da API. A validação automatizada usa Swagger
Parser e Ajv Draft 4; não depende de um validador remoto. Para uma revisão manual,
podes abrir `docs/openapi.yaml` no [Swagger Editor](https://editor.swagger.io/)
e confirmar que não apresenta erros.

### Coleção Bruno

Abre a pasta `bruno/` no Bruno e seleciona o ambiente `local`. Para executar a
coleção completa, inicia primeiro a API (`npm run dev` numa janela de terminal)
e depois executa `npm run test:api` em `api/`. A coleção cobre autenticação,
papéis, filtros, CRUD de produto, encomendas, avaliações e leilões REST.
Licitações Socket.IO ficam fora desta coleção.

Os testes usam a base de demonstração configurada em `MONGODB_DB_NAME`. Antes
e depois da execução, a limpeza remove apenas contas de teste `bruno-test-*`
e documentos com o marcador `BRUNO_AUTOTEST_`; devolve também ao stock as
quantidades reservadas pelas encomendas e leilões de teste. A remoção de cada
leilão e a devolução das suas reservas são transacionais; históricos e reservas
já libertadas não devolvem stock novamente. Não usar estes marcadores
em dados próprios. A execução pode alterar dados da base de demonstração
durante o teste, pelo que convém não a usar simultaneamente.

`npm test` dentro de `api/` verifica schemas, autenticação, permissões, catálogo,
encomendas, avaliações, administração, reservas, migrações, sockets e entrada no
backoffice, além das relações dos exemplos e da repetição do seed. Os testes normais
usam persistência simulada e não precisam de Atlas. Dois testes de integração
MongoDB são opcionais com `MONGODB_TEST_URI`, exclusivamente numa base isolada.
A verificação dos índices e da ligação real exige uma base acessível.

## Autenticação

As páginas `LoginPage`, `RegisterPage` e `ResetPasswordPage` estão em
`frontend/src/pages/auth/`. Cada uma contém o seu formulário e submissão. Partilham
`AuthLayout` (marca, título, painel e erros), em `frontend/src/features/auth/components/`,
e os campos genéricos `InputField` e `PasswordField`, em `frontend/src/components/ui/input/`.
O `FormField` concentra o estilo, label e ícone dos inputs, selects e textareas;
o `PasswordField` reutiliza o `InputField` e acrescenta o botão de mostrar/ocultar.
`AccountPage` fica em `pages/`; a administração está em `features/admin/`,
com a estrutura, listas e detalhes partilhados. Os pedidos ficam em
`authService.ts`, os tipos e auxiliares puros em `auth.ts` e a persistência e
expiração local em `sessionStorage.ts`; a sessão continua no `AuthProvider`.
Estas três páginas usam apresentação própria;
a barra de sessão mantém-se no catálogo e nas áreas protegidas.

`/recuperar-password` recebe o email do login, permite corrigi-lo e pede a nova
password e confirmação. `POST /api/auth/recuperar-password` recebe apenas
`email` e `password`, normaliza o email e substitui o hash com bcrypt custo 12.
Devolve 200 em sucesso, 400 para dados inválidos e 404 para conta inexistente.
Depois da alteração, o utilizador regressa ao login com o email preenchido.

**Recuperação exclusiva da demonstração universitária:** não há envio de email
nem token de recuperação. Qualquer pessoa que conheça um email pode substituir
a password dessa conta. Este fluxo não deve ser usado numa aplicação pública real.
Os JWT anteriormente emitidos continuam válidos até à sua expiração.

`/login` e `/registo` iniciam a sessão na SPA. O registo público aceita apenas
compradores e produtores; depois de criar a conta, a SPA faz login com as mesmas
credenciais. Se este segundo pedido falhar, informa que a conta já foi criada
e permite entrar sem repetir o registo. A conta de administrador é criada pelo seed.

As passwords usam bcrypt com custo 12 (mínimo de 8 caracteres, máximo de 72 bytes
em UTF-8). O login devolve um JWT com `id`, `papel` e expiração de duas horas,
e os dados públicos do utilizador. Nunca são devolvidos passwords ou hashes.

O `AuthProvider` guarda a sessão em memória e no `localStorage`, conforme o guia.
Ao recarregar a SPA, `GET /api/auth/eu` confirma o token e os dados atuais na base
de dados antes de abrir conteúdo protegido. Falhas de rede permitem tentar
novamente; respostas 401 ou a expiração terminam a sessão. O logout limpa a
sessão do browser; um JWT já emitido mantém validade no servidor até expirar.

`/conta` exige autenticação e mostra o estado de aprovação dos produtores.
`/admin` exige o papel `administrador` e reúne resumo, utilizadores, encomendas,
leilões e moderação de produtos e avaliações. `/admin/produtores` permite aprovar
ou rejeitar registos ainda pendentes através de `GET /api/producers/pendentes` e
`PATCH /api/producers/:id/validacao`. As permissões e a aprovação são consultadas
na base de dados em cada pedido protegido. O produtor pode atualizar o estado
na sua área de conta sem voltar a fazer login. Cada registo é decidido uma única vez.
Consulta [o funcionamento da administração](docs/administracao.md) para filtros,
privacidade, motivos e efeitos da ocultação sobre compras e leilões.

Em desenvolvimento, o proxy do Vite encaminha `/api` para a API local. Em produção,
configura HTTPS e o encaminhamento de `/api` para a API no mesmo domínio da SPA.
Fornece `JWT_SECRET` nas variáveis de ambiente do serviço; nunca no frontend.
Como o token no `localStorage` é acessível a JavaScript, os textos dos utilizadores
devem continuar a ser apresentados como texto pelo React, sem injetar HTML.

`npm test` na API cobre os fluxos HTTP e as permissões com a persistência simulada;
`npm test` no frontend cobre o cliente HTTP e as regras de sessão. A coleção Bruno
inclui um ciclo de registo, aprovação e consulta com um produtor de teste, removido
pela limpeza normal da coleção.

## Navegação e fluidez

Catálogo, produtos e leilões usam navegação interna sem recarregar a aplicação.
O regresso recupera a lista, os filtros, o scroll e o foco, atualizando os resultados em segundo plano.
O catálogo apresenta 24 produtos por página, com Anterior/Seguinte e `page` na URL
(omitido na primeira página). Pesquisa e filtros regressam à primeira página;
o histórico e o regresso do detalhe preservam a página escolhida. Se uma página
deixar de existir, a aplicação regressa à última disponível sem criar outra entrada
no histórico. Os controlos de paginação levam o foco e o scroll aos resultados.
Os detalhes continuam a confirmar disponibilidade na API. A cache é apenas em memória.

Consulta [a implementação e as medições de fluidez](docs/fluidez.md).
Depois de alterar código da API, reinicia-a se a estiveres a executar com `npm start`;
`npm run dev` acompanha as alterações automaticamente.

## Testes de concorrência dos leilões

As mudanças de estado das encomendas são condicionadas atomicamente ao estado
anterior: um pedido concorrente ultrapassado recebe `409` sem fazer recuar a
encomenda nem alterar a data de entrega. Criar leilões e apagar produtos também
usa transações, coordenadas por uma revisão interna do produto. Essa revisão não
é devolvida nas consultas normais nem altera o stock ou `updatedAt`. O primeiro
incremento inicializa documentos antigos, sem migração adicional.
Estas operações exigem um MongoDB com suporte a transações (replica set, como
o Atlas). A criação de leilões só confirma após o commit; uma falha reverte o lote
inteiro. A eliminação continua bloqueada por qualquer leilão associado.

`npm test` na API inclui testes de reservas, reversão, repetição, migração e edição
protegida, com persistência simulada. O teste de concorrência real dos leilões é optativo:
configura `MONGODB_TEST_URI` no ambiente para um MongoDB de testes com suporte a
transações (replica set), depois executa `npm test`. Não reutilizes o URI da base
de demonstração ou produção. O teste cria e remove exclusivamente uma base com
nome aleatório `codex_stock_test_*`; sem esta variável, é marcado como ignorado.

## Fluxo de encomendas

Visitantes e compradores podem adicionar artigos pelo catálogo, produtos relacionados
ou detalhe. `/carrinho` agrupa-os por produtor e mantém os artigos no browser após F5.
O login preserva o carrinho visitante; o logout explícito ou a troca de conta limpa-o.
A morada só fica no formulário e na encomenda, nunca no armazenamento do carrinho.

`/finalizar-encomenda` exige conta de comprador e confirma preços e disponibilidade.
A modalidade de levantamento ou entrega (com morada obrigatória) aplica-se a todos
os produtores da compra. O servidor calcula os preços e totais em cêntimos.
`POST /api/orders` recebe `{ linhas, entrega }` e devolve sempre uma lista de encomendas
com `201` e `Location: /api/orders`, incluindo compras com um único produtor.
Uma transação cria uma encomenda por produtor e reserva todo o stock; uma falha
reverte o conjunto completo. Este contrato substitui a antiga resposta de um objeto.

O comprador acompanha `/encomendas`; o produtor consulta `/produtor/encomendas`.
O detalhe `/encomendas/:id` mostra os dados históricos e permite ao produtor avançar
um estado de cada vez. Listas e detalhe atualizam a cada cinco segundos enquanto
visíveis, sem pedidos sobrepostos. Os eventos Socket.IO antecipam essas consultas;
ao reconectar, as páginas consultam novamente a API para recuperar eventos perdidos.
Falhas de rede numa compra não repetem o POST automaticamente: consulte primeiro
as encomendas, pois o servidor pode ter concluído a operação.

Após a entrega, o comprador avalia separadamente cada produto e o produtor,
com classificação de 1 a 5 e comentário obrigatório. O endpoint autenticado
`GET /api/orders/:id/reviews` devolve apenas as avaliações do comprador dessa encomenda,
incluindo ocultas e denunciadas, para impedir repetição na interface após F5.
A restrição definitiva continua no índice `review_author_order_target_unique`.
O fluxo não requer migração de documentos; confirme o índice com a inicialização
já documentada antes de disponibilizar a funcionalidade.

As classificações aparecem nos cartões, no detalhe dos produtos e em
`/produtores/:id`, com nome, localização/mapa, produtos e avaliações do produtor.
A conta de um produtor aprovado mostra a sua média e total, com acesso ao perfil.
Os produtos públicos devolvem `avaliacao: { media, total }`, calculada em conjunto
para cada lista. A nota do produtor considera apenas avaliações dirigidas ao produtor.
Sem avaliações públicas, a média é `null` e o total é zero. As consultas
`GET /api/reviews/products/:id` e `/producers/:id` devolvem apenas autor público,
nota, comentário e data, por ordem decrescente de data e identificador. Alvos
indisponíveis devolvem `404`.

Compradores e produtores autenticados podem denunciar avaliações de terceiros
através de `POST /api/reviews/:id/denuncias`, enviando um `motivo` de 1–500
caracteres após remover espaços nas extremidades. Não é necessária compra.
Cada conta denuncia cada avaliação uma vez, incluindo após republicação.
A denúncia fica registada atomicamente e muda o estado para `denunciada`:
a avaliação deixa de contar nas listas, médias e filtros até decisão administrativa.
Os motivos e denunciantes só são expostos à administração. Ocultar ou republicar
preserva a nota, comentário e denúncias. O frontend invalida a cache do catálogo
após alterações e volta a consultar avaliações ao regressar à janela.

Os testes normais simulam a persistência. O teste opcional de denúncias com MongoDB
real usa `MONGODB_TEST_URI`, cria uma base temporária isolada, verifica o índice único,
a concorrência e a recuperação das médias, e remove exclusivamente essa base no fim.

## Tempo real

A API REST e Socket.IO partilham o mesmo servidor HTTP. O frontend liga-se a
`/socket.io` pelo proxy de desenvolvimento; em produção, `/api` e `/socket.io`
devem chegar à mesma instância da API através de HTTPS/WSS. A conexão aceita
visitantes nas salas públicas `leilao:<id>`. Com JWT válido, entra também na sala
privada `user:<id>`. Só compradores podem licitar; o servidor valida cada lance e
guarda a licitação atual e o histórico na mesma transação antes de emitir eventos.

| Direção                                  | Evento                                                  | Dados principais                                                                                  |
| ---------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Cliente → servidor                       | `entrar` / `sair`                                       | ID do leilão; `entrar` responde por ack.                                                          |
| Cliente → servidor                       | `licitar`                                               | `{ leilaoId, valor }` em cêntimos; ack `{ ok, valor }` ou `{ ok: false, erro }`.                  |
| Servidor → participante / sala do leilão | `estado` / `presenca`                                   | Ao entrar, leilão, hora do servidor, 20 lances recentes e último lance próprio; presença na sala. |
| Servidor → sala do leilão                | `nova-licitacao` / `aberto` / `terminado` / `cancelado` | Lance confirmado ou mudança persistida do ciclo.                                                  |
| Servidor → sala privada                  | `nova-encomenda` / `encomenda-atualizada`               | Referência, total ou novo estado.                                                                 |
| Servidor → sala privada                  | `leilao-ganho` / `leilao-terminado`                     | Leilão e referência da encomenda do vencedor.                                                     |

Os avisos são temporários. As listas e detalhes continuam a consultar a API a cada
cinco segundos enquanto visíveis, pois eventos Socket.IO perdidos durante uma quebra
de ligação não são reproduzidos. O processamento de stock e fecho do leilão também
corre periodicamente; só um commit confirmado gera eventos. Executa `npm run db:init`
na API para instalar o índice único parcial de `orders.leilaoId` antes de iniciar
leilões com licitações. A distribuição por várias instâncias exige um adaptador de
salas partilhado, fora desta fase.

## Backoffice técnico Laravel

A administração React inclui o acesso «Serviços e sistema», com entrada direta no Laravel.
O painel verifica API, MongoDB, Socket.io e Swagger UI e guarda um histórico SQLite
de 30 dias. A execução local, sem infraestrutura Cloud, foi acordada com o professor.
Consulta [a preparação, os endereços e os testes do backoffice](backoffice/app/README.md).

## Documentação e limites atuais

- [Frontend](frontend/README.md): organização, rotas, estilos, imagens e verificações.
- [Administração](docs/administracao.md): consultas, decisões e moderação.
- [Dados funcionais](docs/dados-funcionais.md): contas fictícias, cenários e limites do seed.
- [Navegação e fluidez](docs/fluidez.md): comportamento e medições históricas.
- [OpenAPI](docs/openapi.yaml): contrato REST servido pelo Swagger UI.
- [Auditoria de 2 de novembro](docs/auditoria-2026-11-02.md): diagnóstico histórico,
  com nota sobre alterações posteriores; não é uma validação da versão atual.

A interface do produtor inclui conta e acompanhamento de encomendas; a gestão
de produtos e a criação de leilões estão disponíveis pela API, sem formulários
equivalentes no frontend. As imagens são locais; não existe storage Cloud integrado.
O repositório não inclui configuração de alojamento de produção. A execução local
sem infraestrutura Cloud foi acordada com o professor; o backoffice assinala o
armazenamento como não implementado. O relatório final e o vídeo não estão
identificados na documentação atual.
