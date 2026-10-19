# 0001 — Stack do projeto

**Status:** aceita · 18/10/2026

## Contexto

O case pede uma API em Python e uma interface em React, com deploy público em 3 dias. A escolha
precisa equilibrar produtividade, robustez e o que consigo defender tecnicamente.

## Decisão

| Camada | Escolha | Por quê |
|---|---|---|
| API | **FastAPI** | Validação de entrada com Pydantic integrada à rota, documentação OpenAPI automática em `/docs`, tipagem que o editor entende. |
| Validação | **Pydantic v2** | Enums fechados e limites de tamanho declarados no schema; o erro 422 já sai estruturado. |
| Acesso a dados | **SQLAlchemy 2 + Alembic** | `UPDATE ... WHERE` explícito para o controle de concorrência e migrations versionadas junto com o código. |
| Banco | **PostgreSQL (Supabase)** | Transações, tipos `ENUM` e índices compostos; Supabase oferece Postgres gerenciado gratuito. |
| Front | **React + Vite + TypeScript** | Exigência do case (React); Vite pelo build rápido; TypeScript para tipar o contrato da API. |
| Estado de servidor | **TanStack Query** | Cache, refetch periódico, retry e atualização otimista com rollback já resolvidos pela biblioteca. |
| Estilo | **Tailwind + shadcn/ui** | Tokens de tema via variáveis CSS (modo claro/escuro); componentes acessíveis baseados em Radix. |
| Testes | **pytest** (API) e **Vitest** (front) | Ferramentas padrão de cada ecossistema. |

## Alternativas consideradas

- **Flask:** mais simples, mas validação, documentação e tratamento de erro ficariam manuais.
- **Django:** pesado demais para uma API de um recurso principal.
- **Estado no front escrito à mão:** já implementei atualização otimista manualmente em outro
  projeto; aqui a biblioteca reduz código e risco de bug no rollback.

## Consequências

- A API usa endpoints síncronos (SQLAlchemy síncrono no threadpool do FastAPI). Mais simples de
  depurar; suficiente para a carga de uma central de analistas.
- Duas linguagens no repositório, separadas em `api/` e `web/`.
