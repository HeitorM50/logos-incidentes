import { expect, test } from '@playwright/test'
import { abrirTriagem, incidenteLivre, linha, SESSAO_ANA, SESSAO_BRUNO, liberar } from './apoio'

test('dois analistas no mesmo incidente: o segundo recebe o 409 com o estado atual', async ({
  browser,
}) => {
  const ana = await (await browser.newContext({ storageState: SESSAO_ANA })).newPage()
  const bruno = await (await browser.newContext({ storageState: SESSAO_BRUNO })).newPage()
  await abrirTriagem(ana)
  const id = await incidenteLivre(ana)
  await abrirTriagem(bruno, `/?busca=%23${id}`)
  await abrirTriagem(ana, `/?busca=%23${id}`)

  // Ana assume; Bruno clica em seguida, ainda com a lista de antes (sem esperar a releitura).
  const respostaAna = ana.waitForResponse((r) => r.url().endsWith(`/incidentes/${id}/assumir`))
  await ana.getByRole('button', { name: `Assumir #${id}` }).click()
  expect((await respostaAna).status()).toBe(200)

  const respostaBruno = bruno.waitForResponse((r) => r.url().endsWith(`/incidentes/${id}/assumir`))
  await bruno.getByRole('button', { name: `Assumir #${id}` }).click()
  expect((await respostaBruno).status()).toBe(409)

  await expect(linha(bruno, id).getByText('Ana Souza alterou este incidente')).toBeVisible()
  await expect(bruno.getByRole('button', { name: `Assumir #${id}` })).toHaveAttribute(
    'aria-disabled',
    'true',
  )

  // Devolve o incidente à fila.
  await liberar(ana, id)
  await expect(ana.getByRole('button', { name: `Assumir #${id}` })).not.toHaveAttribute(
    'aria-disabled',
  )
})
