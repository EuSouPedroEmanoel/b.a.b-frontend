# Base de Acesso Bibliotecário — Frontend

> Projeto acadêmico em desenvolvimento. Não é uma versão pronta para produção.

Aplicação web React para consulta do acervo e operação diária da biblioteca. A interface oferece navegação por catálogo, detalhes de livros, empréstimos, reservas, usuários e recomendações, respeitando os papéis definidos pelo backend.

## Arquitetura

- **React 19 + TypeScript** para componentes e tipagem.
- **Vite** para desenvolvimento e build de produção.
- **React Router** para rotas protegidas e navegação.
- **TanStack Query + Axios** para cache e comunicação com a API.
- **React Hook Form + Zod** para formulários e validação.
- **Tailwind CSS** e componentes próprios para a camada visual.

## Requisitos

Node.js 20+ e npm.

## Execução local

```bash
npm install
npm run dev
```

Defina `VITE_API_URL` no ambiente local (por exemplo, `http://localhost:8000`).

## Qualidade e build

```bash
npm run lint
npm run test
npm run build
```

## Segurança

O frontend controla experiência e navegação, mas a autorização efetiva ocorre no backend. Não coloque segredos em variáveis `VITE_*`; elas são incorporadas ao bundle. Use somente dados fictícios no desenvolvimento.

## Projetos relacionados

- [Backend](https://github.com/EuSouPedroEmanoel/b.a.b---backend)
- [Issues de segurança](https://github.com/EuSouPedroEmanoel/b.a.b---backend/issues)

## Licença

Distribuído sob a [licença MIT](LICENSE).
