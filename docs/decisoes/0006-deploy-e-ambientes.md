# 0006 — Deploy e ambientes

**Status:** aceita · 18/10/2026

## Contexto

O case exige link público funcionando, sem instalação local. Os planos gratuitos têm limitações:
o Render hiberna o serviço após ~15 min sem tráfego, e o Supabase pausa projetos sem uso por dias.

## Decisão

- **Banco:** Postgres no Supabase, acessado pelo *session pooler* (IPv4, compatível com o Render).
  - A API conecta com um usuário próprio (`logos_api`), sem privilégio de superusuário.
  - As tabelas ficam no schema `logos`, fora do `public` que o Supabase expõe pela Data API.
    Assim os dados só são acessíveis pela API do Logos, com as regras dela.
- **API:** web service no Render.
- **Front:** site estático na Vercel.
- **Testes automatizados** rodam no mesmo Postgres, mas num **schema temporário** criado e
  removido a cada execução — os dados da aplicação nunca são tocados.
- **Hibernação:** o front mostra "acordando servidor" quando a primeira requisição demora; um job
  agendado chama `/health` periodicamente para manter API e banco ativos.

## Alternativas consideradas

- **Postgres do Render:** o plano gratuito expira em 30 dias, possivelmente antes da avaliação.
- **SQLite:** o disco do Render gratuito é efêmero; os dados sumiriam a cada deploy.
- **Postgres local em Docker para testes:** isolamento maior, mas exigiria Docker de quem for rodar
  o projeto. Atualização (19/10): o `docker-compose.yml` da raiz entrou como caminho **opcional**
  para desenvolvimento local, para quem avalia rodar o projeto sem criar conta no Supabase. A API
  e os testes funcionam igual nos dois bancos; nada em produção depende do Docker.

## Consequências

- Dois domínios diferentes → CORS obrigatório.
- Os testes precisam de `DATABASE_URL` configurada e de acesso à internet.
