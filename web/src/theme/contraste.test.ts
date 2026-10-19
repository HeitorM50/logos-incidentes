/// <reference types="node" />
// Teste roda no Node (Vitest): os tipos do Node valem só neste arquivo, não no app.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Critério de aceite da #20: os dois temas passam no contraste WCAG AA. O teste lê os tokens
// de src/index.css e confere cada par de cores que a interface usa: 4,5:1 para texto e
// 3:1 para bordas, ícones, foco e segmentos de gráfico (WCAG 1.4.3 e 1.4.11).

// O Vitest roda em web/ (local e no CI) e troca imports de CSS por texto vazio: lê do disco.
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

function tokens(seletor: string): Record<string, string> {
  const bloco = css.slice(css.indexOf(`${seletor} {`)).split('\n}')[0]
  return Object.fromEntries(
    [...bloco.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]),
  )
}

const CLARO = tokens(':root')
const TEMAS = { claro: CLARO, escuro: { ...CLARO, ...tokens('.dark') } }

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (escuro + 0.05)
}

/** Cor com transparência sobre um fundo (ex.: bg-destructive/10). */
function misturar(cor: string, fundo: string, alfa: number): string {
  const f = rgb(fundo)
  return `#${rgb(cor)
    .map((c, i) => Math.round(c * alfa + f[i] * (1 - alfa)).toString(16).padStart(2, '0'))
    .join('')}`
}

const TEXTO = 4.5
const NAO_TEXTO = 3

// [frente, fundo, mínimo, onde aparece]
const PARES: [string, string, number, string][] = [
  ['foreground', 'background', TEXTO, 'texto na página'],
  ['foreground', 'card', TEXTO, 'texto na tabela'],
  ['texto-2', 'card', TEXTO, 'texto secundário'],
  ['texto-2', 'background', TEXTO, 'texto secundário na página'],
  ['texto-3', 'card', TEXTO, 'texto terciário'],
  ['texto-3', 'background', TEXTO, 'texto terciário na página'],
  ['texto-3', 'superficie-2', TEXTO, 'detalhes da linha'],
  ['texto-2', 'cabecalho', TEXTO, 'cabeçalho da tabela'],
  ['texto-3', 'linha-pendente', TEXTO, 'linha em andamento'],
  ['foreground', 'info-fundo', TEXTO, 'linha com conflito'],
  ['muted-foreground', 'popover', TEXTO, 'descrição do painel e do diálogo'],
  ['primary-foreground', 'primary', TEXTO, 'botão principal'],
  ['erro-texto', 'erro-fundo', TEXTO, 'caixa de erro'],
  ['erro-texto', 'popover', TEXTO, 'erro abaixo do campo'],
  ['erro-texto', 'superficie-2', TEXTO, 'botão Remover nos detalhes'],
  ['info-texto', 'info-fundo', TEXTO, 'aviso de conflito'],
  ['info-sobre-botao', 'info-botao', TEXTO, 'botão do aviso de conflito'],
  ['aviso-texto', 'aviso-fundo', TEXTO, 'aviso de falha'],
  ['aviso-detalhe', 'aviso-fundo', TEXTO, 'detalhe do aviso de falha'],
  ['alta-texto', 'alta-fundo', TEXTO, 'selo Alta'],
  ['media-texto', 'media-fundo', TEXTO, 'selo Média'],
  ['baixa-texto', 'baixa-fundo', TEXTO, 'selo Baixa'],
  ['alta-numero', 'card', TEXTO, 'número do cartão Alta'],
  ['media-numero', 'card', TEXTO, 'número do cartão Média'],
  ['baixa-numero', 'card', TEXTO, 'número do cartão Baixa'],
  ['ao-vivo', 'card', NAO_TEXTO, 'indicador ao vivo e ícone de sucesso'],
  ['borda-forte', 'card', NAO_TEXTO, 'borda de botão e campo'],
  ['input', 'popover', NAO_TEXTO, 'borda de campo no painel'],
  ['ring', 'card', NAO_TEXTO, 'anel de foco'],
  ['aviso-icone', 'aviso-fundo', NAO_TEXTO, 'ícone do aviso de falha'],
  ['aviso-borda-botao', 'aviso-fundo', NAO_TEXTO, 'borda do botão no aviso de falha'],
  ['info-borda', 'info-fundo', NAO_TEXTO, 'borda do aviso de conflito'],
  ['erro-borda', 'erro-fundo', NAO_TEXTO, 'borda da caixa de erro'],
  ['media-borda', 'card', NAO_TEXTO, 'borda do selo Média'],
  ['baixa-borda', 'card', NAO_TEXTO, 'borda do selo Baixa'],
  ['seg-aberto', 'faixa', NAO_TEXTO, 'segmento Aberto na faixa'],
  ['seg-investigacao', 'faixa', NAO_TEXTO, 'segmento Em Investigação na faixa'],
  ['seg-investigacao', 'seg-aberto', NAO_TEXTO, 'segmentos Aberto e Em Investigação lado a lado'],
]

describe.each(Object.entries(TEMAS))('contraste WCAG AA — tema %s', (nome, t) => {
  it.each(PARES)('%s sobre %s (mín. %d:1): %s', (frente, fundo, minimo) => {
    expect(t[frente], `token --${frente}`).toBeDefined()
    expect(t[fundo], `token --${fundo}`).toBeDefined()
    expect(contraste(t[frente], t[fundo])).toBeGreaterThanOrEqual(minimo)
  })

  it('botão destrutivo (fundo translúcido) e texto dentro do campo', () => {
    const fundoBotao = misturar(t.destructive, t.popover, nome === 'claro' ? 0.1 : 0.2)
    expect(contraste(t.destructive, fundoBotao)).toBeGreaterThanOrEqual(TEXTO)
    // No escuro, o campo tem fundo dark:bg-input/30 sobre o painel.
    const fundoCampo = nome === 'claro' ? t.popover : misturar(t.input, t.popover, 0.3)
    expect(contraste(t.foreground, fundoCampo)).toBeGreaterThanOrEqual(TEXTO)
    expect(contraste(t['muted-foreground'], fundoCampo)).toBeGreaterThanOrEqual(TEXTO)
  })
})
