import { expect, test } from '@playwright/test'
import { abrirTriagem, SESSAO_ANA } from './apoio'

test.use({ storageState: SESSAO_ANA })

test('relatório: funil do período, troca de período e exportar PDF', async ({ page }) => {
  // A impressão real abriria o diálogo do sistema: aqui só registra que foi pedida.
  await page.addInitScript(() => {
    window.print = () => {
      ;(window as unknown as { impressoes: number }).impressoes =
        ((window as unknown as { impressoes?: number }).impressoes ?? 0) + 1
    }
  })
  await abrirTriagem(page)

  await page.getByRole('button', { name: 'Relatório' }).click()
  const painel = page.getByRole('dialog', { name: 'Relatório de incidentes' })
  await expect(painel.getByText('Funil do atendimento')).toBeVisible()
  // O funil em texto (o mesmo que o leitor de tela recebe), com os números da API rodando.
  await expect(painel.getByText(/^Recebidos: \d+$/)).toBeAttached()
  await expect(painel.getByText(/^Fechados: \d+$/)).toBeAttached()

  const pedido = page.waitForResponse((r) => r.url().includes('/relatorio?horas=24'))
  await painel.getByRole('combobox', { name: 'Período' }).selectOption('24')
  expect((await pedido).status()).toBe(200)

  await painel.getByRole('button', { name: 'Exportar PDF' }).click()
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { impressoes?: number }).impressoes))
    .toBe(1)
  const documento = page.locator('.documento-impressao')
  await expect(documento).toContainText('Relatório de incidentes')
  await expect(documento).toContainText('Incidentes recebidos ou fechados no período')
  await expect(documento).toContainText('por Ana Souza')
})
