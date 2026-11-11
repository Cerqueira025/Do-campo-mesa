# Do Campo à Mesa

Marketplace que aproxima produtores locais de consumidores e restaurantes.

## Quick start

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
Copy-Item api/.env.example api/.env
```

Se já tiveres um `api/.env`, mantém-no e revê os valores:

- `MONGODB_URI`: URI de ligação com as credenciais da base de dados. No Atlas,
  autoriza também o IP da máquina em **Network Access**.
- `MONGODB_DB_NAME`: nome da base de desenvolvimento.
- `JWT_SECRET`: segredo aleatório com pelo menos 32 caracteres. Substitui o exemplo.
- `PORT`: mantém `3000`, a porta usada pelo proxy do frontend.

Não coloques o `.env` no Git. Se estás a reutilizar uma base com leilões antigos,
segue primeiro as [migrações](docs/operacoes-locais.md#migrar-leilões-antigos).
Numa base nova, cria as coleções e os índices:

```powershell
npm --prefix api run db:init
```

Para experimentar a aplicação com contas e produtos fictícios, carrega os exemplos
**apenas na base de desenvolvimento**:

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

Se carregaste os exemplos, entra com `produtor@example.test` ou
`admin@example.test`. Usa a palavra-passe definida em `SEED_PASSWORD` quando
criaste as contas (por defeito, `CampoMesaDemo123!`). Consulta os
[dados de demonstração](docs/dados-funcionais.md) para mais contas e cenários.
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

Para correr o lint do repositório, instala também as ferramentas da raiz e as
dependências PHP:

```powershell
npm ci
composer --working-dir=backoffice/app install
npm run lint
```

## Documentação

- [Frontend](frontend/README.md): estrutura, rotas, estilos e fotografias.
- [OpenAPI](docs/openapi.yaml) e [operações locais](docs/operacoes-locais.md):
  contrato REST, coleção Bruno e manutenção da base de dados.
- [Administração](docs/administracao.md) e [backoffice técnico](backoffice/app/README.md).
- [Navegação e fluidez](docs/fluidez.md) e [enunciado do projeto](Do_Campo_a_Mesa_Enunciado.pdf).
