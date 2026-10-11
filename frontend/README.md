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

Os estilos específicos ficam junto do componente, em ficheiros `.scss`. Usa `@use` para carregar tokens e mixins; evita regras de uma funcionalidade dentro dos estilos globais.

## Bootstrap 5

O Bootstrap é configurado em `src/styles/_bootstrap.scss` e carregado por `main.scss` antes dos estilos próprios. São importados apenas grelha, botões, cartões e campos de formulário, com as dependências Sass necessárias. O reset existente continua responsável pelas regras globais; não é carregado o Reboot do Bootstrap.

As cores, a tipografia e os breakpoints vêm dos tokens existentes. A grelha usa `md` a 768 px, `lg` a 1024 px e `xl` a 1280 px; os contentores próprios mantêm a largura máxima de 1280 px.

Nas novas páginas, reutiliza `row`/`col` e os componentes React existentes. `Button` usa `btn`, `ProductCard` usa `card` e `SearchBar` usa `form-control`; os estilos próprios personalizam o aspeto com os tokens. Importa novos módulos apenas quando forem utilizados. A navegação Bootstrap será acrescentada com o routing da SPA.

O único uso de `@import` fica na entrada de compatibilidade do Bootstrap 5; o restante Sass usa `@use`. As interações são controladas pelo React, sem React Bootstrap nem importação do JavaScript do Bootstrap.

O Sass atual emite avisos de depreciação provenientes dos imports e funções internas do Bootstrap 5. Estes avisos não impedem a compilação; a exceção não se aplica ao código Sass próprio.

## Desenvolvimento

```powershell
npm install
npm run dev
```

## Verificações disponíveis:

```powershell
npm run build
npm run lint
```
