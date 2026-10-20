import { expect, test } from '@playwright/test'
import { abrirTriagem, incidenteLivre, linha, SESSAO_ANA, liberar } from './apoio'

test.use({ storageState: SESSAO_ANA })

test('falha na escrita: a linha muda na hora e volta sozinha, com "Tentar de novo"', async ({
  page,
}) => {
  await abrirTriagem(page)
  const id = await incidenteLivre(page)
  await abrirTriagem(page, `/?busca=%23${id}`)

  // A leitura continua real; só a escrita deste incidente cai (como o banco fora do ar).
  await page.route(`**/incidentes/${id}/assumir`, (rota) =>
    rota.request().method() === 'OPTIONS'
      ? rota.continue()
      : rota.fulfill({
          status: 503,
          headers: { 'access-control-allow-origin': '*' },
          json: { erro: { codigo: 'servico_indisponivel', mensagem: 'Banco indisponível.' } },
        }),
  )
  await page.getByRole('button', { name: `Assumir #${id}` }).click()

  // Rollback: o aviso aparece e a linha volta a "Sem responsável".
  await expect(page.getByText(`Não foi possível assumir #${id}. A ação foi desfeita.`)).toBeVisible()
  await expect(linha(page, id).getByText('Sem responsável')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()

  // A rede volta: "Tentar de novo" grava de verdade.
  await page.unroute(`**/incidentes/${id}/assumir`)
  await page.getByRole('button', { name: 'Tentar de novo' }).click()
  await expect(linha(page, id).getByText('Você')).toBeVisible()
  await liberar(page, id)
  await expect(page.getByRole('button', { name: `Assumir #${id}` })).not.toHaveAttribute(
    'aria-disabled',
  )
})
