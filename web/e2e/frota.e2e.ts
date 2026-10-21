import { expect, test } from '@playwright/test'
import { abrirTriagem, API, SESSAO_ANA } from './apoio'

test.use({ storageState: SESSAO_ANA })

// Chave pública da central de rastreamento simulada (app/seed/dispositivos.py).
const CHAVE_RASTREADORA = 'demo-rastreadora-logos-2026'

test('telemetria de pânico vira alerta no mapa da frota e leva ao incidente', async ({
  page,
  request,
}) => {
  const resposta = await request.post(`${API}/telemetria`, {
    headers: { 'X-Chave-Dispositivo': CHAVE_RASTREADORA },
    data: {
      leituras: [
        {
          placa: 'RTA4E21',
          latitude: -23.18,
          longitude: -45.88,
          velocidade_kmh: 72,
          referencia: 'Rod. Presidente Dutra, km 145 — São José dos Campos/SP',
          sinais: { panico: true },
        },
      ],
    },
  })
  expect(resposta.ok()).toBe(true)
  const corpo = await resposta.json()
  // Se já havia um alerta de pânico ativo para este caminhão, a regra não repete.
  const gerado = corpo.incidentes[0]

  await abrirTriagem(page)
  await page.getByRole('button', { name: 'Frota' }).click()
  const painel = page.getByRole('dialog', { name: 'Frota' })
  const linha = painel.getByRole('row').filter({ hasText: 'RTA4E21' })
  await expect(linha).toContainText('Rod. Presidente Dutra, km 145')
  const alerta = linha.getByRole('button', { name: /Botão de pânico acionado pelo motorista/ })
  await expect(alerta).toBeVisible()
  if (gerado) await expect(alerta).toHaveText(new RegExp(`^#${gerado.id} `))

  await alerta.click()
  await expect(painel).toBeHidden()
  await expect(page.getByRole('searchbox', { name: 'Buscar incidente' })).toHaveValue(/^#\d+$/)
  await expect(page.locator('[data-incidente]')).toHaveCount(1)
})
