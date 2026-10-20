import { describe, expect, it } from 'vitest'
import { ANA, BRUNO, incidente } from '@/test/fabricas'
import {
  alternar,
  criarBusca,
  descreverFiltros,
  filtrarIncidentes,
  filtrosDaUrl,
  filtrosParaUrl,
  SEM_FILTROS,
  temFiltro,
} from './filtros'

describe('filtros na URL', () => {
  it('ida e volta mantém a seleção', () => {
    const filtros = {
      situacao: 'fechados' as const,
      criticidades: ['alta' as const, 'baixa' as const],
      categorias: ['bloqueio_pista' as const],
      busca: 'BR-116',
      minhaFila: true,
    }

    const query = filtrosParaUrl(filtros)

    expect(query).toBe(
      'situacao=fechados&criticidade=alta,baixa&categoria=bloqueio_pista&responsavel=eu&busca=BR-116',
    )
    expect(filtrosDaUrl(`?${query}`)).toEqual(filtros)
  })

  it('gera a mesma URL para a mesma seleção em qualquer ordem', () => {
    expect(filtrosParaUrl({ ...SEM_FILTROS, criticidades: ['baixa', 'alta'] })).toBe(
      'criticidade=alta,baixa',
    )
  })

  it('descarta valores desconhecidos de um link editado à mão', () => {
    expect(
      filtrosDaUrl('?situacao=arquivados&criticidade=alta,urgente&categoria=xyz&responsavel=bruno'),
    ).toEqual({
      situacao: 'ativos',
      criticidades: ['alta'],
      categorias: [],
      busca: '',
      minhaFila: false,
    })
  })

  it('não escreve parâmetro quando não há filtro', () => {
    expect(filtrosParaUrl({ ...SEM_FILTROS, busca: '   ' })).toBe('')
    expect(temFiltro({ ...SEM_FILTROS, busca: '   ' })).toBe(false)
  })

  it('"Ativos" é o padrão e fica fora da URL; as outras situações contam como filtro', () => {
    expect(filtrosParaUrl(SEM_FILTROS)).toBe('')
    expect(filtrosParaUrl({ ...SEM_FILTROS, situacao: 'todos' })).toBe('situacao=todos')
    expect(temFiltro({ ...SEM_FILTROS, situacao: 'fechados' })).toBe(true)
  })
})

describe('criarBusca', () => {
  const pneu = incidente({
    id: 12,
    titulo: 'Pneu estourado',
    local: 'BR-116, km 212 — Registro/SP',
    placa: 'RTA-4E21',
  })
  const neblina = incidente({ id: 3, titulo: 'Neblina na serra', local: 'SP-160', placa: null })

  it.each([
    ['título sem acento nem caixa', 'PNEU', true],
    ['local com espaço no lugar do hífen', 'br 116', true],
    ['local sem separador', 'br116', true],
    ['placa sem separador', 'rta4e21', true],
    ['número com #', '#12', true],
    ['número sem #', '12', true],
    ['texto que não existe', 'capotamento', false],
  ])('%s', (_, termo, esperado) => {
    expect(criarBusca(termo)(pneu)).toBe(esperado)
  })

  it('"#1" procura só o incidente 1, não o 12', () => {
    expect(criarBusca('#1')(pneu)).toBe(false)
  })

  it('acha acentos digitados ou não', () => {
    expect(criarBusca('neblína')(neblina)).toBe(true)
  })
})

describe('filtrarIncidentes', () => {
  const itens = [
    incidente({ id: 1, criticidade: 'alta', categoria: 'bloqueio_pista' }),
    incidente({ id: 2, criticidade: 'alta', categoria: 'problema_mecanico' }),
    incidente({ id: 3, criticidade: 'baixa', categoria: 'bloqueio_pista' }),
    incidente({ id: 4, criticidade: 'alta', categoria: 'bloqueio_pista', status: 'fechado' }),
  ]

  it('combina criticidade e categoria e mantém a ordem da API', () => {
    const filtros = { ...SEM_FILTROS, criticidades: ['alta' as const], categorias: ['bloqueio_pista' as const] }
    const ativos = filtrarIncidentes(itens, filtros, ANA.id)
    expect(ativos.itens.map((i) => i.id)).toEqual([1])
    // O fechado que passa nos outros filtros é contado como oculto.
    expect(ativos.fechadosOcultos).toBe(1)

    const todos = filtrarIncidentes(itens, { ...filtros, situacao: 'todos' }, ANA.id)
    expect(todos.itens.map((i) => i.id)).toEqual([1, 4])
    expect(todos.porSituacao).toEqual({ ativos: 1, fechados: 1, todos: 2 })
  })

  it('conta cada categoria com a criticidade e a situação escolhidas', () => {
    const ativos = filtrarIncidentes(itens, { ...SEM_FILTROS, criticidades: ['alta'] }, ANA.id)
    expect(ativos.porCategoria.bloqueio_pista).toBe(1)
    expect(ativos.porCategoria.problema_mecanico).toBe(1)

    const fechados = filtrarIncidentes(
      itens,
      { ...SEM_FILTROS, situacao: 'fechados', criticidades: ['alta'] },
      ANA.id,
    )
    expect(fechados.porCategoria.bloqueio_pista).toBe(1)
    expect(fechados.porCategoria.problema_mecanico).toBe(0)
  })

  it('"Fechados" mostra só os fechados, o fechado mais recente primeiro', () => {
    const fechados = [
      incidente({ id: 7, status: 'fechado', atualizado_em: '2026-10-20T10:00:00Z' }),
      incidente({ id: 8 }),
      incidente({ id: 9, status: 'fechado', atualizado_em: '2026-10-20T12:00:00Z' }),
    ]
    const { itens: visiveis } = filtrarIncidentes(
      fechados,
      { ...SEM_FILTROS, situacao: 'fechados' },
      ANA.id,
    )
    expect(visiveis.map((i) => i.id)).toEqual([9, 7])
  })

  it('base dos cartões ignora o filtro de criticidade', () => {
    const { semFiltroDeCriticidade } = filtrarIncidentes(itens, {
      ...SEM_FILTROS,
      criticidades: ['alta'],
      categorias: ['bloqueio_pista'],
    }, ANA.id)

    expect(semFiltroDeCriticidade.map((i) => i.id)).toEqual([1, 3, 4])
  })

  it('minha fila mostra só os assumidos pelo analista e conta com os outros filtros', () => {
    const fila = [
      incidente({ id: 1, criticidade: 'alta', responsavel: ANA }),
      incidente({ id: 2, criticidade: 'alta', responsavel: BRUNO }),
      incidente({ id: 3, criticidade: 'baixa', responsavel: ANA }),
      incidente({ id: 4, criticidade: 'alta', responsavel: ANA, status: 'fechado' }),
      incidente({ id: 5, criticidade: 'alta' }),
    ]

    const desligado = filtrarIncidentes(fila, { ...SEM_FILTROS, criticidades: ['alta'] }, ANA.id)
    // A contagem do botão vale com a fila desligada: é o que ele mostraria ao ser ligado.
    expect(desligado.naMinhaFila).toBe(1)

    const ligado = filtrarIncidentes(fila, { ...SEM_FILTROS, minhaFila: true }, ANA.id)
    expect(ligado.itens.map((i) => i.id)).toEqual([1, 3])
    expect(ligado.naMinhaFila).toBe(2)
    // Os cartões de criticidade também respeitam a fila.
    expect(ligado.semFiltroDeCriticidade.map((i) => i.id)).toEqual([1, 3, 4])
  })
})

describe('auxiliares', () => {
  it('alternar liga e desliga um valor', () => {
    expect(alternar(['alta'], 'baixa')).toEqual(['alta', 'baixa'])
    expect(alternar(['alta', 'baixa'], 'alta')).toEqual(['baixa'])
  })

  it('descreve o filtro atual', () => {
    expect(
      descreverFiltros({
        situacao: 'ativos',
        criticidades: ['alta', 'media'],
        categorias: ['bloqueio_pista'],
        busca: ' br ',
        minhaFila: true,
      }),
    ).toBe('Criticidade Alta, Média · Bloqueio de Pista · atribuídos a mim · busca "br"')
  })
})
