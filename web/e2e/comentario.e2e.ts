import { expect, test } from '@playwright/test'
import { abrirTriagem, incidenteLivre, liberar, linha, SESSAO_ANA } from './apoio'

test.use({ storageState: SESSAO_ANA })

test('inconclusivo pede o motivo, liberar aceita contexto, e os dois ficam no histórico', async ({
  page,
}) => {
  await abrirTriagem(page)
  const id = await incidenteLivre(page)
  await abrirTriagem(page, `/?busca=%23${id}`)
  await page.getByRole('button', { name: `Assumir #${id}` }).click()
  await expect(linha(page, id).getByText('Você')).toBeVisible()

  await page.getByRole('button', { name: `Mudar status de #${id}` }).click()
  await page.getByRole('menuitem', { name: 'Inconclusivo' }).click()
  const dialogo = page.getByRole('alertdialog', { name: `Marcar o incidente #${id} como Inconclusivo?` })
  // Sem motivo, nada vai para a API.
  await dialogo.getByRole('button', { name: 'Marcar Inconclusivo' }).click()
  await expect(dialogo.getByRole('alert')).toHaveText('Escreva pelo menos 3 caracteres.')
  await dialogo.getByRole('textbox').fill('Sem contato com o motorista')
  await dialogo.getByRole('button', { name: 'Marcar Inconclusivo' }).click()
  await expect(linha(page, id).getByText('Inconclusivo', { exact: true })).toBeVisible()

  await liberar(page, id, 'Tentar o motorista de novo às 15h')
  await expect(page.getByRole('button', { name: `Assumir #${id}` })).not.toHaveAttribute(
    'aria-disabled',
  )

  await page.getByRole('button', { name: `Ver detalhes de #${id}` }).click()
  const historico = linha(page, id).getByRole('list', { name: 'Histórico' })
  await expect(historico).toContainText('Sem contato com o motorista')
  await expect(historico).toContainText('Tentar o motorista de novo às 15h')
})
