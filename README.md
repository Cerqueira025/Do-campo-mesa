# Do Campo à Mesa

Marketplace que aproxima produtores locais de consumidores e restaurantes.

Para avaliação do projeto, segue o [início rápido](#início-rápido) e consulta
as [contas de demonstração](docs/dados-funcionais.md#contas-de-demonstração).

## Início rápido

**Requisitos:** Git, Node.js 22.14+ com npm e uma base MongoDB com suporte a
transações (replica set, por exemplo MongoDB Atlas). O backoffice Laravel é opcional.

### 1. Clonar e instalar

```powershell
git clone https://github.com/Cerqueira025/Do-campo-mesa.git
cd Do-campo-mesa
npm --prefix api ci
npm --prefix frontend ci
```

### 2. Configurar a base de dados MongoDB

```powershell
if (-not (Test-Path api/.env)) { Copy-Item api/.env.example api/.env }
```

Se já tiveres um `api/.env`, mantém-no e revê os valores:

- `MONGODB_URI`: URI de ligação com as credenciais da base de dados. No Atlas,
  autoriza também o IP da máquina em **Network Access**.
- `MONGODB_DB_NAME`: nome da base de desenvolvimento.
- `JWT_SECRET`: segredo aleatório com pelo menos 32 caracteres. Substitui o exemplo.
- `PORT`: mantém `3000`, a porta usada pelo proxy do frontend.

Não coloques o `.env` no Git. Se estás a reutilizar uma base com leilões antigos,
segue primeiro as [migrações](docs/operacoes-locais.md#migrar-leilões-antigos).
Para avaliação, usa uma base de demonstração vazia, como `do_campo_a_mesa_demo`.
Numa base nova, cria as coleções e os índices:

```powershell
npm --prefix api run db:init
```

Para carregar as contas e os produtos fictícios, deixa `SEED_PASSWORD` com o
valor de exemplo e executa:

```powershell
npm --prefix api run db:seed
```

### 3. Arrancar a API e o frontend

Abre dois terminais na raiz do repositório. No primeiro, inicia a API:

```powershell
npm --prefix api run dev
```

Quando a API confirmar a ligação e o arranque, inicia o frontend no segundo:

```powershell
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

- [Aplicação](http://127.0.0.1:5173)
- [Estado da API](http://127.0.0.1:3000/api/health)
- [Swagger UI](http://127.0.0.1:3000/api-docs/)

Se carregaste os exemplos, entra com `ana@example.test` (comprador),
`produtor@example.test` (produtor aprovado) ou `admin@example.test` (administrador).
A palavra-passe inicial é `CampoMesaDemo123!`, salvo se alteraste `SEED_PASSWORD`
antes de carregar os exemplos. Consulta a
[lista completa das contas](docs/dados-funcionais.md#contas-de-demonstração).
Se precisares de recuperar o acesso a uma conta, segue o
[procedimento de redefinição local](docs/operacoes-locais.md#redefinir-a-palavra-passe-de-uma-conta).

## Backoffice opcional

Segue a [preparação local do Laravel](backoffice/app/README.md#preparação-local)
(PHP 8.5 com PDO SQLite e Composer) e
[inicia o Laravel](backoffice/app/README.md#arranque). Depois, entra com uma conta
de administrador e abre **Serviços e sistema** em
[Administração](http://127.0.0.1:5173/admin).

### Arrancar todos os serviços no Windows

Com os três serviços preparados e parados, executa `npm start` na raiz. O script
abre uma janela PowerShell por serviço, incluindo o backoffice em
`http://127.0.0.1:8000`. Usa `127.0.0.1` nos três endereços e `Ctrl+C` em cada
janela para parar o respetivo serviço.

## Verificações

A partir da raiz, executa os testes da API e do frontend, sem precisar de iniciar
os servidores nem de ligar ao Atlas:

```powershell
npm --prefix api test
npm --prefix frontend test
```

Os testes de integração com MongoDB real só correm quando `MONGODB_TEST_URI`
está definida. Consulta [como repetir a validação dos leilões e os resultados no Atlas](docs/operacoes-locais.md#validar-leilões-com-mongodb-real).

Para correr o lint do repositório, instala também as ferramentas da raiz e as
dependências PHP:

```powershell
npm ci
composer --working-dir=backoffice/app install
npm run lint
```

## Documentação

- [Operações locais](docs/operacoes-locais.md): migrações, cópias de segurança, redefinição de palavras-passe e testes.
- [Dados de demonstração](docs/dados-funcionais.md): contas, exemplos e guiões para [uma compra com dois produtores](docs/dados-funcionais.md#demonstrar-uma-compra-com-dois-produtores) e [um leilão com dois compradores](docs/dados-funcionais.md#demonstrar-um-leilão-com-dois-compradores).
- [Frontend](frontend/README.md): estrutura, rotas, estilos e fotografias. [Navegação e fluidez](docs/fluidez.md): comportamento e medições históricas.
- [OpenAPI](docs/openapi.yaml): contrato REST usado pelo Swagger UI. [Leilões em tempo real](docs/leiloes-tempo-real.md): eventos Socket.IO e recuperação da ligação.
- [Administração](docs/administracao.md): gestão do mercado. [Backoffice técnico](backoffice/app/README.md): instalação e diagnóstico dos serviços.
- [Relatório do projeto](docs/relatorio.md) e [enunciado](Do_Campo_a_Mesa_Enunciado.pdf).
