# Operações locais

Executa os comandos a partir da raiz do repositório. Para configurar a ligação,
segue o [quick start](../README.md#2-configurar-a-base-de-dados-mongodb).

## Migrar leilões antigos

Para a API e confirma que `api/.env` aponta para a base a migrar. Executa os
comandos por ordem e só volta a arrancar a API depois de todos concluírem:

```powershell
npm --prefix api run db:migrate:auction-products
npm --prefix api run db:migrate:auction-stock
npm --prefix api run db:init
```

A primeira migração converte a associação antiga numa lista de produtos. A segunda
marca os leilões antigos terminados como `sem-reserva` e prepara os restantes
para reservar stock no arranque da API. As migrações podem ser repetidas e
preservam os documentos já migrados. Se o comando indicar documentos inválidos,
corrige-os antes de repetir. Numa base nova basta `db:init`.

## Fazer uma cópia de segurança e restaurar

Para a API e, se o usares, o Laravel. Garante que nenhum outro processo escreve
na base durante a cópia. Guarda estes elementos juntos numa pasta privada fora
do repositório:

1. **MongoDB:** exporta a base indicada por `MONGODB_DB_NAME` com
   [`mongodump`](https://www.mongodb.com/docs/database-tools/mongodump/).
   Usa um ficheiro de configuração privado com a URI de origem em `uri` e
   substitui `BASE_ORIGEM` pelo nome da base. Corre o comando na pasta da cópia:

   ```powershell
   mongodump --config="CAMINHO_CONFIG_ORIGEM" --db="BASE_ORIGEM" --archive=marketplace.archive --gzip
   ```

2. **Fotografias:** copia `api/uploads/products`, se existir, incluindo as duas
   variantes WebP de cada fotografia. Os documentos MongoDB referenciam esses ficheiros.
3. **Histórico Laravel:** se usares o backoffice, abre
   `backoffice/app/database/database.sqlite` com a ferramenta `sqlite3` e usa
   `.backup CAMINHO_DA_COPIA` para criar um ficheiro SQLite autónomo.

Para testar o restauro, usa uma instalação separada e uma base MongoDB vazia com
suporte a transações. Com a API e o Laravel dessa instalação parados, corre
[`mongorestore`](https://www.mongodb.com/docs/database-tools/mongorestore/) na
pasta da cópia, com a configuração privada da ligação de destino:

```powershell
mongorestore --config="CAMINHO_CONFIG_DESTINO" --archive=marketplace.archive --gzip --nsInclude="BASE_ORIGEM.*" --nsFrom="BASE_ORIGEM.*" --nsTo="BASE_DESTINO.*" --stopOnError
```

Confirma que o restauro terminou sem erros, aponta a API para a base de destino
e repõe as fotografias no mesmo caminho relativo. Se copiaste o SQLite, coloca
a cópia em `backoffice/app/database/database.sqlite` na instalação de teste.
Arranca os serviços e confirma o catálogo, a imagem de um produto com fotografia
carregada e, se aplicável, o histórico do backoffice. Volta a iniciar sessão no
backoffice. Guarda a configuração e os segredos separadamente dos dados.

## Redefinir a palavra-passe de uma conta

A redefinição é feita por um operador com acesso ao terminal e permissões de
escrita no MongoDB. O email serve apenas para identificar a conta, mesmo quando
é fictício.

1. Para a API para fechar também as ligações Socket.IO já abertas.
2. Confirma que `MONGODB_URI` e `MONGODB_DB_NAME` em `api/.env` apontam para a
   base pretendida.
3. Executa o comando abaixo, substituindo o email pelo da conta.

```powershell
npm --prefix api run db:reset-password -- conta@example.test
```

O comando normaliza o email e gera uma palavra-passe aleatória. Só a mostra no
terminal depois de confirmar a escrita. Se o email for inválido, a conta não
existir ou a escrita falhar, termina com erro e não mostra uma palavra-passe.
Entrega a nova palavra-passe em privado e volta a arrancar a API.

O MongoDB guarda o hash bcrypt e incrementa a versão de sessão
(`sessionVersion`) da conta na mesma operação. A API, a ligação Socket.IO e a
troca de códigos de entrada do Laravel rejeitam credenciais com uma versão
anterior. Contas e credenciais antigas sem versão equivalem a `0`, pelo que
não é necessária uma migração e as restantes contas mantêm as sessões.

O endereço antigo de recuperação devolve `404`.
Os testes automatizados cobrem a rota antiga, a mudança de credenciais e a
revogação de tokens e códigos com persistência simulada. Para confirmar o
comando de ponta a ponta, usa uma base MongoDB isolada: verifica que a
palavra-passe anterior e o JWT antigo são recusados, que a nova palavra-passe
funciona e que o JWT de uma segunda conta continua válido.

## Validar leilões com MongoDB real

O [teste de integração](../api/test/auction-stock-integration.test.js) requer
um replica set com suporte a transações. Arranca o seu próprio servidor
Socket.IO numa porta local e cria uma base temporária com o prefixo
`codex_stock_test_`. A conta MongoDB precisa de permissões para criar e apagar
essa base. O teste apaga-a no fim e não usa a base da aplicação.

Para usar a ligação `MONGODB_URI` de `api/.env`, executa na raiz do projeto:

```powershell
node --env-file=api/.env --input-type=module -e '
  import { spawnSync } from "node:child_process";
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI em falta");
  const result = spawnSync(process.execPath, ["--test", "api/test/auction-stock-integration.test.js"], {
    stdio: "inherit",
    env: { ...process.env, MONGODB_TEST_URI: process.env.MONGODB_URI }
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
'
```

Se `MONGODB_TEST_URI` já estiver definida no terminal, basta executar
`node --test api/test/auction-stock-integration.test.js`. Sem essa variável, o
teste é ignorado.

**Resultado de 11 de novembro de 2026 (MongoDB Atlas):** 11 testes passaram
(10 subtestes e o teste que os agrupa), sem falhas nem testes ignorados.

| Cenário                                | Resultado observado                                                                                                                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entrada na sala                        | Dois compradores autenticados ligaram-se por WebSocket. Ambos receberam a hora do servidor e o estado inicial. A presença confirmou dois participantes.                                             |
| Dois lances simultâneos de 1,10 €      | Um foi aceite. O outro foi recusado com o novo mínimo de 1,20 €.                                                                                                                                    |
| Persistência e estado partilhado       | O MongoDB guardou um único lance. Ambos os clientes receberam uma única vez o mesmo evento `nova-licitacao` e, ao voltar a entrar na sala, viram o mesmo histórico, valor e comprador na liderança. |
| Falha simulada na escrita do histórico | A transação no MongoDB reverteu a atualização do lance. O histórico ficou intacto e nenhum novo evento de licitação foi enviado.                                                                    |
| Fecho concorrente                      | Foi criada uma única encomenda para o vencedor, pelo valor do lote. Noutro subteste, a falha ao criar a encomenda reverteu o fecho sem emitir evento.                                               |

O fecho é testado separadamente ao nível do serviço. A execução não verifica
a entrega das notificações privadas de fecho nem a apresentação no navegador.

## Testar a API com Bruno

Com a API a correr e os [dados de demonstração](dados-funcionais.md) carregados,
abre a pasta `bruno/` no Bruno e seleciona o ambiente `local`. Se a palavra-passe
do seed for diferente da predefinida, ajusta `demoPassword` em
`bruno/environments/local.bru`. Para correr toda a coleção:

```powershell
npm --prefix api run test:api
```

A coleção faz escritas reais e limpa as contas `bruno-test-*` e os documentos
marcados com `BRUNO_AUTOTEST_`. Usa uma base de demonstração e evita usá-la
simultaneamente para outras operações.

Para validar apenas o contrato OpenAPI e os testes do Swagger, sem MongoDB:

```powershell
npm --prefix api run test:docs
```
