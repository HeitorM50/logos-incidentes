# Contrato da API

Base: `/` · Formato: JSON · Autenticação: `Authorization: Bearer <token>` em todas as rotas, exceto
`POST /auth/login` e `GET /health`. A documentação interativa fica em `/docs` (OpenAPI).

## Domínio

Os valores trafegam como códigos estáveis; o front traduz para os rótulos do enunciado.

| Campo | Código | Rótulo |
|---|---|---|
| categoria | `acidente_veiculo` | Acidente com Veículo |
| | `acidente_vitimas` | Acidente com Vítimas |
| | `condicao_climatica` | Condição Climática Atípica na Pista |
| | `problema_mecanico` | Problema Mecânico |
| | `bloqueio_pista` | Bloqueio de Pista |
| criticidade | `alta` · `media` · `baixa` | Alta · Média · Baixa |
| status | `aberto` · `em_investigacao` · `inconclusivo` · `fechado` | Aberto · Em Investigação · Inconclusivo · Fechado |

## Modelo de dados

**analistas**

| Coluna | Tipo | Regra |
|---|---|---|
| id | bigint identity | PK |
| nome | varchar(80) | obrigatório |
| usuario | varchar(40) | único |
| senha_hash | varchar(255) | bcrypt |

**incidentes**

| Coluna | Tipo | Regra |
|---|---|---|
| id | bigint identity | PK |
| titulo | varchar(120) | 3–120 caracteres |
| descricao | text | opcional, até 2000 caracteres |
| categoria | enum `categoria` | obrigatório |
| criticidade | enum `criticidade` (`alta`, `media`, `baixa`) | obrigatório; a ordem do enum define a ordenação |
| status | enum `status_incidente` | padrão `aberto` |
| local | varchar(160) | obrigatório (ex.: "BR-116, km 212 — Registro/SP") |
| placa | varchar(8) | opcional; padrão antigo `ABC1234` ou Mercosul `ABC1D23` |
| responsavel_id | FK analistas | nulo quando ninguém assumiu |
| atualizado_por_id | FK analistas | último analista que alterou |
| versao | integer | começa em 1; +1 a cada alteração (ADR 0002) |
| criado_em / atualizado_em | timestamptz | preenchidos pelo banco |

**eventos_incidente** (histórico, ADR 0007)

| Coluna | Tipo | Regra |
|---|---|---|
| id | bigint identity | PK |
| incidente_id | FK incidentes | `ON DELETE CASCADE`: remover o incidente remove o histórico |
| tipo | enum `tipo_evento` | `criado`, `assumido`, `liberado`, `status`, `editado` |
| analista_id | FK analistas | nulo em eventos sem autor (seed, registros anteriores ao histórico) |
| status_anterior / status_novo | enum `status_incidente` | nulos quando não se aplicam |
| campos | varchar(20)[] | campos que mudaram numa edição |
| criado_em | timestamptz | preenchido pelo banco |

Gravado **na mesma transação** da alteração: um 409 ou uma falha não deixam evento de algo que
não aconteceu. Índice `ix_eventos_incidente_linha_do_tempo (incidente_id, criado_em)`.

**dispositivos** e **ingestoes** (ingestão pelos caminhões, ADR 0008)

| Tabela | Colunas | Regra |
|---|---|---|
| dispositivos | id, nome, placa, chave_hash, ativo, criado_em | `chave_hash` = SHA-256 da chave, único |
| ingestoes | id, dispositivo_id, chave, corpo_hash, incidente_id, criado_em | `UNIQUE (dispositivo_id, chave)`; `corpo_hash` detecta a chave reutilizada; `incidente_id` vira nulo se o incidente for removido |
| incidentes | + dispositivo_id | origem do incidente; nulo quando um analista registrou |

**Índice** `ix_incidentes_triagem (status, criticidade, criado_em)` — atende a listagem padrão filtrada
por status e ordenada por criticidade e tempo aberto.

## Ciclo de vida do status

```
             assumir                       responsável muda o status
 aberto ───────────────► em_investigacao ◄──────────────► inconclusivo
   ▲                        │      │                          │
   └──────── liberar ───────┘      └──────► fechado ◄─────────┘
                                          (estado final)
```

- **Assumir** (`aberto` ou `inconclusivo`): define o responsável e muda para `em_investigacao`.
- **Mudar status** — só o responsável:
  - `em_investigacao` → `inconclusivo` ou `fechado`
  - `inconclusivo` → `em_investigacao` ou `fechado`
- **Liberar** — só o responsável: remove o responsável; `em_investigacao` volta para `aberto`.
- **Fechado** é final: não aceita edição, mudança de status, assumir, liberar nem remoção. O
  incidente fechado é registro histórico da operação; só se remove o que ainda está em andamento.
- **Editar e remover:** qualquer analista se não houver responsável; senão, só o responsável.

## Rotas

| Método e rota | Corpo | Sucesso | Erros |
|---|---|---|---|
| `GET /health` | — | 200 `{status, banco}` | 503 |
| `POST /auth/login` | `{usuario, senha}` | 200 `{token, expira_em, analista}` | 401, 422, 429 |
| `GET /auth/eu` | — | 200 `Analista` | 401 |
| `GET /incidentes` | query: `criticidade`, `categoria`, `status` (repetíveis), `responsavel=eu` | 200 `ListaIncidentes` | 401, 422 |
| `GET /incidentes/{id}` | — | 200 `Incidente` | 401, 404 |
| `POST /incidentes` | `{titulo, descricao?, categoria, criticidade, local, placa?}` | 201 `Incidente` | 401, 422 |
| `PATCH /incidentes/{id}` | `{versao, titulo?, descricao?, categoria?, criticidade?, local?, placa?}` | 200 `Incidente` | 401, 403, 404, 409, 422 |
| `POST /incidentes/{id}/assumir` | `{versao}` | 200 `Incidente` | 401, 404, 409, 422 |
| `POST /incidentes/{id}/liberar` | `{versao}` | 200 `Incidente` | 401, 403, 404, 409, 422 |
| `POST /incidentes/{id}/status` | `{versao, status}` | 200 `Incidente` | 401, 403, 404, 409, 422 |
| `DELETE /incidentes/{id}?versao=N` | — | 204 | 401, 403, 404, 409, 422 |
| `GET /incidentes/{id}/eventos` | — | 200 `[Evento]`, do mais antigo ao mais novo | 401, 404 |
| `GET /regras` | — | 200 transições, `pode_assumir`, `status_apos_liberar`, `status_final`, limites dos campos e padrão da placa (público, sem dados) | — |
| `POST /ingestao/incidentes` | cabeçalhos `X-Chave-Dispositivo` e `Idempotency-Key`; corpo igual ao `POST /incidentes` | 201 `Incidente` (novo) · 200 (reenvio, `Idempotent-Replayed: true`) | 401, 409 `ja_recebido`, 422 (inclui `chave_reutilizada`), 429 (por IP ou `cota_do_dispositivo`) |

**`ListaIncidentes`**

```json
{
  "itens": [Incidente],
  "total": 42,
  "contagem_por_criticidade": { "alta": 12, "media": 20, "baixa": 10 }
}
```

`itens` vem ordenado por: não fechados primeiro → criticidade (alta → baixa) → `criado_em` (mais
antigo primeiro). A contagem por criticidade aplica os filtros de categoria e status, mas **ignora o
filtro de criticidade** — os contadores do topo continuam mostrando o total de cada nível.

**`Incidente`**

```json
{
  "id": 17, "titulo": "Pneu estourado na pista", "descricao": "...",
  "categoria": "problema_mecanico", "criticidade": "media", "status": "em_investigacao",
  "local": "BR-116, km 212 — Registro/SP", "placa": "RTA4E21",
  "responsavel": { "id": 2, "nome": "Ana Souza" },
  "atualizado_por": { "id": 2, "nome": "Ana Souza" },
  "versao": 3, "criado_em": "2026-10-19T13:02:11Z", "atualizado_em": "2026-10-19T13:20:45Z"
}
```

## Erros

Formato único:

```json
{
  "erro": {
    "codigo": "conflito_versao",
    "mensagem": "Outro analista alterou este incidente. Confira a versão atual.",
    "campos": [{ "campo": "titulo", "mensagem": "..." }],
    "atual": { "...": "Incidente atual (só em 409)" }
  }
}
```

| HTTP | `codigo` | Quando |
|---|---|---|
| 401 | `nao_autenticado` | Token ausente, inválido ou expirado |
| 401 | `credenciais_invalidas` | Login com usuário ou senha errados |
| 403 | `nao_responsavel` | Ação reservada ao responsável pelo incidente |
| 404 | `nao_encontrado` | Incidente inexistente |
| 409 | `conflito_versao` | `versao` enviada não é a atual |
| 409 | `ja_assumido` | Incidente já tem outro responsável |
| 422 | `validacao` | Corpo ou query inválidos (`campos` detalha) |
| 422 | `transicao_invalida` | Transição de status não permitida |
| 422 | `incidente_fechado` | Alteração em incidente fechado |
| 429 | `muitas_tentativas` | Limite de login excedido |
| 503 | `servico_indisponivel` | Banco indisponível após retry (`Retry-After`) |
| 500 | `erro_interno` | Erro inesperado (sem detalhes internos) |
