import { expect, type Page } from '@playwright/test'

export const SESSAO_ANA = 'e2e/.sessoes/ana.json'
export const SESSAO_BRUNO = 'e2e/.sessoes/bruno.json'
export const API = 'http://localhost:8000'
export const CHAVE_DEMO = 'demo-caminhao-logos-2026'

/**
 * "Mostrando N de M incidentes": a linha visível (há também uma cópia só para leitor de tela,
 * que muda com 700 ms de atraso).
 */
export function linhaDeEstado(page: Page) {
  return page.locator('p:not([role])', { hasText: /^Mostrando \d+ de \d+ incidentes/ })
}

/** Abre a triagem (sessão já guardada) e espera a lista chegar. */
export async function abrirTriagem(page: Page, caminho = '/') {
  await page.goto(caminho)
  await expect(page.getByRole('table', { name: 'Incidentes' })).toBeVisible()
  await expect(linhaDeEstado(page)).toBeVisible()
}

/** Número de um incidente que a Ana pode assumir agora (aberto, sem responsável). */
export async function incidenteLivre(page: Page): Promise<number> {
  const botao = page.locator('button[aria-label^="Assumir #"]:not([aria-disabled])').first()
  const rotulo = await botao.getAttribute('aria-label')
  return Number(rotulo!.split('#')[1])
}

/** A linha (contêiner com as linhas de dados, detalhes e conflito) de um incidente. */
export function linha(page: Page, id: number) {
  return page.locator(`[data-incidente="${id}"]`)
}
