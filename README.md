# Base de Acesso Bibliotecário — Frontend

> Projeto acadêmico em desenvolvimento. Não é uma versão pronta para produção.

Aplicação web React que oferece a experiência de uso da Base de Acesso Bibliotecário para toda a comunidade escolar. A tela inicial apresenta livros em destaque, gêneros populares e recomendações; a busca permite localizar títulos, autores e gêneros e consultar detalhes e disponibilidade dos exemplares.

Alunos e professores conseguem reservar livros, consultar seus empréstimos, verificar prazos e acompanhar o histórico. Bibliotecários e administradores possuem painéis para cadastrar e editar livros, autores, gêneros e exemplares, administrar usuários, registrar retiradas e devoluções e configurar políticas e calendários da escola. A interface adapta menus, ações e rotas ao papel do usuário, mas a autorização definitiva é sempre validada pela API.

O frontend mantém estado de sessão, trata carregamentos e erros, valida formulários antes do envio e atualiza as telas após mutações usando cache de consultas. Assim, a aplicação conecta as necessidades de circulação da biblioteca às regras multi-tenant e de segurança implementadas no backend.

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

Em produção, publique o conteúdo de `dist/` em um servidor HTTPS com fallback
de SPA para `index.html`. Configure `VITE_API_URL` para a origem da API ou para
um proxy same-origin em `/api`; o proxy deve encaminhar os métodos e headers
da API, incluindo `Authorization`.

## Segurança

O frontend controla experiência e navegação, mas a autorização efetiva ocorre no backend. Não coloque segredos em variáveis `VITE_*`; elas são incorporadas ao bundle. Use somente dados fictícios no desenvolvimento.

## Projetos relacionados

- [Backend](https://github.com/EuSouPedroEmanoel/b.a.b---backend)
- [Issues de segurança](https://github.com/EuSouPedroEmanoel/b.a.b---backend/issues)

## Licença

Distribuído sob a [licença MIT](LICENSE).

## Jornada do usuário

1. A pessoa acessa a tela de login e informa suas credenciais.
2. A sessão autenticada busca o perfil e a escola associada.
3. O catálogo pode ser pesquisado por título, autor ou gênero.
4. A página de detalhes mostra sinopse, capa e disponibilidade.
5. Usuários elegíveis podem reservar um livro disponível ou emprestado.
6. O painel pessoal exibe reservas, empréstimos ativos e histórico.
7. Bibliotecários acessam as ferramentas de circulação e cadastro.
8. Administradores ajustam políticas, calendário e contas autorizadas.
9. Mensagens de sucesso, erro e validação orientam cada operação.
10. A atualização automática mantém os dados exibidos sincronizados.

## Telas e recursos

- **Início:** destaques, tendências e recomendações.
- **Catálogo:** filtros, paginação e ordenação de resultados.
- **Livro:** dados bibliográficos, exemplares e ação de reserva.
- **Empréstimos:** situação, prazos, devoluções e histórico.
- **Reservas:** fila, status e cancelamento quando permitido.
- **Usuários:** cadastro e manutenção conforme o papel.
- **Administração:** políticas, calendários e configurações da escola.

## Integração com a API

O cliente centraliza requisições HTTP no Axios, envia o bearer token somente para a API configurada e usa TanStack Query para cache, invalidação e estados de carregamento. Erros de autenticação encerram a sessão e redirecionam para o login.

## Acessibilidade e experiência

Componentes reutilizáveis mantêm foco visível, rótulos, mensagens de erro e suporte a temas. Formulários informam campos obrigatórios antes do envio e estados vazios explicam o próximo passo.

## Contribuição

Descreva a alteração em uma issue, execute lint, testes e build e inclua evidências visuais para mudanças de interface. Nunca envie tokens ou dados reais em screenshots.
