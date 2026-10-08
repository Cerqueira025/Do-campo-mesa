# Do Campo à Mesa

Plataforma web para aproximar produtores locais de consumidores e restauração.
[Enunciado do projeto](Do_Campo_a_Mesa_Enunciado.pdf)

## Estrutura

- `frontend/` — aplicação React + TypeScript, criada com Vite.
- `api/` — API REST em Node.js + Express; a estrutura está preparada para MongoDB e Socket.io.
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
npm run dev
```