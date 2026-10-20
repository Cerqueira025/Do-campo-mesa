# Dados funcionais MongoDB

Executar dentro de `api/`: `npm test`, seguido de `npm run db:seed`.
O comando usa a BD configurada em `MONGODB_DB_NAME`; não apaga nem atualiza documentos existentes.
Uma segunda execução insere zero documentos. Não executar em simultâneo com alterações aos dados ou com Bruno.
Não há garantia de inserção atómica do conjunto: uma falha de rede pode deixar parte inserida; repetir conclui os documentos em falta.

## Contas e identificadores

Os exemplos antigos e as suas contas permanecem disponíveis. Novas contas usam a mesma password inicial
`SEED_PASSWORD` (por defeito `CampoMesaDemo123!`), com bcrypt; alterações posteriores da variável não mudam contas existentes.

| Contas | Papel e estado | IDs numéricos |
| --- | --- | --- |
| `comprador1@example.test` a `comprador6@example.test` | Compradores | 1001–1006 |
| `quinta1@example.test` | Produtor aceite, Viana do Castelo | 1101 |
| `quinta2@example.test` | Produtor aceite, Braga | 1102 |
| `quinta3@example.test` | Produtor aceite, Ponte de Lima | 1103 |
| `quinta4@example.test` | Produtor aceite sem produtos, Viana do Castelo | 1104 |
| `quinta5@example.test` | Produtor pendente, Braga | 1105 |
| `quinta6@example.test` | Produtor rejeitado, Ponte de Lima | 1106 |

Converter cada ID numérico com `seedId(n)` de `api/src/scripts/seed-data.js`:
`dca000000000` + número hexadecimal com 12 posições. Por exemplo, 2001 corresponde a `dca0000000000000000007d1`.

| Intervalo adicional | Conteúdo |
| --- | --- |
| 2001–2010 / 2011–2020 / 2021–2030 | Dez produtos públicos de cada uma das quintas 1, 2 e 3 |
| 2031–2032 | Produtos não publicados da quinta 1 |
| 2033–2034 / 2035–2036 | Produtos dos produtores pendente e rejeitado |
| 3001–3012 | Encomendas entregues com duas linhas e avaliações elegíveis |
| 3013–3016 / 3017–3020 / 3021–3024 | Encomendas pendentes, confirmadas e prontas |
| 4001–4003 / 4004–4006 / 4007–4009 | Leilões de início futuro, início já atingido e históricos terminados |
| 5001–5024 | Seis licitações por cada leilão 4004, 4005, 4007 e 4008 |
| 6001–6036 | Três avaliações por encomenda entregue: dois produtos e um produtor |

O stock dos produtos representa a disponibilidade remanescente; não é deduzido novamente ao inserir encomendas históricas.
As linhas guardam preços históricos diferentes dos atuais. Valores monetários são cêntimos inteiros;
o total soma o arredondamento individual de cada linha. Existem stocks zero e fracionários e as quatro unidades suportadas.
As imagens dos produtos são escolhidas no frontend pelo nome, a partir de ficheiros WebP locais.
Produtos sem imagem correspondente apresentam “Imagem indisponível”.

## Resultados esperados após inserção inicial

- `GET /api/products?q=exploração funcional&limit=24&page=1`: 24 de 30 resultados; página 2 contém os outros 6, sem repetições.
- Os IDs 2031–2036 não aparecem no catálogo nem no detalhe público. Stock zero continua visível: não existe filtro automático de stock.
- As opções públicas incluem as três localidades, sem duplicados, e as quintas 1–3; excluem as quintas 4–6.
- Combinar produtor 1101, categoria `Hortícolas`, `bio=true`, `epoca=primavera`, localidade `Viana`, `precoMin=1.51` e `precoMax=1.51` devolve o produto 2001. Os limites de preço do catálogo são euros.
- As médias públicas dos produtos 2001, 2011, 2021, 2003 e 2013 são, respetivamente, 3; 3,5; 4; 4,5; 5. O produto 2005 não tem avaliações.
- As 24 avaliações de produtos são públicas; as 12 de produtores dividem-se entre denunciadas e ocultas e não contribuem para médias públicas.
- Leilões 4006 e 4009 não têm licitações; o valor atual mantém o preço base e o comprador é nulo.
- Pedidos de encomenda a produtores não aceites devolvem 409; misturar produtores devolve 400. Preços, nomes e unidades enviados pelo cliente são ignorados; linhas do mesmo produto são consolidadas.

Os testes funcionais usam os exemplos inseridos inicialmente. Se forem alterados manualmente, o seed preserva essas alterações e alguns resultados esperados podem deixar de se aplicar.
Não inserir dados inválidos para testar rejeições: enviar pedidos inválidos à API.

## Testes e limites

`npm test` valida os schemas, cobertura, relações, conflitos antes das escritas, preservação dos documentos e cálculo das encomendas.
Os testes locais de transação usam uma sessão simulada; a garantia real de rollback é verificada pela coleção Bruno contra MongoDB.

Com a API iniciada, executar `npm run test:api`. A pasta `bruno/07-functional` acrescenta 33 pedidos aos testes existentes,
usa as sessões criadas nas pastas anteriores e `demoPassword` do ambiente Bruno. Executar a coleção completa, pela ordem das pastas.
Os pedidos que alteram stock, encomendas ou moderação criam documentos temporários com os marcadores existentes;
a limpeza remove-os e devolve as reservas. Os exemplos persistentes não usam esses marcadores.

As datas dos leilões são relativas à primeira inserção e não são renovadas pelo seed.
O seed guarda os exemplos ainda por terminar como `agendado`/`pendente`.
A API reserva o lote no início antes de o marcar `ativo`; só a passagem do tempo
não o ativa. Finais sem vencedor devolvem a reserva; com vencedor mantêm o lote
atribuído. Falta de stock ou produto/produtor indisponível cancela sem reserva parcial.
O processamento é retomado no arranque e repetido com cinco segundos de intervalo.
Exemplos históricos terminados têm `sem-reserva`, sem descontos retroativos.
A listagem pública exige todos os produtos existentes e publicados, pertencentes ao produtor do leilão, e produtor atualmente aprovado;
leilões indisponíveis são omitidos e o detalhe devolve 404, incluindo identificadores inválidos.
Leilões terminados continuam consultáveis se cumprirem essas condições.

O destaque da página inicial usa leilões reais da API e seleciona o ativo com fim mais próximo.
O destaque e o detalhe voltam a consultar a API a cada cinco segundos.
Os contadores atualizam-se localmente a cada segundo, sem inferir uma ativação.
Entradas inválidas são ignoradas individualmente no destaque. Não existem ainda
licitações em tempo real ou conversão de leilão em encomenda.
A interface só apresenta os primeiros 24 produtos; a paginação é testada na API.

## Verificação em 15 de outubro de 2026

- 20 testes locais passaram; 71 pedidos/testes Bruno passaram contra Atlas, incluindo os 33 novos cenários.
- Foram inseridos exatamente 141 documentos. A repetição inseriu zero e a comparação do conteúdo completo confirmou preservação dos documentos e dos timestamps.
- Índices existentes confirmados, incluindo o índice único de email.
- A base continha uma conta adicional aos exemplos: os totais após expansão são 19 utilizadores, 39 produtos, 27 encomendas, 12 leilões, 27 licitações e 38 avaliações.

Os leilões usam `produtos`, uma lista obrigatória com quantidade e unidade por produto.
O exemplo 4004 é um lote misto de 2 kg de Batata e 10 g de Mel do mesmo produtor.
Esse exemplo só é acrescentado em novas inserções; o seed preserva leilões já existentes.
A imagem de capa vem do primeiro produto e a licitação aplica-se ao lote completo.
Antes de usar uma base antiga, executar a migração descrita no README, com a API parada.
