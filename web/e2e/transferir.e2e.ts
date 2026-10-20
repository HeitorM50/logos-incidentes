import { expect, test } from '@playwright/test'
import { abrirTriagem, incidenteLivre, linha, SESSAO_CARLA } from './apoio'

test.use({ storageState: SESSAO_CARLA })

test('a supervisora transfere um incidente e o histórico registra', async ({ page }) => {
  await abrirTriagem(page)
  await expect(page.getByText('Supervisor', { exact: true })).toBeVisible()
  const id = await incidenteLivre(page)
  await abrirTriagem(page, `/?busca=%23${id}`)

  await page.getByRole('button', { name: `Ver detalhes de #${id}` }).click()
  await page.getByRole('button', { name: `Transferir #${id}` }).click()
  const dialogo = page.getByRole('alertdialog', { name: `Transferir o incidente #${id}` })
  await dialogo.getByLabel('Novo responsável').selectOption({ label: 'Bruno Lima' })
  await dialogo.getByRole('textbox').fill('Troca de turno')
  await dialogo.getByRole('button', { name: 'Transferir', exact: true }).click()

  await expect(linha(page, id).getByText('Bruno Lima').first()).toBeVisible()
  const historico = linha(page, id).getByRole('list', { name: 'Histórico' })
  await expect(historico).toContainText('Você transferiu o incidente para Bruno Lima')
  await expect(historico).toContainText('Troca de turno')
})
