# Do Campo à Mesa

Plataforma web para aproximar produtores locais de consumidores e restauração.
[Enunciado do projeto](Do_Campo_a_Mesa_Enunciado.pdf)

## Estrutura

- `frontend/` — aplicação React + TypeScript, criada com Vite.
- `api/` — API REST em Node.js + Express, ligada ao MongoDB Atlas.
- `backoffice/app/` — aplicação Laravel existente, reservada ao backoffice opcional.
- `docs/` — documentação técnica e especificação OpenAPI.

## Quick Start

1. Clone do repositório:
```
git clone https://github.com/Cerqueira025/Do-campo-mesa.git
```

2. Inicia o Frontend:

```powershell
cd frontend
npm install
npm run dev
```

3. Inicia a API (depois de instalar as dependências):

```powershell
cd api
npm install
npm run db:init
npm run db:seed
npm run dev
```

Antes de iniciar a API, configura `api/.env` a partir de `api/.env.example`.
É necessário Node.js 22.14 ou superior. A API só aceita pedidos depois de se ligar ao MongoDB.

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

| Coleção | Organização |
| --- | --- |
| `users` | Conta, papel e perfil do produtor embebido; email único e password com hash bcrypt. |
| `products` | Produtor referenciado, preço, unidade, stock e URLs das imagens. |
| `orders` | Comprador e produtor referenciados; linhas embebidas com nome, preço e unidade no momento da compra. |
| `auctions` | Produto/produtor referenciados, lote, início/fim e licitação atual embebida. |
| `bids` | Histórico separado de licitações, referenciado por leilão e comprador. |
| `reviews` | Autor e encomenda referenciados; um único alvo, produto ou produtor, e estado de moderação. |

Valores monetários (`preco`, `precoUnitario`, `total`, `precoBase`, `incremento`
e `valor`) são inteiros em cêntimos: `150` representa 1,50 €.
Quantidades e stock admitem frações. O total da encomenda soma cada linha
arredondada a cêntimos (`Math.round(precoUnitario * quantidade)`).
Datas usam o tipo Date; `createdAt` e `updatedAt` são automáticos.

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

`docs/openapi.yaml` descreve os endpoints de autenticação, produtos,
produtores, encomendas, avaliações e leilões. Os pedidos usam JWT onde exigido;
os valores monetários enviados e devolvidos pela API são cêntimos inteiros.
O filtro `precoMin`/`precoMax` do catálogo recebe euros.

Abre a pasta `bruno/` no Bruno e seleciona o ambiente `local`. Para executar a
coleção completa, inicia primeiro a API (`npm run dev` numa janela de terminal)
e depois executa `npm run test:api` em `api/`. A coleção cobre autenticação,
papéis, filtros, CRUD de produto, encomendas, avaliações e leilões REST.
Licitações Socket.IO ficam fora desta coleção.

Os testes usam a base de demonstração configurada em `MONGODB_DB_NAME`. Antes
e depois da execução, a limpeza remove apenas contas de teste `bruno-test-*`
e documentos com o marcador `BRUNO_AUTOTEST_`; devolve também ao stock as
quantidades reservadas pelas encomendas de teste. Não usar estes marcadores
em dados próprios. A execução pode alterar dados da base de demonstração
durante o teste, pelo que convém não a usar simultaneamente.

`npm test` dentro de `api/` verifica os schemas, os hashes, as relações dos
exemplos e a repetição do seed com escrita simulada, além das regras de criação
de encomendas. Não precisa de Atlas.
A verificação do índice único de email e da ligação real exige a base acessível.


## Autenticação

As páginas `LoginPage`, `RegisterPage` e `ResetPasswordPage` estão em
`frontend/src/pages/auth/`. Cada uma contém o seu formulário e submissão. Partilham
`AuthLayout` (marca, título, painel e erros), em `frontend/src/features/auth/components/`,
e os campos genéricos `InputField` e `PasswordField`, em `frontend/src/components/ui/input/`.
O `FormField` concentra o estilo, label e ícone dos inputs, selects e textareas;
o `PasswordField` reutiliza o `InputField` e acrescenta o botão de mostrar/ocultar.
`AccountPage` e `ProducerApprovalPage`
também ficam em `pages/`, com os seus estilos específicos. Os pedidos ficam em
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
`/admin/produtores` exige o papel `administrador` e permite aprovar ou rejeitar
registos através de `GET /api/producers/pendentes` e
`PATCH /api/producers/:id/validacao`. As permissões e a aprovação são consultadas
na base de dados em cada pedido protegido. O produtor pode atualizar o estado
na sua área de conta sem voltar a fazer login.

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
Os detalhes continuam a confirmar disponibilidade na API. A cache é apenas em memória.

Consulta [a implementação e as medições de fluidez](docs/fluidez.md).
Depois de alterar código da API, reinicia-a se a estiveres a executar com `npm start`;
`npm run dev` acompanha as alterações automaticamente.
