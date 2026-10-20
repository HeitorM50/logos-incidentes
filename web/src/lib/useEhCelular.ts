import { useSyncExternalStore } from 'react'

// Abaixo de 1024 px (celular e tablet em pé), a tabela de 8 colunas não cabe: a triagem vira
// uma lista de cartões. A escolha é feita aqui, e não escondendo com CSS, para o DOM não ter
// as 100 linhas duas vezes (e o leitor de tela não ler tudo em dobro).

export const CONSULTA_CELULAR = '(max-width: 1023.98px)'

function assinar(aoMudar: () => void) {
  const consulta = window.matchMedia?.(CONSULTA_CELULAR)
  consulta?.addEventListener('change', aoMudar)
  return () => consulta?.removeEventListener('change', aoMudar)
}

function ler() {
  return window.matchMedia?.(CONSULTA_CELULAR).matches ?? false
}

export function useEhCelular() {
  return useSyncExternalStore(assinar, ler, () => false)
}
