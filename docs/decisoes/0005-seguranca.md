# 0005 — Autenticação e segurança básica da API

**Status:** aceita · 18/10/2026

## Contexto

O case pede para explicar a "segurança básica da API". Além disso, o controle de responsável
(ADR 0002) precisa saber qual analista está fazendo cada alteração.

## Decisão

- **Login com usuário e senha** → a API devolve um **JWT** (HS256, validade de 8 horas — um turno).
- Senhas guardadas só como **hash bcrypt**.
- Todas as rotas exigem `Authorization: Bearer <token>`, exceto `POST /auth/login` e `GET /health`.
- **Limite de tentativas no login** (slowapi): excesso devolve 429.
- **CORS** restrito ao domínio do front.
- **Validação de entrada** em todas as rotas (Pydantic): enums fechados, limites de tamanho,
  campos extras rejeitados.
- **Erros padronizados** sem stack trace, SQL ou detalhe interno.
- Segredos (`JWT_SEGREDO`, `DATABASE_URL`) só em variáveis de ambiente.
- Analistas de demonstração criados por seed; as credenciais aparecem na tela de login.

## Alternativas consideradas

- **API key fixa:** não identifica o analista.
- **Supabase Auth:** acopla a API ao provedor e esconde a lógica que o case quer ver.
- **Cookie de sessão:** exigiria proteção CSRF e configuração de cookie entre domínios diferentes
  (Vercel e Render).

## Consequências

- O token fica no `localStorage` do front. Risco aceito para o MVP: a mitigação é a validação de
  entrada e a ausência de HTML injetado. Em produção real, cookie `HttpOnly` no mesmo domínio.
