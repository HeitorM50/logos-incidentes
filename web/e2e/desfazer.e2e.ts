import { expect, test } from '@playwright/test'
import { abrirTriagem, incidenteLivre, linha, SESSAO_ANA } from './apoio'

test.use({ storageState: SESSAO_ANA })

test('desfazer a última ação e ver tudo no histórico', async ({ page }) => {
  await abrirTriagem(page)
  const id = await incidenteLivre(page)
  await abrirTriagem(page, `/?busca=%23${id}`)

  await page.getByRole('button', { name: `Assumir #${id}` }).click()
  await expect(page.getByText(`Você assumiu #${id}.`).first()).toBeVisible()

  // Ctrl+Z desfaz de qualquer lugar da tela, enquanto o aviso está visível.
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('Control+z')
  await expect(page.getByRole('button', { name: `Assumir #${id}` })).not.toHaveAttribute(
    'aria-disabled',
  )

  await page.getByRole('button', { name: `Ver detalhes de #${id}` }).click()
  const historico = linha(page, id).getByRole('list', { name: 'Histórico' })
  await expect(historico).toContainText('Você assumiu o incidente')
  await expect(historico).toContainText('Você liberou o incidente, que voltou para Aberto')
})
