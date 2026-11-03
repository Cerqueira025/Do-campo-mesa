# Auditoria do estado do projeto — 2 de novembro de 2026

Revisão do commit `76b7e9e`, dos dois PDFs principais, do frontend React, da API Express/Mongoose, dos sockets, da coleção Bruno, da configuração de integração contínua e do esqueleto Laravel.

> **Documento histórico.** Os achados, contagens e resultados abaixo descrevem
> a auditoria de 2 de novembro de 2026. Na revisão documental de 3 de novembro,
> o código já inclui Swagger UI, backoffice técnico Laravel e workflow de testes,
> lint e build do frontend. A documentação funcional também foi atualizada.
> Estas alterações não constituem uma nova auditoria nem comprovam a resolução
> dos restantes achados. Para preparação e comportamento atuais, consulta o
> [README principal](../README.md), o [frontend](../frontend/README.md),
> os [dados funcionais](dados-funcionais.md) e o [backoffice](../backoffice/app/README.md).

O projeto já tem uma base funcional considerável: catálogo com filtros e paginação, autenticação e papéis, carrinho, encomendas por produtor, avaliações, denúncias, administração React, reservas de stock e implementação de licitações por Socket.IO. Ainda não cumpre integralmente o enunciado. As maiores lacunas são a gestão pelo produtor, fotografias e storage, Swagger UI, preparação/publicação Cloud e entregáveis. Há também falhas concretas de segurança, integração e consistência.

Este documento contém todos os achados identificados nesta auditoria. Não constitui uma garantia de ausência de outros bugs: a cobertura e os limites estão explicitados abaixo. Nenhuma correção funcional foi aplicada.

## Critérios e grau de certeza

- **P0:** resolver antes de qualquer disponibilização pública.
- **P1:** falha importante de funcionamento, integridade ou verificação.
- **P2:** funcionalidade em falta, incoerência ou recuperação incompleta.
- **P3:** melhoria de acessibilidade, documentação ou caso limite.
- **Reproduzido:** observado no servidor/browser ou em reprodução isolada com o código atual.
- **Código:** conclusão sustentada pela implementação, sem executar a mutação na base atual.
- **Sem evidência:** não foi encontrado o entregável/configuração no repositório; não permite concluir o estado de contas e serviços externos.

O enunciado é a referência de funcionalidades e entregáveis. O guia foi usado para completar os critérios de verificação. Nomes de pastas, versões, nomes de hooks, desenho exato dos cartões e exemplos de código não foram tratados como obrigações de copiar. O routing próprio existente não foi classificado como bug apenas por não usar React Router. Laravel e auto-scaling são opcionais.

## Verificações executadas

| Verificação                              | Resultado                                                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Leitura do enunciado                     | 27 páginas, incluindo os protótipos                                                                                              |
| Leitura do guia                          | 95 páginas                                                                                                                       |
| Testes do frontend                       | 48 passaram; 0 falharam                                                                                                          |
| Compilação TypeScript e build Vite       | Passou                                                                                                                           |
| Testes da API                            | 197 passaram; 0 falharam; 2 ignorados por ausência de `MONGODB_TEST_URI`                                                         |
| ESLint frontend e JavaScript             | Passaram                                                                                                                         |
| Stylelint                                | Passou                                                                                                                           |
| Laravel Pint                             | Passou                                                                                                                           |
| Prettier                                 | Passou                                                                                                                           |
| Pedidos HTTP ao servidor local existente | 51 pedidos: 45 respostas 200, 1 resposta 400 esperada, 2 respostas 401 esperadas e 3 respostas 404; detalhe abaixo               |
| WebSocket real                           | Ligação, consulta de estado, histórico e presença num leilão terminado; reproduzida a separação de salas por capitalização do ID |
| Base MongoDB atual                       | Consulta de contagens, índices e estados, sem alterações                                                                         |
| Browser                                  | Catálogo, produto, produtor, login fictício de produtor, conta e encomendas; observações a 320, 375, 768 e 1280 px               |
| Reproduções isoladas                     | Exceção de socket, dupla reposição de stock na limpeza, incompatibilidades de quantidades e limite monetário                     |

A primeira execução dos testes HTTP da API encontrou `EACCES` nas ligações locais deste ambiente. Repetida com acesso às ligações locais, a suite passou. As 45 falhas dessa primeira execução não foram atribuídas ao projeto.

Não executei a coleção Bruno contra a base atual, porque cria e altera dados. Não enviei lances ao servidor real, não alterei passwords, produtos, encomendas ou decisões administrativas. As falhas destrutivas foram reproduzidas apenas em processos isolados e com persistência simulada. Não foi criada nem apagada uma base de testes real. O servidor e frontend existentes foram usados; uma tentativa de iniciar outro frontend foi interrompida.

## Estado observado da base e dos serviços

| Elemento                                           | Estado observado                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| API local                                          | Disponível; `/api/health` responde 200                              |
| Frontend local                                     | Disponível em `http://localhost:5173`                               |
| Utilizadores                                       | 22                                                                  |
| Produtos                                           | 39, dos quais 33 públicos                                           |
| Encomendas                                         | 29                                                                  |
| Leilões                                            | 12; todos terminados; nenhum ativo ou agendado                      |
| Licitações históricas                              | 27                                                                  |
| Avaliações                                         | 40; 8 denunciadas na consulta administrativa                        |
| Produtores pendentes                               | 0                                                                   |
| Leilões sem `reservaStock`                         | 0                                                                   |
| Índice único de email                              | Existe                                                              |
| Índice único de avaliação por autor/encomenda/alvo | Existe                                                              |
| Índice único parcial de encomenda por leilão       | Existe                                                              |
| Segredo JWT local                                  | Configurado e diferente do exemplo; o seu valor não foi exposto     |
| Swagger UI                                         | `/api-docs` devolve 404                                             |
| Publicação Cloud                                   | Não verificável: não há URLs públicos identificados na documentação |

As diferenças entre as contagens atuais e o seed não foram classificadas como corrupção: a base contém dados criados após o seed. Os índices necessários à unicidade já existem; não há fundamento para afirmar que estão em falta nesta base.

## Funcionalidades por concluir

### F01 — Gestão de produtos pelo produtor — P1, código e browser

Faltam os ecrãs para listar produtos próprios, criar, editar e remover produtos, alterar preços/stock e publicar/despublicar. A conta aprovada só oferece atualização do estado, avaliações e encomendas. A API já implementa POST, PUT e DELETE de produtos; o fluxo completo da SPA não existe.

**Evidência:** `frontend/src/navigation/AppRoutes.tsx`, `frontend/src/pages/AccountPage.tsx`, `api/src/routes/products.js:255`.
**Requisito:** enunciado, páginas 4 e 11; guia, página 26.

### F02 — Consulta privada do catálogo próprio — P1, código

O GET de produtos é exclusivamente público. Não há uma consulta autenticada para o produtor recuperar também os seus produtos despublicados ou bloqueados, nem um detalhe privado desses produtos. Reutilizar apenas o catálogo público torna a gestão de rascunhos e indisponíveis incompleta.

**Evidência:** filtros obrigatórios de publicação em `api/src/routes/products.js:37` e `:232`; não existe rota privada equivalente.

### F03 — Edição da exploração/página pública — P1, código

Faltam API e formulário para consultar e editar os próprios dados completos da exploração: descrição, localidade, morada e coordenadas. Esses dados são recebidos no registo e consultados publicamente de forma limitada, mas não podem ser corrigidos pelo produtor. `/auth/eu` só devolve a identidade resumida e a validação.

**Evidência:** `api/src/routes/producers.js`, `api/src/models/User.js`, `frontend/src/pages/AccountPage.tsx`.
**Requisito:** enunciado, página 4.

### F04 — Fotografias reais dos produtos e storage — P1, código

Faltam campo(s) de imagem no modelo/contrato, upload autenticado, validação de formato/tamanho, armazenamento e gestão das fotografias na SPA. A API não aceita imagens; o frontend escolhe fotografias locais por correspondência exata do nome. Um produto novo ou renomeado pode ficar sem imagem, e produtores distintos que vendem «Mel» recebem a mesma fotografia.

Falta também a integração com Blob Storage, S3 ou Cloud Storage exigida na arquitetura. Servir as imagens pelo build do frontend não cumpre essa parte do enunciado.

**Evidência:** `api/src/models/Product.js`, `api/src/routes/products.js`, `frontend/src/features/products/product.ts`, `frontend/README.md:45`.
**Requisito:** enunciado, páginas 4, 5 e 23; guia, páginas 37 e 85.

### F05 — Estatísticas de vendas do produtor — P1, código

Não há dashboard nem consultas agregadas de vendas, faturação por período, encomendas e evolução das vendas do produtor. Mostrar a sua média de avaliações na conta não cobre as estatísticas de vendas.

**Evidência:** rotas disponíveis em `AppRoutes.tsx` e `api/src/routes/producers.js`; conta sem indicadores de vendas.
**Requisito:** enunciado, páginas 4 e 11.

### F06 — Alertas de stock baixo — P2, código

Não existe a lista/indicador de produtos com stock baixo prevista para o painel do produtor. É necessário definir o critério de stock baixo por unidade e apresentá-lo na gestão.

**Requisito:** enunciado, página 11.

### F07 — Formulário de criação de leilão — P1, código e browser

Existe `POST /api/auctions`, mas falta o ecrã para escolher os produtos e quantidades do lote, preço base, incremento e datas/duração. Um produtor aprovado não consegue criar um leilão pela aplicação.

**Evidência:** `api/src/routes/auctions.js:55`; ausência da rota/formulário na SPA.
**Requisito:** enunciado, páginas 4 e 11; guia, página 26.

### F08 — Área dos leilões do produtor — P2, código

Falta uma listagem própria de leilões agendados, ativos, terminados e cancelados, com acesso ao acompanhamento e resultado. O endpoint público filtra apenas por estado e oculta lotes indisponíveis. Não substitui uma consulta privada dos leilões do dono, sobretudo quando há cancelamento ou moderação.

**Evidência:** `api/src/routes/auctions.js:17`, `frontend/src/navigation/AppRoutes.tsx`.

### F09 — Listagem pública de leilões — P2, código e browser

Não existe página `/leiloes` ou equivalente que permita descobrir todos os lotes. A homepage seleciona apenas um leilão ativo, o que termina primeiro. Os restantes ativos e os agendados não têm um percurso normal de descoberta pela interface.

**Evidência:** `FeaturedAuction.tsx`, `features/auctions/auction.ts:featuredAuction`, `AppRoutes.tsx`.
**Referência:** guia, página 26; funcionalidades de descoberta/acompanhamento dos leilões.

### F10 — Mapa representativo da localização — P2, implementação parcial

O mapa dentro da página é sempre o mesmo ficheiro ilustrativo, independentemente das coordenadas. Existe um link correto para abrir a localização real no Google Maps. A componente visual do mapa da exploração continua por completar se a intenção é mostrar a localização dentro da aplicação.

**Evidência:** `frontend/src/components/location/OriginMap.tsx`; observação no browser.
**Requisito:** página pública com mapa, enunciado, páginas 4 e 9. O link real já implementado foi considerado na avaliação; não se trata de ausência total de localização.

### F11 — Estado dos serviços no painel administrativo — P2, código

O resumo mostra utilizadores, encomendas, produtores pendentes e leilões ativos. Falta o estado de API, sockets, MongoDB, storage e Swagger UI previsto no ecrã de administração. O health check atual também não consulta o estado atual do MongoDB nem o processamento dos leilões.

**Evidência:** `features/admin/AdminPage.tsx`, `api/src/routes/admin.js`, `api/src/app.js`.
**Requisito:** enunciado, página 12.

### F12 — Aviso de aprovação/rejeição ao produtor — P2, referência do guia

A decisão administrativa não emite o evento `conta-validada` ou equivalente e o cliente não o trata. O produtor tem de atualizar manualmente a conta, recarregar ou voltar a iniciar sessão para ver a mudança. A API já consulta a validação atual nos pedidos protegidos; o que falta é o aviso/atualização na interface.

**Evidência:** PATCH de validação em `api/src/routes/producers.js`; `AccountPage.tsx`; `SocketProvider.tsx`.
**Referência:** tabela de eventos do guia, página 69.

## Bugs e incoerências no funcionamento

### B01 — Recuperação de password permite tomar qualquer conta — P0, código e testes existentes

`POST /api/auth/recuperar-password` aceita apenas email e nova password, sem prova de posse do email. Aplica-se também à conta de administrador. Tokens antigos continuam válidos depois da alteração.

Esta simplificação está explicitamente documentada como opção de demonstração. Continua a ser um impedimento para publicar o sistema com contas/dados reais. É necessário implementar recuperação com prova de posse e expiração/uso único, ou desativar esse fluxo no ambiente público. A alteração desta auditoria não incluiu testar ou mudar passwords na base atual.

**Evidência:** `api/src/routes/auth.js:99`, README e OpenAPI.

### B02 — Uma mensagem de socket mal formada pode terminar a API — P1, reproduzido isoladamente

Os handlers fazem `acknowledge?.(...)`, mas não verificam se o argumento é uma função. Um cliente pode enviar um objeto como segundo argumento de `entrar`. A falha volta a ocorrer dentro do `catch`, rejeitando a função assíncrona sem tratamento. Não é necessário autenticar para chegar a esse caminho.

Reprodução isolada do handler atual: `entrar('invalid-id', {})` terminou o processo Node com código 1 e `TypeError: acknowledge is not a function`, na linha 106. Não foi enviada essa mensagem ao servidor do utilizador.

**Correção necessária:** validar o tipo do callback e garantir tratamento das rejeições dos handlers, incluindo a recusa de `licitar`.
**Evidência:** `api/src/sockets/index.js:61`, `:104`, `:106`, `:137`.

### B03 — Detalhe de produto não revalida a cache — P1, código

`if (!id || cachedProduct) return` impede o GET do produto quando há um resultado do catálogo em memória. A cache não tem prazo de validade. Preço, stock, publicação, bloqueio e dados do produtor podem estar desatualizados; um produto retirado pode continuar a aparecer no detalhe.

Adicionar ao carrinho e finalizar voltam a consultar a API, pelo que esta falha não prova uma compra de produto bloqueado. O problema é a apresentação desatualizada e a contradição com a afirmação do README de que o detalhe confirma disponibilidade.

**Correção necessária:** mostrar a cache de imediato e confirmar os dados no servidor, tratando também 404/indisponibilidade.
**Evidência:** `frontend/src/pages/ProductDetailPage.tsx:71`, `features/home/catalogCache.ts`.

### B04 — IDs em maiúsculas dividem a sala do mesmo leilão — P2, reproduzido no servidor

O MongoDB aceita o ObjectId nas duas capitalizações, mas o nome da sala usa a string recebida sem normalização. Dois clientes entraram no mesmo leilão com ID minúsculo/maiúsculo: ambos receberam o mesmo `_id` no estado, mas cada sala apresentou presença 1. Ao normalizar o segundo ID, a presença passou a 2.

As licitações/transições podem ser emitidas para uma sala diferente daquela onde o outro cliente está, causando perda de atualização e presença incorreta.

**Correção necessária:** normalizar o identificador antes de formar, comparar ou emitir para salas.
**Evidência:** `api/src/sockets/index.js:9`, `:61`, `:119`, `:143`, `:217`.

### B05 — Histórico e lance próprio não recuperam após resultado incerto — P2, código

Depois de timeout num lance, a página manda «Consulte o histórico», mas o retry só volta a pedir o detalhe REST. Esse GET não contém as licitações nem o último lance próprio. O histórico é atualizado por `estado`/`nova-licitacao`, sem nova entrada explícita na sala após esse timeout. Se o evento se perdeu com a ligação ainda aparentemente aberta, o histórico pode continuar incompleto.

**Correção necessária:** disponibilizar recuperação explícita do estado completo/histórico ou repetir a sincronização da sala quando o resultado for incerto.
**Evidência:** `AuctionDetailPage.tsx:344`, `:400`, `:488`; `findPublicAuction()`.

### B06 — «Ligado» é marcado antes de confirmar entrada na sala — P2, código

`setConnected(true)` corre antes do ack de `entrar`. Se a entrada falhar, só se apresenta uma mensagem; a flag continua verdadeira. O ack de entrada não tem timeout e não há um estado distinto de «ligado ao servidor»/«entrada na sala confirmada». Uma ligação TCP/WebSocket válida pode assim habilitar o formulário sem uma sala válida; o servidor recusa depois o lance.

**Correção necessária:** habilitar a licitação apenas depois da sincronização/entrada confirmada e tratar falha/timeout de entrada.
**Evidência:** `frontend/src/pages/AuctionDetailPage.tsx:387`.

### B07 — Resultado final do leilão incompleto na página — P2, código

A sala passa a mostrar «Leilão terminado», mas não apresenta um resultado explícito com vencedor/sem vencedor e acesso à encomenda do lote para o vencedor. O evento `terminado` é usado apenas para voltar a pedir o detalhe; o conteúdo do resultado é ignorado. O aviso com a encomenda existe, mas é temporário e depende de estar ligado no momento do fecho.

**Correção necessária:** apresentar o resultado persistente e permitir recuperá-lo ao abrir novamente um leilão terminado.
**Evidência:** `AuctionDetailPage.tsx:460`, `:467`; `api/src/sockets/index.js:238`; `SocketProvider.tsx`.
**Referência:** guia, páginas 73 e 75.

### B08 — Destaque usa relógio local sem sincronização — P2, código

O destaque seleciona o leilão e calcula a contagem com `Date.now()` do dispositivo, sem o offset aplicado na sala. Um relógio adiantado pode esconder um leilão que o servidor ainda considera ativo, ou mostrar uma contagem divergente. A sala já tem uma correção pela hora do servidor; falta consistência no destaque.

**Evidência:** `FeaturedAuction.tsx:9`, `:16`; `features/auctions/auction.ts:featuredAuction`; `AuctionCard.tsx`.

### B09 — Stock fica bloqueado permanentemente após leilão com vencedor — P1, código

O PUT recusa alterações de stock/unidade se existir qualquer leilão do produto com reserva `reservada` ou `atribuida`. O fecho com vencedor grava `atribuida` e nenhuma transição posterior remove esse estado, mesmo depois da entrega. Consequência: um único leilão vendido impede repor stock desse produto indefinidamente.

A regra está documentada, mas limita a funcionalidade de gerir stock: uma atribuição histórica não devia, por si só, impedir novas reposições. É necessário definir a relação entre stock livre, reservas atuais e histórico, preservando as quantidades já vendidas.

Não há atualmente leilões `atribuida` nesta base; o problema afeta o próximo fluxo completo com vencedor.

**Evidência:** `api/src/routes/products.js:298`; `api/src/services/auctionStock.js:44`; ausência de alteração da reserva no fluxo de entrega.

### B10 — Leilões aceitam quantidades incompatíveis com as compras — P2, reproduzido no modelo

As encomendas comuns exigem múltiplos de 0,5 kg/l, 100 g e 1 unidade. A criação/modelo de leilão só exige quantidade finita positiva e stock suficiente. Foi validado um lote com `0.5 unidade`, recusado pelas regras de compra normais. As encomendas geradas por leilão herdam essas quantidades.

Pode ser uma regra comercial intencional para lotes; nesse caso precisa de ser definida e documentada. Para unidades indivisíveis, a aceitação de meia unidade é uma incoerência particularmente clara.

**Evidência:** `api/src/domain/purchaseQuantity.js`; `api/src/routes/auctions.js:65`; `api/src/models/Auction.js`.

### B11 — Valores monetários válidos isoladamente podem criar leilão impossível — P3, reproduzido no modelo

O modelo aceita preço base `Number.MAX_SAFE_INTEGER` e incremento 1. O mínimo seguinte deixa de ser inteiro seguro. O frontend recusa o objeto em `isAuction()` e nenhum lance válido pode atingir o mínimo. É um caso limite, mas deve ser rejeitado na criação.

**Evidência:** `api/src/models/Auction.js`, `api/src/models/fields.js`; `frontend/src/features/auctions/auction.ts:isAuction`.

### B12 — Chaves React duplicadas no detalhe do produto — P2, browser e código

`PublicReviews` e `RelatedProducts` são irmãos e usam a mesma `key={product._id}`. O browser registou o erro «Encountered two children with the same key» ao abrir o Mel do catálogo. Pode causar reconciliação incorreta ao atualizar a árvore; a mensagem já é um erro real na consola.

**Correção necessária:** remover as keys desnecessárias ou atribuir chaves distintas por responsabilidade.
**Evidência:** `frontend/src/pages/ProductDetailPage.tsx:338` e `:342`.

### B13 — Adicionar ao carrinho pode falhar sem feedback — P2, código

A página do produtor e os produtos relacionados chamam `adicionar()` mas não apresentam `CartContext.message` nem estado de operação. A função captura internamente os erros e não os propaga. Se houver falta de stock, produto removido, limite de quantidade ou erro da API, esses pontos da interface podem não mostrar a razão da falha. O catálogo e o painel principal do produto já apresentam essa mensagem.

**Evidência:** `ProducerDetailPage.tsx:84`; `features/products/RelatedProducts.tsx`; `features/cart/CartProvider.tsx`.

### B14 — Levantamento sem dados suficientes para o comprador — P2, código

Uma encomenda por levantamento mostra apenas «Levantamento junto do produtor». A API da encomenda só resolve nome/ID das partes; não inclui local de recolha. A morada do produtor é excluída dos perfis públicos. Não há contacto nem instruções/data de recolha no fluxo.

O link externo para coordenadas ajuda a localizar a exploração, mas não substitui a informação de levantamento na encomenda. Deve ser definido que local/instruções são partilhados com quem comprou, mantendo a privacidade dos restantes visitantes.

**Evidência:** `api/src/routes/orders.js` nos populate; `api/src/routes/producers.js:12`; `OrderDetailPage.tsx`, secção de levantamento.

### B15 — Cliente comum da API não suporta o CRUD completo — P2, código

`ApiOptions.method` só aceita GET, POST e PATCH. Falta PUT/DELETE para os ecrãs de gestão. Além disso, uma resposta 204 sem corpo é convertida em `ApiError`, porque o cliente exige JSON não nulo. A API de apagar produto devolve corretamente 204; o cliente partilhado ainda não consegue tratar esse sucesso.

**Evidência:** `frontend/src/api/client.ts:12`, `:52`; DELETE em `api/src/routes/products.js`.

### B16 — Rotas inexistentes devolvem HTML, contrariando o contrato de erros — P2, servidor

`GET /api/nao-existe` respondeu 404 com `text/html` e «Cannot GET …». Falta um handler JSON de 404 antes do middleware de erros. O cliente perde a mensagem específica e a documentação afirma um formato `{ erro: string }`.

Não se deve converter esse 404 em 200; deve conservar o estado e uniformizar o corpo.

**Evidência:** `api/src/app.js`; resposta real. Guia, página 45.

### B17 — Location de avaliação aponta para rota que não existe — P2, código

A criação devolve `Location: /api/reviews/:id`, mas não há GET dessa URI. Existem apenas consultas por produto, produtor e encomenda. Um consumidor que siga o Location não consegue recuperar a avaliação criada.

**Evidência:** `api/src/routes/reviews.js:91` e rotas do mesmo ficheiro.

### B18 — Scroll horizontal na largura de 320 px com barras clássicas — P2, browser

No browser desta auditoria, a viewport de 320 px apresentou largura útil de 305 px por causa da barra vertical. `html`/`body` têm `min-width: 320px`, produzindo scroll horizontal: `scrollWidth=320`, `clientWidth=305`. Foi observado nas encomendas. É um problema dependente do modo de barras do browser; não foi observado o mesmo transbordo na amostra a 375 px.

**Evidência:** `frontend/src/styles/base/_reset.scss:8` e `:14`.

### B19 — Contraste insuficiente nos preços/categorias dos cartões — P2, tokens e cálculo

Texto `brown-400` sobre fundo `brown-100`: contraste aproximado **2,27:1**. A categoria tem 16 px e o preço 18 px em negrito; ficam abaixo do mínimo de 4,5:1 indicado no guia para texto normal. A utilização de tokens está correta, mas a combinação de tokens precisa de ser revista. O «+» branco sobre o castanho também tem contraste baixo, aproximadamente 2,41:1.

**Evidência:** `components/product/ProductCard.scss:28`, `styles/abstracts/_tokens.scss`, `components/ui/IconButton.scss`.
**Referência:** guia, página 21.

### B20 — Falta atalho para saltar a navegação — P3, código

Não existe «Saltar para o conteúdo» nos layouts. Já há trabalho de foco e anúncio de navegação, mas o utilizador de teclado tem de atravessar o cabeçalho para chegar ao conteúdo.

**Evidência:** `App.tsx`, `AppHeader.tsx` e layouts. Referência: guia, página 21.

### B21 — Paginação administrativa pode ficar numa página inexistente — P3, código

A lista administrativa usa o `page` da URL e não o corrige quando o total diminui ou quando alguém abre uma página além do fim. Pode apresentar «Página 3 de 2» e uma lista vazia mesmo havendo resultados. O catálogo público já tem lógica para corrigir este caso, que não está aplicada à administração.

**Evidência:** `features/admin/AdminList.tsx`; comparação com `HomePage.tsx:correctingPage`.

## Testes, dados e integração contínua

### T01 — CI usa MongoDB sem suporte às transações exigidas — P1, código

O workflow inicia `mongo:7` como instância standalone: não configura replica set nem o inicializa. A aplicação agora usa transações para encomendas, criação/eliminação de produtos/leilões e processamento de stock. O seed coloca leilões com início atingido; o arranque tenta processá-los antes de abrir a porta HTTP.

Essa configuração não satisfaz o requisito de transações e pode impedir o health check de chegar a responder. Não executei o workflow remoto; a incompatibilidade está na configuração e é também reconhecida no README, que exige replica set/Atlas.

**Correção necessária:** usar MongoDB de testes com transações, aguardar a sua inicialização e passar as variáveis de testes adequadas.
**Evidência:** `.github/workflows/api.yml:14`; `api/src/server.js:35`; chamadas `withTransaction`.

### T02 — Coleção Bruno incompatível com as regras atuais de quantidade — P1, reproduzido no handler isolado

`07-functional/18-encomenda.bru` envia 0,5 kg + 0,75 kg e espera sucesso, 1,25 kg e total 189. A API rejeita 0,75 kg antes de criar a encomenda, pois agora só aceita múltiplos de 0,5 kg.

A execução isolada do handler de `POST /api/orders`, com o produto e a sessão apenas em memória, confirmou código 400 e a mensagem «Use múltiplos de 0,5 kg (mínimo 0,5 kg).» Nenhum pedido de criação foi enviado à base atual.

O teste seguinte espera stock 3,75, e vários testes posteriores dependem do ID `functionalOrder` criado nesse pedido. Há uma falha de base que pode provocar uma cascata de falhas de estados/avaliações. Os testes unitários passarem não valida esta coleção.

**Correção necessária:** decidir a regra comercial e alinhar pedidos, totais, stock esperado e cenários seguintes. Não é necessário alterar as regras só para fazer passar um teste desatualizado.
**Evidência:** `bruno/07-functional/18-encomenda.bru:29`, `19-stock-reservado.bru:14`, `api/src/domain/purchaseQuantity.js`.

### T03 — Limpeza de encomendas de teste pode repor stock duas vezes — P1, reproduzido isoladamente

A limpeza devolve stock das encomendas de catálogo com `$inc` e só apaga essas encomendas mais tarde. Se for interrompida entre as operações, a próxima execução volta a encontrar as mesmas encomendas e a incrementar o stock.

Na simulação com o código atual, stock 10 passou a 12; uma falha antes da remoção e nova execução levou-o a 14, quando o valor correto era 12. A limpeza dos leilões já usa uma transação; o problema está no caminho das encomendas de catálogo.

**Correção necessária:** tornar atómica e repetível a devolução da reserva e remoção/marcação de cada encomenda de teste.
**Evidência:** `api/src/scripts/cleanup-bruno.js:45` e `:71`.

### T04 — Seed não acompanha as novas regras de compra — P2, modelo e base atual

Foram encontradas **36 linhas de encomendas do seed** com quantidades incompatíveis com as regras atuais: por exemplo, 1,25 kg/l e 0,5 g. Embora dados históricos possam obedecer a regras antigas, o seed não apresenta essa distinção e continua a ser a base dos cenários funcionais.

Na base atual há **6 produtos públicos com stock positivo inferior à compra mínima**: três Méis com 42/52/62 g, quando o mínimo é 100 g, e três Nozes com 0,5 g. Não podem ser comprados pelo fluxo normal. No detalhe, `stock > 0` ainda pode ser apresentado como «Disponível» apesar de nenhuma quantidade ser válida.

**Correção necessária:** alinhar unidades/quantidades dos exemplos e distinguir esgotado/quantidade insuficiente na disponibilidade. Preservar dados existentes requer uma decisão explícita; o seed atual não atualiza documentos já inseridos.
**Evidência:** `api/src/scripts/seed-data.js:282`, `:302`; regras de quantidade e consultas reais.

### T05 — Dados atuais não permitem demonstrar um leilão ativo — P2, servidor

Os 12 leilões atuais terminaram. `db:seed` preserva os IDs e datas existentes, pelo que executá-lo outra vez não cria um lote ativo. Também não há produtores pendentes neste momento, limitando a demonstração da aprovação sem preparar novas contas.

**Correção necessária:** preparar um procedimento seguro de dados de demonstração para leilão ativo/agendado, dois compradores e produtor pendente. O formulário em falta em F07 é particularmente necessário para evitar depender de alterações manuais à base.

**Evidência:** consultas reais de leilões/pendentes; política `$setOnInsert` do seed.

### T06 — Falta prova automatizada completa com API, sockets e MongoDB reais — P1, cobertura

Os testes normais usam persistência simulada. Dois testes de MongoDB real estão preparados mas ficaram ignorados por falta de `MONGODB_TEST_URI`. A coleção Bruno cobre HTTP, mas não a licitação real por Socket.IO. Não há teste de ponta a ponta com dois clientes reais que cubra lance simultâneo, histórico confirmado, fecho, encomenda única e notificações.

Não é correto concluir, a partir dos 197 testes que passaram, que a concorrência real foi validada nesta execução. É necessário preparar um ambiente isolado de testes e produzir a evidência exigida para o desafio central.

**Evidência:** `api/test/socket-auctions.test.js`, `auction-stock-integration.test.js`, `review-reports-integration.test.js`, `api/src/scripts/test-api.js`.
**Requisito:** enunciado, página 7; guia, páginas 79, 90 e 91.

### T07 — CI não verifica o frontend nem o conjunto de qualidade — P2, configuração

O único workflow encontrado instala/testa a API e corre Bruno. Faltam execução dos testes frontend, compilação TypeScript/Vite e verificações de lint/formatação no fluxo de CI. Nesta revisão esses comandos passaram localmente, mas futuras regressões nessas áreas não são apanhadas pelo workflow atual.

**Evidência:** `.github/workflows/api.yml`; `frontend/package.json`; `package.json` da raiz.

## Swagger, Cloud e entregáveis

### D01 — Swagger UI não está implementado — P1, servidor e código

Existe `docs/openapi.yaml`, mas `/api-docs` devolve 404 e a aplicação não serve Swagger UI. Falta publicar a interface, permitir Authorize/Try it out e disponibilizá-la também no endereço Cloud.

**Evidência:** `api/src/app.js`, `api/package.json`; pedido real a `/api-docs`.
**Requisito:** enunciado, páginas 5 e 19; guia, páginas 58 e 59.

### D02 — OpenAPI mistura regras de versões diferentes — P1, análise estrutural

**Resolvido em 2026-11-03.** As quatro restrições de quantidade identificadas usam agora `minimum: 0` e `exclusiveMinimum: true`, compatíveis com OpenAPI 3.0.3.

A especificação completa, atualmente com 39 caminhos, passou `SwaggerParser.validate`, incluindo validação estrutural OpenAPI 3.0.3 e resolução das referências locais.

**Evidência:** `docs/openapi.yaml`, schemas `OrderCreateInput`, `AuctionInput`, `Order` e `Auction`.
**Fontes do formato:** [OpenAPI 3.0.3 — Schema Object](https://spec.openapis.org/oas/v3.0.3.html#schema-object), [JSON Schema referenciado — minimum/exclusiveMinimum](https://json-schema.org/draft-04/draft-fge-json-schema-validation-00#rfc.section.5.1.3).

### D03 — Schemas incompletos ou divergentes das respostas reais — P2, código e documento

**Resolvido em 2026-11-03.** Os quatro contratos identificados foram alinhados com os modelos e handlers da API:

- `ProductCreateInput` exige nome, descrição, categoria, preço, unidade e stock na criação; `ProductInput` mantém a atualização parcial no PUT.
- `Review` descreve o autor como ID nas avaliações próprias; `ReviewWithAuthor`, usado na criação e moderação, descreve o objeto com ID/nome, ou `null` se removido.
- As listagens e os detalhes administrativos têm schemas por recurso, incluindo paginação, decisões, denúncias, visibilidade e referências resolvidas que podem ser `null`. O detalhe de produto inclui os leilões associados e o detalhe de leilão inclui até vinte licitações. Nas avaliações administrativas, `encomendaId` mantém o ID, conforme a implementação.
- `Delivery` distingue levantamento de entrega com `oneOf`; entrega exige uma morada com pelo menos um carácter que não seja espaço.

**Verificação:** validação completa com `SwaggerParser.validate`; 32 verificações de contratos com Ajv Draft 4, incluindo campos obrigatórios de produto, atualização parcial, moradas válidas/inválidas, variantes de autor e respostas dos handlers das cinco listagens e quatro detalhes administrativos. A comparação dos handlers usou dados do seed e persistência simulada, sem alterar a base de dados. Passaram ainda os 63 testes de `admin`, `reviews`, `order-reviews`, `orders`, `auction-order-delivery` e `models`.

**Evidência:** `docs/openapi.yaml`, schemas `ProductCreateInput`, `Review`, `ReviewWithAuthor`, `Delivery` e `Admin*`; `api/src/routes/admin.js`, `products.js`, `reviews.js` e `orders.js`.

### D04 — Publicação Cloud e URLs não estão demonstrados — P1, sem evidência

Não foram encontrados URLs públicos da SPA/API/Swagger no README nem configuração de publicação da aplicação. Não tive acesso ao portal Cloud para verificar recursos eventualmente criados fora do repositório.

Falta fornecer ou preparar publicação PaaS da API e SPA, HTTPS/WSS, variáveis/segredos no serviço, ligação Atlas a partir da Cloud, WebSockets e evidência dos testes em dois dispositivos. A integração de imagens em storage continua em falta conforme F04.

**Requisito:** enunciado, páginas 23 e 25; guia, páginas 80–88 e 94.

### D05 — Encaminhamento da API/sockets e CORS de produção por definir — P1, código e preflight

O frontend usa `/api` e `/socket.io` na mesma origem. O proxy Vite resolve isto localmente. Não há configuração de produção equivalente no repositório, nem URL base externa configurável para todos os pedidos e sockets. Há vários `fetch` diretos fora do cliente comum.

A API também não configura CORS. O preflight de login com uma origem distinta respondeu 200 sem `Access-Control-Allow-Origin` nem `Access-Control-Allow-Headers`. Assim, a arquitetura de frontend/API em domínios distintos do guia não está pronta para pedidos do browser.

É necessário escolher e implementar uma das opções: origem única com reverse proxy para HTTP/WebSocket, ou origens separadas com configuração dos clientes e CORS adequado. CORS não é necessário só por existir uma API se a origem única for corretamente usada.

**Evidência:** `frontend/vite.config.ts`, `frontend/src/api/client.ts`, `SocketProvider.tsx`, vários pedidos das páginas; `api/src/app.js` e `server.js`.

### D06 — Fallback das rotas SPA no alojamento por preparar — P2, sem configuração

Não existe configuração de alojamento que assegure `index.html` ao abrir/recarregar diretamente uma rota da SPA, preservando `/api`, `/socket.io` e assets. O README do frontend reconhece que o repositório não contém configuração de alojamento de produção. O funcionamento local no Vite não prova o comportamento no alojamento final.

**Evidência:** `frontend/README.md:56`, conteúdo de `frontend/public`.
**Requisito:** guia, páginas 86 e 88.

### D07 — Documentação funcional desatualizada — P2, confirmado

Há afirmações que já não correspondem ao código:

- `frontend/README.md:54`: «As encomendas ainda não estão disponíveis».
- `docs/dados-funcionais.md:52`: mistura de produtores devolveria 400; a API agora cria encomendas por produtor e devolve 201.
- `docs/dados-funcionais.md:81`: não haveria licitações em tempo real nem conversão em encomenda; essas implementações já existem.
- `docs/dados-funcionais.md:83`: a interface só mostraria os primeiros 24 produtos; já existe paginação.
- README afirma que os detalhes confirmam disponibilidade, mas o detalhe com cache não faz GET (B03).

É necessário atualizar os cenários, instruções de execução e limites reais. Os resultados históricos de testes de outubro devem ser identificados como históricos, sem parecer validação da versão atual.

### D08 — Relatório final por entregar — P1, sem evidência no repositório

Não foi encontrado o relatório final. Os documentos técnicos existentes não cobrem o entregável de até 20 páginas, incluindo arquitetura, frontend/routing/estado/breakpoints, decisões de embedding/linking, API/Swagger, segurança, consistência das licitações, Cloud/modelos de serviço/custos, dificuldades e declaração de ferramentas/IA. Falta incluir a evidência de testes reais e concorrência.

**Requisito:** enunciado, páginas 25 e 27; guia, páginas 91, 92 e 94.

### D09 — Vídeo e preparação da demonstração por confirmar — P1, sem evidência

Não foi encontrado vídeo nem ligação para ele. Falta a demonstração de até 5 minutos com os quatro papéis, duas janelas/compradores e comportamento simultâneo do leilão. É necessário preparar dados atuais, URLs ativos até à defesa e uma demonstração que inclua os fluxos ainda em falta do produtor.

**Requisito:** enunciado, página 25; guia, página 94.

## Componentes opcionais

- **Laravel (+1 valor no enunciado):** a pasta contém o esqueleto da aplicação, a rota de boas-vindas, migrations e testes de exemplo. Não há backoffice funcional, autenticação administrativa ou consumo da API implementado em Laravel. A administração React existente não preenche esse componente opcional específico. Não é uma falta obrigatória para o núcleo do projeto.
- **Elasticidade e análise de custos (+0,5 no enunciado):** não há prova de auto-scaling/carga nem análise de custos para esse extra. A distribuição dos sockets por várias instâncias também exigiria um adaptador de salas partilhado; o README já reconhece essa limitação. A operação de uma só instância não foi classificada como bug.

## Ordem sugerida para resolver

1. Resolver B01/B02 antes de disponibilizar publicamente e corrigir o bloqueio permanente de stock de B09.
2. Tornar a verificação fiável: replica set no CI, coleção Bruno alinhada e limpeza de dados de teste atómica (T01–T03).
3. Implementar gestão do produtor: consultas privadas, CRUD, perfil, fotos, criação/acompanhamento de leilões e estatísticas (F01–F08).
4. Corrigir cache, salas, sincronização/recuperação, resultado do leilão e feedback de interface (B03–B08, B12–B15).
5. Publicar Swagger UI e corrigir/validar OpenAPI (D01–D03).
6. Preparar publicação Cloud, imagens, encaminhamento e fallback; testar HTTPS/WSS em dois dispositivos (F04, D04–D06).
7. Preparar ambiente isolado e executar os testes reais, com dados de demonstração adequados (T04–T07).
8. Fechar acessibilidade, documentação, relatório e vídeo (B18–B21, D07–D09).

## Limites que permanecem

- Não foi executado um checkout completo, um novo leilão com vencedor ou uma moderação real nesta auditoria; esses caminhos foram analisados no código e nos testes existentes.
- Não foi executada a coleção Bruno inteira nem o workflow GitHub remoto. As incompatibilidades reportadas têm evidência concreta na configuração e nas regras atuais.
- Não foi provada a consistência real com lances concorrentes e MongoDB de testes; os dois testes opcionais foram ignorados.
- A revisão visual foi uma amostra de páginas/tamanhos, não uma certificação de todas as combinações de conteúdo, zoom, browsers e dispositivos.
- Não foram inspecionados recursos Cloud externos, permissões do repositório partilhado com o docente ou entregáveis guardados fora do projeto.
- A revisão automática recusou a tentativa de testar a rejeição de um lance no servidor atual por poder alterar dados se a autorização falhasse. O teste real foi limitado a consultas de estado/presença; a rejeição de lances foi verificada apenas nos testes isolados existentes.

O estado inicial do Git estava limpo. O único ficheiro acrescentado ao projeto por esta auditoria é este relatório.
