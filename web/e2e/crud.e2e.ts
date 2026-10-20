import { expect, test } from '@playwright/test'
import { abrirTriagem, linha, SESSAO_ANA } from './apoio'

test.use({ storageState: SESSAO_ANA })

test('criar (dado inválido não chega à API), editar e remover', async ({ page }) => {
  await abrirTriagem(page)
  const escritas: string[] = []
  page.on('request', (r) => {
    if (r.method() !== 'GET' && r.method() !== 'OPTIONS') escritas.push(r.method())
  })

  // 1. Dado inválido: erro no campo, foco nele, nenhuma requisição.
  await page.getByRole('button', { name: 'Novo incidente' }).click()
  const painel = page.getByRole('dialog', { name: 'Novo incidente' })
  await painel.getByLabel(/Título/).fill('ab')
  await painel.getByRole('button', { name: 'Criar incidente' }).click()
  await expect(painel.getByLabel(/Título/)).toHaveAccessibleDescription(
    'Use pelo menos 3 caracteres.',
  )
  await expect(painel.getByLabel(/Título/)).toBeFocused()
  expect(escritas).toEqual([])

  // 2. Criar de verdade.
  const titulo = `Teste ponta a ponta ${Date.now()}`
  await painel.getByLabel(/Título/).fill(titulo)
  await painel.getByLabel(/Categoria/).selectOption('problema_mecanico')
  // O rádio fica escondido (sr-only) dentro do rótulo estilizado: clica-se no rótulo.
  await painel.locator('label', { hasText: 'Baixa' }).click()
  await expect(painel.getByRole('radio', { name: 'Baixa' })).toBeChecked()
  await painel.getByLabel(/Local/).fill('Pátio de testes')
  await painel.getByLabel(/Placa/).fill('abc-1d23')
  await painel.getByRole('button', { name: 'Criar incidente' }).click()
  await expect(painel).toBeHidden()
  await page.getByRole('button', { name: 'Mostrar na lista' }).click()
  const criada = page.locator('[data-incidente]', { hasText: titulo })
  await expect(criada).toHaveCount(1)
  const id = Number(await criada.getAttribute('data-incidente'))

  // 3. Editar: só o título muda; o histórico registra a edição.
  await page.getByRole('button', { name: `Ver detalhes de #${id}` }).click()
  await page.getByRole('button', { name: `Editar #${id}` }).click()
  const edicao = page.getByRole('dialog', { name: `Editar incidente #${id}` })
  await expect(edicao.getByLabel(/Placa/)).toHaveValue('ABC1D23') // normalizada pela API
  await edicao.getByLabel(/Título/).fill(`${titulo} (editado)`)
  await edicao.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(edicao).toBeHidden()
  await expect(linha(page, id).getByText(`${titulo} (editado)`)).toBeVisible()
  await expect(linha(page, id).getByText('Você editou o título')).toBeVisible()

  // 4. Remover com confirmação.
  await page.getByRole('button', { name: `Remover #${id}` }).click()
  const confirmacao = page.getByRole('alertdialog', { name: `Remover o incidente #${id}?` })
  await confirmacao.getByRole('button', { name: 'Remover incidente' }).click()
  await expect(linha(page, id)).toHaveCount(0)
  await expect(page.getByText(`Incidente #${id} removido.`).first()).toBeVisible()
})
