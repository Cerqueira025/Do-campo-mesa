# Regras de desenvolvimento

Estas regras aplicam-se a novas implementações e ao código alterado.

## 1. Implementação mínima

- Implementar apenas o necessário para cumprir o pedido atual.
- Preferir soluções simples, diretas e fáceis de explicar.
- Não antecipar funcionalidades, configurações, variantes ou abstrações para necessidades futuras.
- Não adicionar dependências quando a solução existente for suficiente.
- Melhorar progressivamente, sem refatorações fora do âmbito do pedido.
- Simplicidade não significa omitir validações, acessibilidade ou tratamento de erros necessários ao funcionamento.

## 2. SCSS limpo e claro

- Manter os estilos junto do respetivo componente; reservar estilos globais para regras realmente globais.
- Usar nomes de classes claros e seguir a convenção existente.
- Manter seletores simples e nesting pouco profundo; evitar dependência da estrutura interna de outros componentes.
- Evitar duplicação, sobrescritas sucessivas, especificidade excessiva e `!important`.
- Antes de acrescentar uma regra para corrigir um estilo, verificar se a regra original deve ser ajustada.
- Reutilizar os mixins e breakpoints existentes, com abordagem Mobile First.
- Usar `@use`; criar mixins apenas quando simplificarem repetição real.
- Exceção: os imports Sass do Bootstrap 5 usam `@import`, exclusivamente em `frontend/src/styles/_bootstrap.scss`, devido às dependências internas da biblioteca.
- Remover estilos que a alteração tornou desnecessários. Comentar apenas decisões que não sejam evidentes.

## 3. Cores sempre nos tokens

- Todas as cores da interface devem ter origem em `frontend/src/styles/abstracts/_tokens.scss`.
- Nos estilos dos componentes, usar as variáveis CSS existentes, como `var(--color-green-950)`.
- Não escrever cores literais em SCSS de componentes, JSX ou estilos inline.
- Esta regra inclui texto, fundos, bordas, sombras, gradientes e estados de hover, foco e disabled.
- Antes de criar uma cor, verificar se já existe um token adequado. Se faltar, adicioná-lo ao mapa de cores, seguindo a nomenclatura existente.
- Variações de cor com transparência também devem ser definidas nos tokens.
- `transparent`, `inherit` e `currentColor` podem ser usados quando representam transparência ou herança; não devem servir para introduzir cores fora do sistema.
- A regra aplica-se às cores controladas pela interface, não às cores internas de fotografias e imagens.

## 4. Reutilizar antes de criar

- Procurar componentes existentes antes de implementar um novo.
- Reutilizar o componente quando a responsabilidade e o comportamento forem compatíveis.
- Quando necessário, acrescentar a menor extensão possível ao componente existente, preservando os seus usos atuais.
- Não copiar componentes para alterar apenas texto, cor, ícone ou pequenos detalhes de apresentação.
- Criar um componente novo quando existir uma responsabilidade distinta; não forçar reutilização através de muitas condições e propriedades.
- Reutilizar também tipos, hooks, serviços e utilitários existentes quando forem adequados.

## Verificação antes de concluir

Confirmar em cada implementação:

- O código acrescentado é necessário para o pedido?
- O SCSS está legível e sem regras redundantes?
- Todas as cores utilizadas vêm dos tokens?
- Foram procurados e reutilizados os componentes adequados?
- O comportamento alterado foi verificado, incluindo os usos existentes de componentes partilhados?

A criação deste ficheiro não inclui uma limpeza geral do código atual. As regras serão aplicadas progressivamente às áreas trabalhadas.
