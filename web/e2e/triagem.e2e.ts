import { expect, test } from '@playwright/test'
import { abrirTriagem, linhaDeEstado, SESSAO_ANA } from './apoio'

test.use({ storageState: SESSAO_ANA })

test('triagem: contadores, filtro pelo cartão, URL e busca', async ({ page }) => {
  await abrirTriagem(page)
  const estado = linhaDeEstado(page)
  await expect(estado).toHaveText(/^Mostrando (\d+) de \1 incidentes$/)

  // O cartão de criticidade é filtro e vai para a URL.
  await page.getByRole('button', { name: /^Alta: \d+ ativos/ }).click()
  await expect(page).toHaveURL(/criticidade=alta/)
  await expect(estado).toContainText('(filtrado)')
  const selos = page.locator('[data-incidente] [role="row"] [role="cell"]:first-child')
  for (const selo of await selos.all()) await expect(selo).toHaveText(/Alta/i)

  // Recarregar mantém o filtro (estado na URL).
  await page.reload()
  await expect(page.getByRole('button', { name: /^Alta: \d+ ativos/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // Busca por número: um incidente só.
  await page.getByRole('button', { name: 'Limpar filtros' }).click()
  await page.getByRole('searchbox', { name: 'Buscar incidente' }).fill('#5')
  await expect(page.locator('[data-incidente]')).toHaveCount(1)
  await expect(page.locator('[data-incidente="5"]')).toBeVisible()
})

test('login de verdade abre a triagem e sair volta ao login', async ({ browser }) => {
  const contexto = await browser.newContext({ storageState: undefined })
  const page = await contexto.newPage()
  await page.goto('/')
  await expect(page.getByText('Credenciais de demonstração')).toBeVisible()
  await page.getByRole('button', { name: 'Preencher' }).click()
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Triagem' })).toBeVisible()
  await expect(page.getByText('Ana Souza')).toBeVisible()

  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('heading', { name: 'Entrar na central' })).toBeVisible()
  await contexto.close()
})
