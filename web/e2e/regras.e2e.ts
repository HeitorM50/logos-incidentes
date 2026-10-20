import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { API } from './apoio'

// Paridade em execução: as regras que a API rodando aplica são as mesmas que o front publicado
// usa para explicar bloqueios e validar o formulário.
test('as regras da API rodando são as mesmas que o front usa', async ({ request }) => {
  const resposta = await request.get(`${API}/regras`)
  expect(resposta.status()).toBe(200)
  const doFront = JSON.parse(readFileSync('src/api/regras.json', 'utf-8'))
  expect(await resposta.json()).toEqual(doFront)
})
