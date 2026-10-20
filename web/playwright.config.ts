import { defineConfig, devices } from '@playwright/test'

// Testes ponta a ponta: navegador de verdade, front publicado (vite preview), API FastAPI e
// Postgres de verdade. Nada é simulado, exceto a falha de rede no teste de rollback.
//
// Rodar localmente (banco do docker-compose.yml da raiz):
//   docker compose up -d
//   cd api && DATABASE_URL=postgresql+psycopg://logos:logos@localhost:55432/logos \
//     uv run alembic upgrade head && uv run python -m app.seed --recriar
//   cd web && npm run build && npm run e2e
// Com Chromium do sistema (sem baixar o do Playwright): CHROMIUM=/usr/bin/chromium npm run e2e

const API = 'http://localhost:8000'
const FRONT = 'http://localhost:4173'
const BANCO_LOCAL = 'postgresql+psycopg://logos:logos@localhost:55432/logos'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  // Os cenários mexem no mesmo banco: um de cada vez, na ordem, sem disputa entre eles.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: FRONT,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    viewport: { width: 1440, height: 900 },
    launchOptions: process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : undefined,
  },
  projects: [
    // Entra como Ana e como Bruno uma vez e guarda as sessões: os cenários reaproveitam, e o
    // limite de 5 logins por minuto continua ligado.
    { name: 'sessoes', testMatch: /sessoes\.preparar\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      dependencies: ['sessoes'],
    },
  ],
  webServer: [
    {
      command: 'uv run uvicorn app.main:app --port 8000',
      cwd: '../api',
      url: `${API}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        DATABASE_URL: process.env.DATABASE_URL ?? BANCO_LOCAL,
        JWT_SEGREDO: process.env.JWT_SEGREDO ?? 'segredo-dos-testes-ponta-a-ponta-0123456789',
        CORS_ORIGENS: FRONT,
      },
    },
    {
      command: 'npm run preview -- --port 4173 --strictPort',
      url: FRONT,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
