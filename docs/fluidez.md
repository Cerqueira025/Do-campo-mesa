# Navegação e fluidez

## Comportamento

Os percursos catálogo → produto, produtos relacionados e leilão usam a History API.
Os links mantêm o endereço real, abertura noutro separador e cliques com modificadores.
O botão de regresso atravessa o histórico até à entrada original do catálogo quando essa origem é conhecida;
num acesso direto, usa o destino interno validado no parâmetro `regresso`.

Cada entrada conserva uma posição e o link de origem em memória. O regresso restaura a pesquisa, os filtros,
a lista, o scroll e o foco. As mudanças de página são anunciadas através do título do documento.
O painel de filtros conserva o seu estado durante a sessão.

A cache contém no máximo dez consultas normalizadas do catálogo e as últimas opções de filtros.
Não usa `localStorage`, não guarda detalhes nem substitui a confirmação de disponibilidade na API.
Ao regressar, os resultados anteriores aparecem imediatamente e são atualizados em segundo plano.
Se a atualização falhar, os resultados e as opções anteriores continuam utilizáveis, com mensagem e ação para repetir.
Uma combinação desconhecida apresenta um placeholder estático; a pesquisa mantém o debounce de 250 ms.

O detalhe do produto e o do leilão fazem sempre uma nova consulta ao entrar.
Mudanças de identificador reiniciam o estado e cancelam pedidos anteriores. Produtos relacionados carregam separadamente.

## Recursos e API

Na versão desta medição, seis imagens de produtos tinham variantes WebP de 480 e 960 px, com transparência preservada.
Atualmente, as 20 imagens de produtos disponíveis no projeto usam variantes locais nesses tamanhos.
Os cartões e produtos relacionados usam carregamento lazy; o detalhe carrega a sua imagem imediatamente.
O mapa continua lazy. Se não houver imagem local ou esta falhar, é apresentada uma mensagem.

O conjunto de imagens substituído passou de **10 105 161 bytes para 841 762 bytes**, incluindo todas as variantes:
**redução de 91,7%**. Os originais substituídos sem referências foram removidos.

`GET /api/products/:id` carrega apenas o produto publicado e o respetivo produtor aceite,
reduzindo de três para duas consultas num detalhe existente. Mantém a resposta pública e devolve 404
para produto privado, inexistente ou com produtor indisponível. Não existem alterações aos schemas ou índices.

## Verificação

- 19 testes do frontend e 26 testes locais da API passaram.
- Lint e build de produção passaram; os avisos Sass existentes provêm dos imports internos de Bootstrap.
- Os 71 pedidos/testes da coleção Bruno passaram contra a versão alterada da API, com limpeza dos dados temporários.
- Foram verificados no Chrome desktop e mobile: restauro de scroll e foco, cache com atualização falhada,
  opções de filtros conservadas, escrita de pesquisas com espaços, histórico dos filtros, novo separador,
  regresso através de produtos relacionados, respostas atrasadas, produto removido, repetição após erro,
  fallback de imagem remota e leilão terminado.
- As verificações visuais confirmaram a composição das imagens e o carregamento do mapa quando entra na área visível.

Os testes unitários correm com `npm test` em `frontend/` e `api/`; os testes REST correm com
`npm run test:api` em `api/`, com a API iniciada. Não executar os testes REST simultaneamente com alterações aos dados de demonstração.

## Medições

Os resultados e as condições de medição encontram-se em `fluidez-medicoes.json`.
As execuções interrompidas por alterações do Vite foram excluídas dos resultados finais.
As medidas locais são comparações de laboratório e não garantias de tempo em todas as máquinas ou redes.

Foi usado o mesmo produto Batata (`dca000000000000000000065`) e a mediana de cinco execuções por perfil.
Desktop: 1440×900. Perfil limitado: 390×844, CPU 4× mais lenta, latência de 100 ms,
download de 200 000 bytes/s e upload de 100 000 bytes/s.
O build de produção foi servido localmente com gzip para HTML, CSS e JavaScript.
A API usada na comparação frontend foi a mesma nas duas versões; a otimização da API foi validada separadamente na porta 3107.

| Ambiente e perfil | Abrir produto: antes → depois | Regresso: antes → depois |
| --- | --- | --- |
| Desenvolvimento, desktop | 444 → 287 ms | 421 → 151 ms |
| Desenvolvimento, limitado | 24 598 → 822 ms | 2 594 → 903 ms |
| Produção, desktop | 339 → 264 ms | 318 → 78 ms |
| Produção, limitado | 23 684 → 597 ms | 1 571 → 375 ms |

O percurso completo passou de três pedidos de documento (entrada, produto e regresso) para apenas um.
A abertura inicial foi também comparada alternando as versões nas mesmas condições limitadas:
mediana de **2 265 ms antes e 2 256 ms depois**, sem alteração significativa.
O primeiro arranque no Vite continua pesado neste perfil, devido aos recursos servidos em desenvolvimento.

Estas durações medem o percurso automatizado: clique, espera da navegação e presença do conteúdo esperado.
Incluem a espera do navegador pelo carregamento da página; não representam a latência isolada da API,
nem uma medição de LCP, INP ou de primeiro pixel visível.
O JavaScript de produção passou de cerca de 106 para 108 KB gzip, sem novas dependências.

Uma repetição suplementar, iniciando a espera do título em paralelo com o clique, observou em produção
275 → 209 ms no desktop e 23 797 → 1 780 ms no perfil limitado. Estes registos também estão no JSON.
Houve variação de carga e falhas de abertura do Chrome por falta de memória do Windows em tentativas intermédias;
as tentativas falhadas não entram nas medianas. Os ganhos estruturais verificáveis são a eliminação dos novos
pedidos de documento, a reutilização imediata do catálogo e a redução dos recursos, independentemente dessa variação.
