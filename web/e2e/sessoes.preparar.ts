import { expect, test as preparar } from '@playwright/test'
import { SESSAO_ANA, SESSAO_BRUNO } from './apoio'

// Login de verdade, uma vez por analista; os cenários reaproveitam a sessão guardada.
for (const [usuario, arquivo] of [
  ['ana', SESSAO_ANA],
  ['bruno', SESSAO_BRUNO],
] as const) {
  preparar(`entra como ${usuario}`, async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Usuário').fill(usuario)
    await page.getByLabel('Senha').fill('logos2026')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('table', { name: 'Incidentes' })).toBeVisible()
    // A dica de primeiro acesso já foi vista: os cenários testam a triagem, não a dica.
    await page.evaluate(() => localStorage.setItem('logos.guia-visto', '1'))
    await page.context().storageState({ path: arquivo })
  })
}
