import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { abrirTriagem, API, CHAVE_DEMO, linha, SESSAO_ANA } from './apoio'

test.use({ storageState: SESSAO_ANA })

test('caminhão envia um Alta: a triagem avisa, e o reenvio não duplica', async ({
  page,
  request,
}) => {
  await abrirTriagem(page)

  const envio = {
    headers: { 'X-Chave-Dispositivo': CHAVE_DEMO, 'Idempotency-Key': randomUUID() },
    data: {
      titulo: `Tombamento na serra ${Date.now()}`,
      categoria: 'acidente_veiculo',
      criticidade: 'alta',
      local: 'BR-376, km 668 — Guaratuba/PR',
    },
  }
  const primeiro = await request.post(`${API}/ingestao/incidentes`, envio)
  expect(primeiro.status()).toBe(201)
  const { id } = await primeiro.json()

  const reenvio = await request.post(`${API}/ingestao/incidentes`, envio)
  expect(reenvio.status()).toBe(200)
  expect((await reenvio.json()).id).toBe(id)

  // Em até 5 s (leitura periódica), a triagem avisa e "Ver" leva até a linha.
  await expect(page.getByText('Novo incidente Alta', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Ver', exact: true }).click()
  await expect(page.getByRole('button', { name: `Ver detalhes de #${id}` })).toBeFocused()
  await expect(linha(page, id).getByText('Enviado por Simulador do caminhão RTA4E21')).toBeAttached()
  await expect(linha(page, id)).toHaveCount(1) // sem duplicata na tela
})
