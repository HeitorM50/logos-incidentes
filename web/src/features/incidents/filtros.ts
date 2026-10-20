import { ROTULO_CATEGORIA, ROTULO_CRITICIDADE } from '@/api/rotulos'
import {
  CATEGORIAS,
  CRITICIDADES,
  type Categoria,
  type Criticidade,
  type Incidente,
} from '@/api/tipos'

// Filtros da triagem. A lista inteira (100 incidentes) já está no cliente pelo polling, então
// o filtro roda no front: troca instantânea, sem nova requisição, e as contagens de cada
// opção saem da mesma lista.

export interface Filtros {
  criticidades: Criticidade[]
  categorias: Categoria[]
  busca: string
  /** "Minha fila": só os incidentes que o analista assumiu. */
  minhaFila: boolean
}

export const SEM_FILTROS: Filtros = {
  criticidades: [],
  categorias: [],
  busca: '',
  minhaFila: false,
}

// Nomes curtos na URL: `?criticidade=alta,media&categoria=bloqueio_pista&busca=br-116`.
// `responsavel=eu` é o mesmo parâmetro que a API aceita em GET /incidentes.
const PARAM_CRITICIDADE = 'criticidade'
const PARAM_CATEGORIA = 'categoria'
const PARAM_BUSCA = 'busca'
const PARAM_RESPONSAVEL = 'responsavel'

/** Lê uma lista da URL e descarta valores desconhecidos (link antigo ou editado à mão). */
function lerLista<T extends string>(valor: string | null, validos: readonly T[]): T[] {
  if (!valor) return []
  const pedidos = new Set(valor.split(','))
  // Mantém a ordem canônica: a mesma seleção gera sempre a mesma URL.
  return validos.filter((v) => pedidos.has(v))
}

export function filtrosDaUrl(consulta: string): Filtros {
  const params = new URLSearchParams(consulta)
  return {
    criticidades: lerLista(params.get(PARAM_CRITICIDADE), CRITICIDADES),
    categorias: lerLista(params.get(PARAM_CATEGORIA), CATEGORIAS),
    busca: params.get(PARAM_BUSCA) ?? '',
    minhaFila: params.get(PARAM_RESPONSAVEL) === 'eu',
  }
}

/** Devolve a query string ("" quando não há filtro), sem o "?". */
export function filtrosParaUrl(filtros: Filtros): string {
  const params = new URLSearchParams()
  if (filtros.criticidades.length) {
    const criticidades = CRITICIDADES.filter((c) => filtros.criticidades.includes(c))
    params.set(PARAM_CRITICIDADE, criticidades.join(','))
  }
  if (filtros.categorias.length) {
    params.set(PARAM_CATEGORIA, CATEGORIAS.filter((c) => filtros.categorias.includes(c)).join(','))
  }
  if (filtros.minhaFila) params.set(PARAM_RESPONSAVEL, 'eu')
  if (!buscaVazia(filtros.busca)) params.set(PARAM_BUSCA, filtros.busca)
  // URLSearchParams codifica a vírgula como %2C; a vírgula pura deixa a URL legível.
  return params.toString().replaceAll('%2C', ',')
}

export function temFiltro(filtros: Filtros): boolean {
  return (
    filtros.criticidades.length > 0 ||
    filtros.categorias.length > 0 ||
    filtros.minhaFila ||
    !buscaVazia(filtros.busca)
  )
}

/** Texto do filtro atual, para o estado vazio: "Criticidade Alta · Bloqueio de Pista". */
export function descreverFiltros(filtros: Filtros): string {
  const partes: string[] = []
  if (filtros.criticidades.length) {
    partes.push(`Criticidade ${filtros.criticidades.map((c) => ROTULO_CRITICIDADE[c]).join(', ')}`)
  }
  if (filtros.categorias.length) {
    partes.push(filtros.categorias.map((c) => ROTULO_CATEGORIA[c]).join(', '))
  }
  if (filtros.minhaFila) partes.push('atribuídos a mim')
  if (!buscaVazia(filtros.busca)) partes.push(`busca "${filtros.busca.trim()}"`)
  return partes.join(' · ')
}

/** Liga ou desliga um valor numa lista de filtro. */
export function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]
}

/** Minúsculas, sem acento, sem hífen e espaços repetidos. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[-\s]+/g, ' ')
    .trim()
}

/** Sem separador nenhum: "br116", "BR 116" e "BR-116" ficam iguais; idem placas. */
function compactar(texto: string): string {
  return normalizar(texto).replaceAll(' ', '')
}

/** Busca com só espaços ou hífens não filtra nada e não conta como filtro ativo. */
export function buscaVazia(termo: string): boolean {
  return compactar(termo) === ''
}

/**
 * Busca simples: título, local, placa e número. "#12" procura só o incidente 12; "12" também
 * acha o 12, além de títulos, locais e placas que contêm "12".
 */
export function criarBusca(termo: string): (incidente: Incidente) => boolean {
  const limpo = compactar(termo)
  if (!limpo) return () => true

  const numero = /^#(\d+)$/.exec(limpo)
  if (numero) {
    const id = Number(numero[1])
    return (incidente) => incidente.id === id
  }

  const id = /^\d+$/.test(limpo) ? Number(limpo) : null
  // A mesma regra para todos os campos: compara sem separadores.
  return (incidente) =>
    incidente.id === id ||
    compactar(incidente.titulo).includes(limpo) ||
    compactar(incidente.local).includes(limpo) ||
    (!!incidente.placa && compactar(incidente.placa).includes(limpo))
}

export interface ResultadoFiltro {
  itens: Incidente[]
  /** Incidentes que passam nos outros filtros: base dos cartões de criticidade. */
  semFiltroDeCriticidade: Incidente[]
  /** Ativos que cada categoria mostraria se fosse escolhida. */
  ativosPorCategoria: Record<Categoria, number>
  /** Ativos atribuídos ao analista que "Minha fila" mostraria. */
  ativosNaMinhaFila: number
}

/**
 * Aplica os filtros mantendo a ordem da API. A contagem de cada opção usa os outros filtros
 * já escolhidos: o número no botão é quantos incidentes ATIVOS a lista mostra ao clicar nele.
 * A lista também traz os fechados (no fim), que não pedem ação e não entram na contagem.
 */
export function filtrarIncidentes(
  itens: Incidente[],
  filtros: Filtros,
  idAnalista: number,
): ResultadoFiltro {
  const busca = criarBusca(filtros.busca)
  const meu = (i: Incidente) => i.responsavel?.id === idAnalista
  const criticidadeOk = (i: Incidente) =>
    !filtros.criticidades.length || filtros.criticidades.includes(i.criticidade)
  const categoriaOk = (i: Incidente) =>
    !filtros.categorias.length || filtros.categorias.includes(i.categoria)

  const semFiltroDeCriticidade: Incidente[] = []
  const ativosPorCategoria = Object.fromEntries(CATEGORIAS.map((c) => [c, 0])) as Record<
    Categoria,
    number
  >
  const visiveis: Incidente[] = []
  let ativosNaMinhaFila = 0

  for (const incidente of itens) {
    if (!busca(incidente)) continue
    const critOk = criticidadeOk(incidente)
    const catOk = categoriaOk(incidente)
    const ativo = incidente.status !== 'fechado'
    if (critOk && catOk && ativo && meu(incidente)) ativosNaMinhaFila++
    if (filtros.minhaFila && !meu(incidente)) continue
    if (critOk && catOk) visiveis.push(incidente)
    if (catOk) semFiltroDeCriticidade.push(incidente)
    if (critOk && ativo) ativosPorCategoria[incidente.categoria]++
  }

  return { itens: visiveis, semFiltroDeCriticidade, ativosPorCategoria, ativosNaMinhaFila }
}
