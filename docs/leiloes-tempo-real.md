# Leilões em tempo real

O frontend abre uma ligação Socket.IO em `/socket.io` por WebSocket. Visitantes
podem acompanhar um leilão público. Para autenticar a ligação, o cliente envia
`auth: { token }` na abertura; um token inválido é recusado. Só compradores
autenticados que tenham entrado na sala podem licitar.

| Cliente → servidor | Dados e confirmação                                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entrar`           | Recebe o ID do leilão. O servidor envia `estado` ao cliente, atualiza a presença e confirma com `{ ok: true }`. Se a entrada falhar, responde `{ ok: false, erro }`.                    |
| `sair`             | Recebe o ID do leilão. Retira o cliente da sala e atualiza a presença, sem confirmação.                                                                                                 |
| `licitar`          | Recebe `{ leilaoId, valor }`, com `valor` em cêntimos inteiros. Responde `{ ok: true, valor }` após confirmar a transação ou `{ ok: false, erro }` se o lance não puder ser confirmado. |

| Servidor → cliente                  | Destino e dados                                                                                                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `estado`                            | Cliente que entra: `{ agora, leilao, licitacoes, ultimaLicitacaoPropria }`. `agora` é a hora do servidor em ISO 8601. `licitacoes` contém até 20 lances recentes; `ultimaLicitacaoPropria` é `null` quando não existe lance próprio. |
| `presenca`                          | Sala: número de ligações na sala, incluindo visitantes.                                                                                                                                                                              |
| `nova-licitacao`                    | Sala: lance confirmado, com `{ _id, valor, compradorId, nome, createdAt }`. Os lances de `estado` usam os mesmos campos.                                                                                                             |
| `aberto`                            | Sala: `{ id }`.                                                                                                                                                                                                                      |
| `cancelado`                         | Sala: `{ id, motivo }`.                                                                                                                                                                                                              |
| `terminado`                         | Sala: `{ id, valor, vencedor }`, em que `vencedor` indica se houve vencedor.                                                                                                                                                         |
| `leilao-ganho` / `leilao-terminado` | Ligações autenticadas do vencedor e do produtor, respetivamente. Enviados quando o fecho cria uma encomenda, com `{ id, encomendaId }`.                                                                                              |

O servidor só emite `nova-licitacao` depois de confirmar, na mesma transação,
a atualização do valor atual e a gravação no histórico. A página consulta
`GET /api/auctions/:id` a cada cinco segundos para atualizar o estado público.
Ao voltar a ligar, envia `entrar` para recuperar o histórico recente e o último
lance próprio. Se não receber confirmação do lance, atualiza o estado e pede
ao comprador que consulte o histórico antes de tentar novamente.

Ver também o [guião no navegador](dados-funcionais.md#demonstrar-um-leilão-com-dois-compradores)
e os [resultados com MongoDB real](operacoes-locais.md#validar-leilões-com-mongodb-real).
