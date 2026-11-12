# Dados de demonstração

## Preparar a base para avaliação

1. Instala as dependências e configura `api/.env` conforme o [início rápido](../README.md#início-rápido). Usa um MongoDB com suporte a transações e define `MONGODB_DB_NAME=do_campo_a_mesa_demo`, ou outro nome de uma base vazia. Mantém `SEED_PASSWORD=CampoMesaDemo123!` para usar as contas abaixo.
2. Na raiz do projeto, prepara as coleções e carrega o seed:

   ```powershell
   npm --prefix api run db:init
   npm --prefix api run db:seed
   ```

3. [Inicia a API e o frontend](../README.md#3-arrancar-a-api-e-o-frontend) e abre [a aplicação](http://127.0.0.1:5173). O backoffice Laravel é opcional para avaliar os fluxos do marketplace.

O seed carrega contas, produtos, encomendas, avaliações e leilões fictícios.
Não apaga nem altera documentos existentes, incluindo palavras-passe. Repetir o
comando após uma execução completa não duplica os dados; se a primeira execução
for interrompida, pode ser repetida para inserir os documentos em falta.

## Contas de demonstração

**Palavra-passe inicial de todas as contas abaixo: `CampoMesaDemo123!`.** Aplica-se
às contas criadas com o valor predefinido de `SEED_PASSWORD`. Usa estas contas
apenas numa instalação de demonstração. Se alterares `SEED_PASSWORD`, a nova
palavra-passe só se aplica às contas que ainda não foram criadas.

| Contas                                                | Papel e estado                                           | IDs numéricos |
| ----------------------------------------------------- | -------------------------------------------------------- | ------------- |
| `admin@example.test`                                  | Administrador: gestão de produtores e moderação          | 1             |
| `ana@example.test`                                    | Comprador: catálogo, encomendas e leilões                | 2             |
| `restaurante@example.test`                            | Comprador: segunda conta para testar licitações          | 3             |
| `produtor@example.test`                               | Produtor aprovado: produtos, stock, encomendas e leilões | 4             |
| `pendente@example.test`                               | Produtor a aguardar aprovação                            | 5             |
| `rejeitado@example.test`                              | Produtor rejeitado                                       | 6             |
| `comprador1@example.test` a `comprador6@example.test` | Compradores                                              | 1001–1006     |
| `quinta1@example.test`                                | Produtor aceite, Viana do Castelo                        | 1101          |
| `quinta2@example.test`                                | Produtor aceite, Braga                                   | 1102          |
| `quinta3@example.test`                                | Produtor aceite, Ponte de Lima                           | 1103          |
| `quinta4@example.test`                                | Produtor aceite sem produtos, Viana do Castelo           | 1104          |
| `quinta5@example.test`                                | Produtor pendente, Braga                                 | 1105          |
| `quinta6@example.test`                                | Produtor rejeitado, Ponte de Lima                        | 1106          |

Para experimentar a concorrência entre compradores, segue o
[guião de demonstração do leilão](#demonstrar-um-leilão-com-dois-compradores).

## Identificadores dos dados

Converter cada ID numérico com `seedId(n)` de `api/src/scripts/seed-data.js`:
`dca000000000` + número hexadecimal com 12 posições. Por exemplo, 2001 corresponde a `dca0000000000000000007d1`.

| Intervalo adicional               | Conteúdo                                                             |
| --------------------------------- | -------------------------------------------------------------------- |
| 2001–2010 / 2011–2020 / 2021–2030 | Dez produtos públicos de cada uma das quintas 1, 2 e 3               |
| 2031–2032                         | Produtos não publicados da quinta 1                                  |
| 2033–2034 / 2035–2036             | Produtos dos produtores pendente e rejeitado                         |
| 3001–3012                         | Encomendas entregues com duas linhas e avaliações elegíveis          |
| 3013–3016 / 3017–3020 / 3021–3024 | Encomendas pendentes, confirmadas e prontas                          |
| 4001–4003 / 4004–4006 / 4007–4009 | Leilões de início futuro, início já atingido e históricos terminados |
| 5001–5024                         | Seis licitações por cada leilão 4004, 4005, 4007 e 4008              |
| 6001–6036                         | Três avaliações por encomenda entregue: dois produtos e um produtor  |

O stock dos produtos representa a disponibilidade remanescente; não é deduzido novamente ao inserir encomendas históricas.
As linhas guardam preços históricos diferentes dos atuais. Valores monetários são cêntimos inteiros;
o total soma o arredondamento individual de cada linha. Existem stocks zero e fracionários e as quatro unidades suportadas.
As imagens dos produtos são escolhidas no frontend pelo nome, a partir de ficheiros WebP locais.
Produtos sem imagem correspondente apresentam “Imagem indisponível”.

## Resultados esperados após inserção inicial

Estes resultados referem-se aos exemplos sem compras, decisões ou passagem do ciclo
de leilões posteriores. Não são contagens da base atualmente configurada.

- `GET /api/products?q=exploração funcional&limit=24&page=1`: 24 de 30 resultados; página 2 contém os outros 6, sem repetições.
- Os IDs 2031–2036 não aparecem no catálogo nem no detalhe público. Stock zero continua visível: não existe filtro automático de stock.
- As opções públicas incluem as três localidades, sem duplicados, e as quintas 1–3; excluem as quintas 4–6.
- Combinar produtor 1101, categoria `Hortícolas`, `bio=true`, `epoca=primavera`, localidade `Viana`, `precoMin=1.51` e `precoMax=1.51` devolve o produto 2001. Os limites de preço do catálogo são euros.
- As médias públicas dos produtos 2001, 2011, 2021, 2003 e 2013 são, respetivamente, 3; 3,5; 4; 4,5; 5. O produto 2005 não tem avaliações.
- As 24 avaliações de produtos são públicas; as 12 de produtores dividem-se entre denunciadas e ocultas e não contribuem para médias públicas.
- Leilões 4006 e 4009 não têm licitações; o valor atual mantém o preço base e o comprador é nulo.
- Pedidos de encomenda a produtores não aceites devolvem 409. Uma compra com vários produtores aceites devolve 201 e uma lista com uma encomenda por produtor, mesmo quando existe apenas um. A criação e a reserva de stock são uma única transação; uma falha reverte o conjunto. Preços, nomes e unidades enviados pelo cliente são ignorados; linhas do mesmo produto são consolidadas.

Nas compras do catálogo, as quantidades seguem as regras partilhadas em
`shared/purchaseQuantity.mjs`: múltiplos de 1 para `unidade`, de 100 para `g` e de
0,5 para `kg` e `l`, com mínimo igual ao passo. Stock positivo inferior ao mínimo
não permite uma compra válida. Estas restrições das compras não alteram os
snapshots históricos nem a validação própria das quantidades de um lote de leilão.
Os dados gerados para uma base nova usam quantidades válidas nas compras e stock
igual ou superior ao mínimo nos produtos com stock positivo. Como o seed preserva
registos existentes, bases já inicializadas não são alteradas automaticamente.

Os testes funcionais usam os exemplos inseridos inicialmente. Se forem alterados manualmente, o seed preserva essas alterações e alguns resultados esperados podem deixar de se aplicar.
Não inserir dados inválidos para testar rejeições: enviar pedidos inválidos à API.

## Testes e limites

`npm test` valida os schemas, cobertura, relações, conflitos antes das escritas, preservação dos documentos e cálculo das encomendas.
Os testes locais de transação usam uma sessão simulada. A coleção Bruno inclui
cenários para verificar rollback contra MongoDB com suporte a transações;
executá-los é necessário para obter evidência real, e não aconteceu nesta revisão documental.

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
A listagem pública exige que todos os produtos do lote existam, estejam publicados,
não estejam bloqueados e pertençam ao produtor do leilão. O produtor tem de estar
aprovado. A lista omite leilões indisponíveis; o detalhe devolve 404 para esses
leilões e para identificadores inválidos.
Leilões terminados continuam consultáveis se cumprirem essas condições.

O destaque da página inicial usa leilões reais da API e seleciona o ativo com fim mais próximo.
O destaque e o detalhe voltam a consultar a API a cada cinco segundos.
Os contadores atualizam-se localmente a cada segundo, sem inferir uma ativação.
Entradas inválidas são ignoradas individualmente no destaque. No detalhe, compradores
autenticados podem licitar por Socket.IO; a API confirma cada lance antes de emitir
eventos. Um leilão com reserva e vencedor gera uma encomenda única no fecho.
O vencedor escolhe levantamento ou entrega no detalhe da encomenda para a confirmar.
Leilões históricos já terminados não são convertidos retroativamente.
A interface apresenta 24 produtos por página, com Anterior/Seguinte e `page` na URL.

## Demonstrar um leilão com dois compradores

Prepara a API e o frontend pelo [README](../README.md) e carrega os dados de
demonstração numa base de desenvolvimento. Usa a palavra-passe definida ao
carregar os exemplos.

1. Entra como `quinta1@example.test` e abre **Novo leilão**. Escolhe um produto
   publicado e desbloqueado com stock suficiente. Define o preço base em **1,00 €**,
   o incremento em **0,10 €** e escolhe **Começar agora**. Dá tempo suficiente até
   ao fim para abrir as sessões e licitar. Guarda o endereço público `/leiloes/:id`
   do lote criado.
2. Abre esse endereço em dois perfis de navegador separados (por exemplo, um
   perfil normal e uma janela privada). Entra como `comprador1@example.test`
   num e `comprador2@example.test` no outro. Com o leilão ativo, confirma nas duas
   sessões o preço inicial de **1,00 €**, o mínimo de **1,10 €** e a presença de
   dois participantes. Mantém a sessão do produtor fora da página pública.
3. Prepara **1,10 €** nas duas sessões e submete os lances o mais próximo possível.
   Confirma que o histórico mostra uma única licitação de **1,10 €**, com o mesmo
   comprador em ambas, e que o novo mínimo é **1,20 €**. Se ambos os pedidos
   chegarem ao servidor, um é recusado. Se a atualização chegar à outra sessão
   antes do envio, a interface pode impedir o envio do valor desatualizado.
4. Recarrega as duas páginas e confirma que o valor e o histórico se mantêm.
   Para verificar o fecho, deixa o leilão terminar com as sessões abertas e observa
   as notificações no vencedor e no produtor. Ambas devem abrir a mesma encomenda;
   o outro comprador não deve receber uma notificação de vitória.

O guião descreve o resultado esperado no navegador. Para provar que dois pedidos
foram efetivamente enviados e que só um foi persistido, usa o
[teste de integração com MongoDB real](operacoes-locais.md#validar-leilões-com-mongodb-real).
Essa execução não verificou a entrega das notificações privadas de fecho.

Repetir o seed não reabre leilões nem repõe produtores já decididos como pendentes.
Antes de iniciar os leilões, confirma os índices com `npm run db:init`.

## Verificação em 15 de outubro de 2026

Registo histórico da execução nessa data; não representa testes repetidos nesta revisão
nem os totais atuais. Os comandos e os fluxos atuais estão descritos acima.

- 20 testes locais passaram; 71 pedidos/testes Bruno passaram contra Atlas, incluindo os 33 novos cenários.
- Foram inseridos exatamente 141 documentos. A repetição inseriu zero e a comparação do conteúdo completo confirmou preservação dos documentos e dos timestamps.
- Índices existentes confirmados, incluindo o índice único de email.
- A base continha uma conta adicional aos exemplos: os totais após expansão são 19 utilizadores, 39 produtos, 27 encomendas, 12 leilões, 27 licitações e 38 avaliações.

Os leilões usam `produtos`, uma lista obrigatória com quantidade e unidade por produto.
O exemplo 4004 é um lote misto de 2 kg de Batata e 10 g de Mel do mesmo produtor;
as regras de compra do catálogo não se aplicam às quantidades deste lote.
Esse exemplo só é acrescentado em novas inserções; o seed preserva leilões já existentes.
A imagem de capa vem do primeiro produto e a licitação aplica-se ao lote completo.
Antes de usar uma base antiga, executar a migração descrita no README, com a API parada.
