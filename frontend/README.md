# Frontend · Do Campo à Mesa

Frontend em React + TypeScript com Vite.

## Componentes

- `src/components/ui/` — peças genéricas da interface, sem regras específicas de uma funcionalidade. Exemplo: `Button`.
- `src/components/brand/` — elementos partilhados da identidade visual, como `BrandMark`.
- `src/features/<funcionalidade>/components/` — componentes compostos e específicos de uma área. A homepage guarda aqui `EntryActions` e `WelcomeHero`.
- `src/pages/` — compõe as páginas associadas às rotas, como `HomePage`.
- `src/styles/abstracts/` — tokens Sass e mixins partilhados, incluindo breakpoints.
- `src/styles/base/` — reset e estilos globais; `src/styles/main.scss` é o ponto de entrada global.

Mantém um componente em `ui` quando puder ser reutilizado sem conhecer a funcionalidade que o utiliza. Se representar uma secção ou comportamento próprio de uma funcionalidade, guarda-o nessa funcionalidade. Só extrai um componente genérico quando existir uma responsabilidade e uma interface reutilizáveis.

Os estilos específicos ficam junto do componente, em ficheiros `.scss`. Usa `@use` para carregar tokens e mixins; evita regras de uma funcionalidade dentro dos estilos globais. Todas as cores da interface vêm de `src/styles/abstracts/_tokens.scss`, através das variáveis CSS existentes; inclui sombras e estados de interação.

### Autenticação

- `src/pages/auth/` — páginas do fluxo de autenticação: `LoginPage`, `RegisterPage` e `ResetPasswordPage`.
- `src/pages/` — páginas da conta, catálogo, encomendas e autenticação.
- `src/features/admin/` — estrutura, navegação, listas e detalhes administrativos; ver [administração](../docs/administracao.md).
- `src/features/auth/components/` — `AuthLayout`, com os respetivos estilos. A navegação da sessão integra `src/components/layout/AppHeader.tsx`.
- `src/features/auth/` — `AuthProvider`, contexto, hooks e `ProtectedRoute`; `authService.ts` contém os pedidos à API, `auth.ts` os tipos e auxiliares puros e `sessionStorage.ts` a persistência e expiração local da sessão.
- `src/pages/auth/AuthForm.scss` e `src/features/auth/AuthPage.scss` — estilos partilhados, respetivamente, pelos formulários do fluxo e pelas páginas protegidas. Os estilos exclusivos da conta e da aprovação ficam junto das páginas.

O cliente HTTP partilhado fica em `src/api/client.ts`. Não é necessário criar subpastas para cada hook ou serviço.

Os campos reutilizáveis ficam em `src/components/ui/input/`: `InputField` recebe os atributos nativos de um input, `label`, `icon` e `hint`; `PasswordField` acrescenta a opção de mostrar/ocultar a password. Ambos reutilizam `FormField`, que também envolve selects e textareas e concentra os estilos em `FormField.scss`. O `InputField` associa automaticamente a dica ao input através de `aria-describedby`.

## Bootstrap 5

O Bootstrap é configurado em `src/styles/_bootstrap.scss` e carregado por `main.scss` antes dos estilos próprios. São importados apenas grelha, botões, cartões e campos de formulário, com as dependências Sass necessárias. O reset existente continua responsável pelas regras globais; não é carregado o Reboot do Bootstrap.

As cores, a tipografia e os breakpoints vêm dos tokens existentes. A grelha usa `md` a 768 px, `lg` a 1024 px e `xl` a 1280 px; os contentores próprios mantêm a largura máxima de 1280 px.

Nas novas páginas, reutiliza `row`/`col` e os componentes React existentes. `Button` usa `btn`, `ProductCard` usa `card` e `SearchBar` usa `form-control`; os estilos próprios personalizam o aspeto com os tokens. Importa novos módulos apenas quando forem utilizados. A navegação da SPA usa a History API e os componentes de `src/navigation/`.

O único uso de `@import` fica na entrada de compatibilidade do Bootstrap 5; o restante Sass usa `@use`. As interações são controladas pelo React, sem React Bootstrap nem importação do JavaScript do Bootstrap.

O Sass atual emite avisos de depreciação provenientes dos imports e funções internas do Bootstrap 5. Estes avisos não impedem a compilação; a exceção não se aplica ao código Sass próprio.

## Desenvolvimento

### Imagens dos produtos

As imagens dos produtos ficam em `src/assets/` e são incluídas no build do frontend.
Cada produto conhecido tem variantes WebP quadradas de 480 e 960 px, com transparência.
Para acrescentar um produto, cria as duas variantes e associa o nome em `src/features/products/product.ts`.
Produtos sem associação apresentam “Imagem indisponível”. A API não recebe nem devolve imagens.

### Endereços e alojamento

As rotas são resolvidas em `src/navigation/AppRoutes.tsx`. A navegação interna usa a History API, preservando o endereço real dos links, abertura noutro separador e cliques com modificadores. O parâmetro `regresso` conserva o endereço do catálogo e os seus filtros; a cache em memória permite restaurar lista, scroll e foco.

| Rotas                                                   | Acesso e função                                                                                           |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/`, `/produtos/:id`, `/produtores/:id`, `/leiloes/:id` | Catálogo, produtos, perfis e leilões públicos.                                                            |
| `/login`, `/registo`, `/recuperar-password`             | Entrada, registo e recuperação de demonstração; ver [limites da autenticação](../README.md#autenticação). |
| `/conta`                                                | Conta autenticada e estado de aprovação do produtor.                                                      |
| `/carrinho`                                             | Visitantes e compradores; artigos agrupados por produtor.                                                 |
| `/finalizar-encomenda`, `/encomendas`                   | Finalização e acompanhamento por compradores.                                                             |
| `/produtor/encomendas`                                  | Acompanhamento e avanço de estado pelo produtor.                                                          |
| `/encomendas/:id`                                       | Detalhe protegido de uma encomenda do comprador ou produtor.                                              |
| `/admin` e subrotas                                     | Resumo, listas, detalhes e moderação por administradores.                                                 |
| `/admin/backoffice`                                     | Passo de entrada no Laravel, iniciado pelo botão «Serviços e sistema».                                    |

O catálogo tem paginação de 24 produtos e filtros na URL. Compras podem incluir vários produtores, gerando uma encomenda por produtor. Leilões usam Socket.IO para lances e notificações, com consultas periódicas à API para recuperar falhas de ligação. A gestão de produtos e a criação de leilões ainda não têm formulários no frontend; estão disponíveis pela API.

O Vite serve `index.html` nos acessos diretos às rotas da SPA, tanto em desenvolvimento como em preview. A configuração encaminha `/api` e `/socket.io` para a API na porta 3000; o preview herda estes proxies. Em produção, o servidor que serve `dist` deve encaminhar caminhos que não correspondam a ficheiros para `index.html`, preservando o encaminhamento de `/api` e `/socket.io` (com WebSockets) para a mesma API. Este repositório não contém configuração de alojamento de produção.

Executar dentro de `frontend/`, com a API iniciada noutro terminal:

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

O frontend usa `http://127.0.0.1:8000` para o backoffice. Para alterar, copia `.env.example` para `.env` e define `VITE_BACKOFFICE_URL`. Nunca coloques `JWT_SECRET` ou `BACKOFFICE_SECRET` em variáveis `VITE_*`. Usa `127.0.0.1` também nos endereços Laravel e na origem `MARKETPLACE_SITE_URL`, conforme [a preparação do backoffice](../backoffice/app/README.md#preparação-local).

## Verificações disponíveis:

### Revisão visual e responsiva

- Rever componentes no contexto da página a 320, 375, 661, 768, 1024 e 1280 px; confirmar proporção, legibilidade e espaço ocupado, além da ausência de transbordo.
- No AuctionCard, com os dados de demonstração, confirmar altura até 420 px abaixo de 768 px e até 320 px a partir de 768 px. Estes limites são critérios de revisão, não alturas fixas de CSS.
- Capturar a HomePage com o destaque e o início do catálogo visíveis. A imagem deve manter as proporções, sem sobrepor texto.
- Rever textos longos, zoom a 200%, contagem com horas e estado terminado. Permitir crescimento natural do cartão quando necessário; nunca cortar informação para cumprir o limite de altura.
- Verificar teclado, contraste e estados dos componentes partilhados alterados antes de concluir.

### Comandos

```powershell
npm test
npm run build
npm run lint
```

`npm test` executa os testes de lógica existentes e os testes de interação React.
Para executar apenas um grupo, usa `npm run test:unit` ou `npm run test:ui`.
Os testes de interação usam Vitest, React Testing Library e jsdom, com respostas
da API simuladas; não precisam de servidor nem de base de dados. Cobrem checkout,
carrinho, sessão, páginas protegidas e atualização de encomendas. O workflow
`.github/workflows/frontend.yml` executa ambos os grupos através de `npm test`.
