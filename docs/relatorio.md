# Do Campo à Mesa — Relatório do projeto

Desenvolvimento Web e para a Cloud · Mestrado em Engenharia Informática · IPVC–ESTG

## 1. O que foi desenvolvido

O Do Campo à Mesa é um mercado digital que liga produtores locais a consumidores e restaurantes. O visitante pode pesquisar e filtrar o catálogo e consultar o perfil público dos produtores. O comprador pode encomendar para entrega ou levantamento, acompanhar o estado da encomenda, avaliar a compra após a entrega e licitar em leilões.

O produtor pode editar o perfil e, depois de aprovado, gerir produtos, fotografias e stock, acompanhar encomendas e criar leilões de um produto ou de um cabaz. A área de administração permite validar produtores, moderar produtos e avaliações e consultar encomendas e leilões.

## 2. Arquitetura e decisões de implementação

- **Interface:** foi desenvolvida uma SPA em React e TypeScript, com Vite, Sass e módulos do Bootstrap 5. O React permite reutilizar cartões, botões e campos entre páginas; o TypeScript ajuda a manter consistentes os dados usados nos formulários e nas respostas da API. Os estilos seguem uma abordagem Mobile First e usam cores e breakpoints partilhados para manter a interface coerente.
- **Catálogo:** os filtros ficam no endereço, para que a mesma pesquisa possa ser partilhada ou recuperada pelo histórico. Ao regressar de um produto, a interface recupera a lista, a posição e o foco. Uma cache em memória mostra os resultados anteriores de imediato, enquanto a API confirma se continuam atuais.
- **Servidor e acessos:** a API REST em Express usa Mongoose para aceder ao MongoDB e documenta os pedidos e respostas em OpenAPI, consultável pelo Swagger UI. As palavras-passe são guardadas como hashes bcrypt. O JWT identifica a sessão, mas a API consulta o papel atual na base de dados, para que uma mudança de permissões tenha efeito mesmo com um token ainda válido.
- **Dados e encomendas:** os produtos referenciam o produtor, cujo perfil é gerido separadamente. Numa encomenda de catálogo, as linhas guardam o nome e o preço unitário de cada produto no momento da compra, para preservar o histórico. Uma compra com artigos de duas quintas gera duas encomendas, porque cada produtor trata da sua parte. A API confirma as quantidades, desconta o stock e grava as encomendas numa transação: se um artigo já não estiver disponível, a compra é revertida por inteiro. O produtor só pode avançar para o estado seguinte: pendente, confirmada, pronta e entregue.
- **Fotografias:** a API guarda localmente duas versões WebP, com 480 e 960 píxeis de largura. Assim, os cartões podem usar imagens mais pequenas e o detalhe pode mostrar uma versão com maior resolução.

## 3. Leilões: como se evita aceitar dois lances iguais

Cada leilão tem uma sala Socket.IO. A sala recebe o estado e as novas licitações; a contagem decrescente usa a hora de fim fornecida pelo servidor. As salas pessoais permitem enviar notificações de encomendas e de leilões aos utilizadores envolvidos. Se houver uma falha de ligação, a interface pode recuperar o estado através da API.

A dificuldade principal foi impedir que dois lances do mesmo valor fossem aceites em simultâneo. Por exemplo, se o valor atual é **30 €**, o incremento é **2 €** e dois compradores oferecem **32 €** quase ao mesmo tempo, o MongoDB só atualiza o leilão se este ainda estiver ativo, tiver stock reservado, estiver dentro do horário e o lance continuar a cumprir o mínimo. A primeira atualização coloca o valor nos 32 €; a segunda oferta de 32 € deixa de ser válida, pois o mínimo passa a 34 €.

A atualização do valor atual e a gravação no histórico de lances ficam na mesma transação. O servidor só divulga o lance depois de a transação ser confirmada. O stock é reservado quando o leilão abre, para que o lote não seja vendido pelo catálogo durante a licitação. No fecho, o servidor cria uma encomenda para o vencedor ou devolve o stock se não houver vencedor.

## 4. Execução, backoffice e validação

A aplicação e a API são executadas localmente, conforme o âmbito registado na [documentação de administração](administracao.md). O MongoDB pode ser local ou usar o Atlas, desde que suporte transações. O repositório não inclui publicação da aplicação em PaaS nem armazenamento de imagens na Cloud. Numa publicação futura, um PaaS seria adequado para alojar a aplicação e a API sem gerir máquinas virtuais; a API precisaria de suporte para WebSockets, e as fotografias passariam para armazenamento de objetos.

O backoffice Laravel é opcional e concentra o diagnóstico dos serviços. A administração do mercado permanece no React. Para abrir o diagnóstico, o Laravel troca um código temporário de utilização única com a API, sem colocar o JWT no endereço do navegador. Os resultados dos diagnósticos ficam em SQLite, separados dos dados do mercado.

O repositório inclui testes da API, testes de interação no frontend e uma coleção Bruno para exercitar os endpoints. Entre os cenários cobertos estão permissões, mudanças de estado das encomendas, reserva e devolução de stock e licitações concorrentes. O [README](../README.md) indica como executar a aplicação e os testes.

Em 11 de novembro de 2026, os [testes de integração com MongoDB Atlas](operacoes-locais.md#validar-leilões-com-mongodb-real) passaram: 10 subtestes e o teste que os agrupa, sem falhas nem testes ignorados. Dois compradores enviaram lances iguais por WebSocket: o servidor aceitou um só lance, guardou um registo no histórico e comunicou o mesmo estado aos dois clientes. Um subteste separado confirmou que o fecho concorrente cria uma única encomenda. A entrega das notificações privadas de fecho não foi verificada nessa execução. O teste foi executado manualmente: o workflow da API não define `MONGODB_TEST_URI`, pelo que não corre esta suite de integração.

**Uso de IA:** foi utilizado o Codex para consultar o repositório e preparar esta versão do relatório.
