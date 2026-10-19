# 0005 — Autenticação e segurança básica da API

**Status:** aceita · 18/10/2026

## Contexto

O case pede para explicar a "segurança básica da API". Além disso, o controle de responsável
(ADR 0002) precisa saber qual analista está fazendo cada alteração.

## Decisão

- **Login com usuário e senha** → a API devolve um **JWT** (HS256, validade de 8 horas — um turno).
- Senhas guardadas só como **hash bcrypt**.
- Todas as rotas exigem `Authorization: Bearer <token>`, exceto `POST /auth/login` e `GET /health`.
- **Limite de tentativas no login**, em duas camadas, ambas com resposta 429:
  - por IP (slowapi, 5 por minuto). O IP vem do cabeçalho `CF-Connecting-IP`: o Render fica
    atrás da Cloudflare, que grava ali o IP real e sobrescreve o valor enviado pelo cliente.
    O `X-Forwarded-For` não serve, porque o cliente escreve nele o que quiser (ver Revisão);
  - por usuário (5 senhas erradas por minuto), que vale mesmo se o IP mudar. Usuários sem
    falha recente saem da memória.
- **CORS** restrito ao domínio do front.
- **Validação de entrada** em todas as rotas (Pydantic): enums fechados, limites de tamanho,
  campos extras rejeitados.
- **Erros padronizados** sem stack trace, SQL ou detalhe interno.
- Segredos (`JWT_SEGREDO`, `DATABASE_URL`) só em variáveis de ambiente.
- Analistas de demonstração criados por seed; as credenciais aparecem na tela de login.
- **Cabeçalhos de segurança no front** (`web/vercel.json`): `Content-Security-Policy` só com
  scripts do próprio site e chamadas só para a API, `frame-ancestors 'none'`, `nosniff`,
  `Referrer-Policy` e `Permissions-Policy`.
- **GitHub Actions** com `permissions: contents: read`: o repositório é público.

## Alternativas consideradas

- **API key fixa:** não identifica o analista.
- **Supabase Auth:** acopla a API ao provedor e esconde a lógica que o case quer ver.
- **Cookie de sessão:** exigiria proteção CSRF e configuração de cookie entre domínios diferentes
  (Vercel e Render).

## Consequências

- O limite por usuário permite que alguém bloqueie a conta de um analista por 1 minuto errando a
  senha de propósito. Risco aceito no MVP; em produção, desafio adicional (captcha) em vez de bloqueio.

- O token fica no `localStorage` do front. Risco aceito para o MVP: a mitigação é a validação de
  entrada, a ausência de HTML injetado e o CSP, que impede script de outra origem e script
  embutido. Em produção real, cookie `HttpOnly` no mesmo domínio.
- O `CF-Connecting-IP` só é confiável porque a API só é alcançada pela Cloudflare. Fora dela
  (desenvolvimento, testes), o limite usa o IP da conexão.
- `style-src` aceita `'unsafe-inline'`: componentes do Radix injetam estilo em tempo de
  execução. Estilo não executa código; o risco é baixo.

## Revisão de segurança (19/10/2026, issue #21)

- **Segredos:** nenhum segredo no histórico do git (38 commits varridos). O único valor é o
  exemplo `troque-este-valor` do `.env.example`, que a API recusa (mínimo de 32 caracteres).
- **Dependências:** `pip-audit` sem vulnerabilidade. `npm audit --omit=dev` sem
  vulnerabilidade depois de mover o CLI do shadcn para `devDependencies`. Restam 7 alertas
  altos só no CLI do shadcn (glob em ferramentas de build, não entra no site); a correção
  sugerida pelo npm é voltar o CLI para a versão 1, que não funciona com esta configuração.
- **Limite por IP furado (corrigido):** na API publicada, 7 logins seguidos com um
  `X-Forwarded-For` diferente em cada um não receberam 429; sem o cabeçalho, o 6º recebeu.
  Cada tentativa roda o bcrypt, então o furo permitia gastar CPU sem limite. Corrigido com o
  `CF-Connecting-IP`; o limite por usuário já protegia as senhas.
- **Memória do limite por usuário (corrigido):** cada nome inventado ficava guardado para
  sempre.
