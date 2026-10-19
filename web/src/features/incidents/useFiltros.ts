import { useMemo, useSyncExternalStore } from 'react'
import { filtrosDaUrl, filtrosParaUrl, type Filtros } from './filtros'

// A URL guarda os filtros: recarregar a página ou mandar o link para outro analista mantém a
// mesma visão. Sem roteador: o app tem uma tela só, e a query string basta.
//
// A tela lê os filtros da memória e a URL é gravada 300 ms depois da última mudança. Gravar a
// cada tecla da busca estoura o limite do navegador (o Safari recusa mais de 100 chamadas de
// replaceState em 30 s) e o campo pararia de aceitar texto.

const ESPERA_GRAVAR_URL_MS = 300

let consultaAtual = window.location.search
let gravacaoPendente: ReturnType<typeof setTimeout> | undefined
const ouvintes = new Set<() => void>()

function notificar() {
  for (const ouvinte of ouvintes) ouvinte()
}

// Voltar/avançar do navegador também muda a URL.
function aoNavegar() {
  clearTimeout(gravacaoPendente)
  consultaAtual = window.location.search
  notificar()
}

function assinar(ouvinte: () => void) {
  if (ouvintes.size === 0) {
    // Primeira tela montada: a URL pode ter mudado desde o carregamento do módulo.
    consultaAtual = window.location.search
    window.addEventListener('popstate', aoNavegar)
  }
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
    if (ouvintes.size === 0) window.removeEventListener('popstate', aoNavegar)
  }
}

function gravarNaUrl() {
  const url = window.location.pathname + consultaAtual + window.location.hash
  try {
    // replaceState: os filtros não viram entradas no histórico do botão Voltar.
    window.history.replaceState(window.history.state, '', url)
  } catch {
    // Limite do navegador: a tela continua certa; a URL atualiza na próxima mudança.
  }
}

/** Troca os filtros. `mudar` recebe os filtros atuais, sem risco de usar um valor antigo. */
export function definirFiltros(mudar: (atuais: Filtros) => Filtros) {
  const query = filtrosParaUrl(mudar(filtrosDaUrl(consultaAtual)))
  consultaAtual = query ? `?${query}` : ''
  notificar()
  clearTimeout(gravacaoPendente)
  gravacaoPendente = setTimeout(gravarNaUrl, ESPERA_GRAVAR_URL_MS)
}

export function useFiltros(): Filtros {
  const consulta = useSyncExternalStore(assinar, () => consultaAtual)
  return useMemo(() => filtrosDaUrl(consulta), [consulta])
}
