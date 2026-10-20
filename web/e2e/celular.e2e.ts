import { expect, test } from '@playwright/test'
import { abrirTriagem, SESSAO_ANA } from './apoio'

// Tela de celular: a triagem vira lista de cartões e nada rola na horizontal.
test.use({ storageState: SESSAO_ANA, viewport: { width: 390, height: 844 } })

test('celular: cartões no lugar da tabela, sem rolagem horizontal', async ({ page }) => {
  await abrirTriagem(page)
  const cartoes = page.getByRole('list', { name: 'Incidentes' }).getByRole('listitem')
  await expect(cartoes.first()).toBeVisible()
  await expect(page.getByRole('table', { name: 'Incidentes' })).toHaveCount(0)

  const larguras = await page.evaluate(() => ({
    pagina: document.documentElement.scrollWidth,
    janela: window.innerWidth,
  }))
  expect(larguras.pagina).toBeLessThanOrEqual(larguras.janela)

  // O primeiro cartão abre os detalhes, como a linha da tabela.
  const primeiro = cartoes.first()
  await primeiro.getByRole('button', { name: /^Ver detalhes de #\d+$/ }).click()
  await expect(primeiro.getByRole('group', { name: /^Detalhes de #\d+$/ })).toBeVisible()
  await expect(primeiro.getByText('Histórico')).toBeVisible()
})
