# Administração

A área React começa em `/admin` e exige o papel atual `administrador` na API.
Inclui resumo, aprovação de registos pendentes, moderação de produtos e avaliações,
utilizadores, encomendas e todos os estados dos leilões. O botão «Serviços e sistema»
abre o backoffice técnico Laravel, com entrada direta, verificações locais e histórico
de 30 dias. Consulta [a preparação e funcionamento do backoffice](../backoffice/app/README.md).
A execução sem infraestrutura Cloud foi acordada com o professor. Gráficos ficam fora desta implementação.

## Entrada no backoffice técnico

O botão «Serviços e sistema» inicia a sessão Laravel em `/entrar`, regressa à SPA
em `/admin/backoffice?state=…` e envia um código temporário por POST para `/entrada`.
O JWT não passa no endereço do browser. A configuração exige `BACKOFFICE_SECRET`
igual nos dois servidores e a mesma origem local (`127.0.0.1`) nos endereços de entrada.

| Endpoint da API                          | Autorização e função                                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `POST /api/admin/backoffice/codes`       | Administrador com JWT; recebe `{ state }` e emite código de utilização única, válido até 60 segundos.                   |
| `POST /api/internal/backoffice/exchange` | Servidor Laravel com `X-Backoffice-Secret`; troca `{ code, state }` por autenticação, preservando a expiração original. |
| `GET /api/admin/services`                | Administrador com JWT; executa diagnóstico de MongoDB e Socket.IO.                                                      |

O Laravel verifica ainda `/api/health` e Swagger, mostra o armazenamento como
não implementado e guarda os cinco resultados no histórico SQLite. O diagnóstico
é iniciado ao abrir Serviços por POST com CSRF, ou pelo botão «Verificar agora»;
não existe verificação periódica. Abrir o histórico não executa diagnósticos.

## Consultas

- `GET /api/admin/summary`: `{ users: { [papel]: total }, orders: { [estado]: total }, pendingProducers, activeAuctions }`.
- `GET /api/admin/users`, `/products`, `/reviews`, `/orders`, `/auctions`:
  `{ items, page, limit, total }`. Produtos incluem também `categorias`, independentemente da página e dos filtros.
- `GET /api/admin/users/:id`, `/products/:id`, `/reviews/:id`, `/auctions/:id`:
  detalhes, mesmo de recursos ocultos. Encomendas reutilizam `GET /api/orders/:id`.

Listagens recebem `q` (até 100 caracteres, pesquisa literal), `page` (inteiro positivo)
e `limit` (1–100; a interface usa 24). Filtros:

| Recurso      | Filtros                                                               |
| ------------ | --------------------------------------------------------------------- |
| Utilizadores | `papel`, `validacao`                                                  |
| Produtos     | `categoria`, `visibilidade`, `produtorId`                             |
| Avaliações   | `estado`, `alvo` (`produto`/`produtor`), `produtorId`                 |
| Encomendas   | `estado`, `origem` (`catalogo`/`leilao`), `produtorId`, `compradorId` |
| Leilões      | `estado`, `produtorId`                                                |

`visibilidade` admite `publica`, `despublicado`, `bloqueado` e `produtor-indisponivel`.
Os filtros de indisponibilidade podem sobrepor-se: um produto pode estar
despublicado e bloqueado em simultâneo. `visivel` representa a disponibilidade
pública efetiva. Os detalhes de produtos incluem `leiloes` associados; os de
leilões incluem `licitacoes` com os últimos vinte lances.

Utilizadores expõem dados da conta e do perfil, sem hashes. Produtos expõem dados
do catálogo, publicação e bloqueio separados. Avaliações incluem autor, alvo,
encomenda, nota, comentário, estado, `totalDenuncias` e `denuncias`, com autor público,
motivo e data de cada denúncia. Documentos antigos sem denúncias devolvem lista vazia.
Estes dados são exclusivos da administração. Encomendas incluem as partes e o snapshot
da compra. Leilões incluem produtor, produtos, reserva, datas, valores e estado
efetivo. Referências removidas são apresentadas como indisponíveis.

## Decisões

- `PATCH /api/producers/:id/validacao`: `{ validacao: 'aceite' | 'rejeitado', motivo?, decisaoAnterior? }`.
- `PATCH /api/reviews/:id/moderacao`: `{ estado: 'publicada' | 'oculta', motivo?, decisaoAnterior?, atualizadoEm? }`.
- `PATCH /api/admin/products/:id/moderacao`: `{ bloqueado: boolean, motivo?, decisaoAnterior? }`.

Motivo obrigatório ao rejeitar/ocultar, com 1–500 caracteres após remover espaços
nas extremidades. `decisaoAnterior` é a data ISO da última decisão observada,
ou `null` quando não existe (também o valor assumido para clientes antigos que
omitam o campo). Cada atualização compara essa referência atomicamente; dados
desatualizados devolvem `409` e exigem atualizar e confirmar novamente.
Uma aprovação/rejeição só atua num registo ainda pendente. Qualquer administrador
pode reverter a moderação de produtos e avaliações, sem validação de outros.

Na moderação de avaliações, a interface conserva também o `updatedAt` observado ao
abrir a confirmação e envia-o como `atualizadoEm`. A comparação é atómica: novas
denúncias durante a análise devolvem `409`, sem alterar o estado. O campo continua
opcional para clientes anteriores. As denúncias incrementam a referência temporal
mesmo quando chegam no mesmo milissegundo.

Compradores e produtores autenticados podem denunciar avaliações de terceiros de
alvos públicos com `POST /api/reviews/:id/denuncias` e `{ motivo }` (1–500 caracteres).
Não precisam de uma compra. A primeira denúncia retira imediatamente a avaliação
da publicação; outras contas ainda podem denunciar a mesma avaliação. A escrita
atómica permite uma denúncia por conta e avaliação, preservada após republicação.
Na lista, filtrar por `denunciada` mostra a fila de análise; o detalhe apresenta
motivos, autores e datas. Ocultar ou republicar preserva o conteúdo e as denúncias.

Nos detalhes administrativos, `ultimaDecisao` contém
`{ administradorId: { _id, nome } | null, data, motivo }`. Apenas a última decisão
é conservada. Dados antigos sem decisão continuam válidos. O bloqueio e os dados
da decisão são excluídos das consultas e serializações normais; as consultas
administrativas pedem-nos explicitamente. O produtor não pode alterar estes campos.

Bloquear não altera `publicado`, stock, preços, descrições ou encomendas. Repor
remove apenas o bloqueio: o produto só fica público se também estiver publicado
e o produtor estiver aprovado. Documentos antigos sem `bloqueado` são elegíveis.
Não é necessária migração dos dados existentes.

A elegibilidade é aplicada ao catálogo, filtros, contagens, perfil público,
detalhes, compras, criação e início de leilões e licitações. Compras e reservas
revalidam-na nas escritas transacionais. Licitações e ocultação coordenam-se por
escritas no produto, tal como a criação de leilões, para impedir lances após uma
ocultação confirmada.

Leilões associados deixam de ser públicos e de aceitar novos lances. Os ativos
preservam os lances e reservas: o fecho pode gerar uma encomenda para o vencedor
ou devolver stock quando não houver vencedor. Os agendados podem cancelar no
início por indisponibilidade. Ocultar/repor nunca cancela encomendas nem devolve
stock diretamente. A confirmação mostra os leilões associados e estes efeitos.

## Interface e verificação

Pesquisa, filtros e página ficam na URL; os detalhes preservam o endereço de
regresso. Resumo, encomendas e leilões consultam a API a cada cinco segundos,
apenas enquanto visíveis e sem sobreposição de ciclos. As restantes páginas
carregam ao entrar, após decisões ou ao selecionar Atualizar. Falhas temporárias
mantêm os dados da mesma consulta com indicação de erro.

O menu segue os filtros do catálogo: lateral a partir de 1024 px, acima do conteúdo
nos restantes ecrãs, sem sobreposição. A escolha de abrir/fechar mantém-se durante
a navegação. Tabelas no desktop, cartões no telemóvel, avaliações sempre em cartões.
Botões, campos, pesquisa, imagens e navegação de sessão reutilizam os componentes
existentes; as cores provêm dos tokens.

Executar `npm test` em `api/` e `npm test`, `npm run lint`, `npm run build` em
`frontend/`. Testes HTTP locais precisam de permissão de ligação a `127.0.0.1`.
Os testes normais simulam persistência e não precisam de Atlas. O teste de
concorrência MongoDB existente mantém-se optativo via `MONGODB_TEST_URI`,
exclusivamente numa base de testes isolada. A coleção Bruno inclui consultas
administrativas e a primeira decisão definitiva sobre registos pendentes.
