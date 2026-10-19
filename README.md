# Logos — Central de Resposta a Incidentes

MVP de uma central de resposta a incidentes para uma transportadora: API em Python que recebe e
serve incidentes e interface em React para analistas priorizarem e tratarem ocorrências em tempo real.

> Em construção. Instruções de setup e justificativas de arquitetura serão adicionadas ao longo do
> desenvolvimento, com as decisões registradas em [`docs/decisoes/`](docs/decisoes/).

## Estrutura

```
api/    API em Python (FastAPI)
web/    Interface em React (Vite + TypeScript)
docs/   Contrato da API e registros de decisão
```

## Como rodar localmente

Pré-requisitos: [uv](https://docs.astral.sh/uv/) e Node.js 20+.

**API**

```bash
cd api
cp .env.example .env      # preencha DATABASE_URL e JWT_SEGREDO
uv sync
uv run uvicorn app.main:app --reload
```

**Front**

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

**Testes**

```bash
cd api && uv run pytest
cd web && npm test
```
