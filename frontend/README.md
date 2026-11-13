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

- `src/pages/auth/` — páginas do fluxo de autenticação: `LoginPage` e `RegisterPage`.
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

O formulário de edição permite carregar, substituir e remover uma fotografia por
produto, com pré-visualização e gravação separada dos restantes dados. Depois de
criar um produto, a aplicação abre a edição para permitir adicionar a fotografia.
O upload é binário e autenticado; aceita JPEG, PNG e WebP estáticos até 5 MiB e
25 milhões de píxeis. A API valida o conteúdo, corrige a orientação, remove
metadados e guarda variantes WebP de 480 e 960 px em `api/uploads/products`.
Esta pasta está fora do Git e deve ser preservada juntamente com a base de dados.
As variantes são servidas publicamente em `/api/uploads/products/`; não há storage Cloud.

As imagens antigas de `src/assets/` continuam incluídas no build. Quando o produto
não tem o campo `fotografia`, `productImages` mantém a associação pelo nome em
`src/features/products/product.ts`. Um UUID nesse campo identifica o upload e
mantém a fotografia mesmo após renomear o produto; `null` representa remoção
explícita. Produtos sem imagem apresentam “Imagem indisponível”.

### Endereços e alojamento

As rotas são resolvidas em `src/navigation/AppRoutes.tsx`. A navegação interna usa a History API, preservando o endereço real dos links, abertura noutro separador e cliques com modificadores. O parâmetro `regresso` conserva o endereço do catálogo e os seus filtros; a cache em memória permite restaurar lista, scroll e foco.

| Rotas                                                                            | Acesso e função                                                                              |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `/`, `/produtos/:id`, `/produtores/:id`, `/leiloes/:id`                          | Catálogo, produtos, perfis e leilões públicos.                                               |
| `/login`, `/registo`                                                             | Entrada e registo.                                                                           |
| `/conta`                                                                         | Conta autenticada e estado de aprovação do produtor.                                         |
| `/carrinho`                                                                      | Visitantes e compradores; artigos agrupados por produtor.                                    |
| `/finalizar-encomenda`, `/encomendas`                                            | Finalização e acompanhamento por compradores.                                                |
| `/produtor`                                                                      | Resumo da área do produtor.                                                                  |
| `/produtor/encomendas`                                                           | Acompanhamento e avanço de estado pelo produtor.                                             |
| `/produtor/perfil`                                                               | Consulta e edição do próprio perfil por qualquer produtor, incluindo pendentes e rejeitados. |
| `/produtor/produtos`, `/produtor/produtos/novo`, `/produtor/produtos/:id/editar` | Gestão dos produtos próprios por produtores aprovados.                                       |
| `/produtor/leiloes`, `/produtor/leiloes/:id`                                     | Lista, detalhe e histórico de licitações dos leilões próprios, para produtores aprovados.    |
| `/produtor/leiloes/novo`                                                         | Criação de leilões com um produto ou cabaz por produtores aprovados.                         |
| `/encomendas/:id`                                                                | Detalhe protegido de uma encomenda do comprador ou produtor.                                 |
| `/admin` e subrotas                                                              | Resumo, listas, detalhes e moderação por administradores.                                    |
| `/admin/backoffice`                                                              | Passo de entrada no Laravel, iniciado pelo botão «Serviços e sistema».                       |

O catálogo tem paginação de 24 produtos e filtros na URL. Compras podem incluir vários produtores, gerando uma encomenda por produtor. Leilões usam Socket.IO para lances e notificações, com consultas periódicas à API para recuperar falhas de ligação. Produtores aprovados podem gerir produtos e criar leilões pela interface. O formulário de leilões permite um ou vários produtos publicados, desbloqueados e com stock, com início imediato ou agendado na hora local. O preço base e o incremento aplicam-se ao lote completo. A criação valida o stock; a reserva ocorre no início, pelo ciclo existente no servidor.

O Vite serve `index.html` nos acessos diretos às rotas da SPA, tanto em desenvolvimento como em preview. A configuração encaminha `/api` e `/socket.io` para a API na porta 3000; o preview herda estes proxies. Em produção, o servidor que serve `dist` deve encaminhar caminhos que não correspondam a ficheiros para `index.html`, preservando o encaminhamento de `/api` e `/socket.io` (com WebSockets) para a mesma API. Este repositório não contém configuração de alojamento de produção.

Executar dentro de `frontend/`, com a API iniciada noutro terminal:

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

O frontend usa `http://127.0.0.1:8000` para o backoffice. Para alterar, copia `.env.example` para `.env` e define `VITE_BACKOFFICE_URL`. Nunca coloques `JWT_SECRET` ou `BACKOFFICE_SECRET` em variáveis `VITE_*`. Usa `127.0.0.1` também nos endereços Laravel e na origem `MARKETPLACE_SITE_URL`, conforme [a preparação do backoffice](../backoffice/app/README.md#preparação-local).

## Verificações

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

## Área do produtor

### Gestão de produtos

Produtores aprovados acedem pela conta a `/produtor/produtos`,
`/produtor/produtos/novo` e `/produtor/produtos/:id/editar`.
A lista privada inclui produtos despublicados e bloqueados, com 24 produtos por página.
O formulário envia apenas os campos alterados, aceita preços com vírgula ou ponto
(convertidos em cêntimos), stock zero ou fracionado e validade opcional.
Novos produtos começam despublicados. Publicar não remove bloqueios administrativos.
Alterações confirmadas invalidam os resultados e as opções de filtros do catálogo.
A eliminação exige confirmação e recusa produtos com leilões associados.
Reservas de stock impedem alterações de stock ou unidade. A fotografia pode ser
alterada em produtos despublicados ou bloqueados; isso não remove o bloqueio.

### Perfil da exploração

O acesso «Editar perfil da exploração» na conta abre `/produtor/perfil`.
O formulário consulta `GET /api/producers/me` e envia apenas as alterações por
`PATCH`, mantendo a aprovação atual. A descrição é opcional; localidade, morada,
latitude e longitude são obrigatórias. Alterar as coordenadas envia sempre o par.
A morada só aparece nesta consulta privada. Guardar invalida a cache do catálogo
e das opções de filtros, para refletir a nova localização.

## Layout das áreas de gestão

`ManagementLayout`, em `src/components/layout/`, partilha o cabeçalho, identificação
da área, menu e coluna principal entre produtor e administração. `ProducerArea`
e `AdminLayout` configuram os links e a seleção; as permissões continuam nas áreas
e nas rotas existentes. O menu fica fora de `main`, com um único `h1` no conteúdo.

Ambas as áreas usam largura máxima de 1280 px, margem lateral de 24 px e menu de
256 px a partir de 1024 px. Em ecrãs menores, o menu começa recolhido e abre acima
do conteúdo. Acompanha o breakpoint até uma escolha explícita, depois conserva-a
por área durante navegação e remontagens, apenas em memória até recarregar.

O mixin `management-surface` uniformiza os painéis sem alterar a organização de
listas, tabelas e formulários. Os estilos dos produtos pertencem a
`ProducerProducts.scss`; encomendas integradas usam `order-content`, sem depender
da administração. A conta autónoma mantém os seus próprios estilos.

O menu do produtor organiza-se em Gerir exploração (conta, perfil e encomendas),
Produtos (Os meus produtos e Novo produto) e Leilões (Os meus leilões e Novo leilão).
Os dois últimos grupos só aparecem para produtores aprovados. Os links de criação
ficam ativos nos respetivos formulários; detalhes e edição mantêm a listagem ativa.
