import { describe, expect, it } from 'vitest'
import { incidente } from '@/test/fabricas'
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
      criticidades: ['alta' as const, 'baixa' as const],
      categorias: ['bloqueio_pista' as const],
      busca: 'BR-116',
    }

    const query = filtrosParaUrl(filtros)

    expect(query).toBe('criticidade=alta,baixa&categoria=bloqueio_pista&busca=BR-116')
    expect(filtrosDaUrl(`?${query}`)).toEqual(filtros)
  })

  it('gera a mesma URL para a mesma seleção em qualquer ordem', () => {
    expect(filtrosParaUrl({ ...SEM_FILTROS, criticidades: ['baixa', 'alta'] })).toBe(
      'criticidade=alta,baixa',
    )
  })

  it('descarta valores desconhecidos de um link editado à mão', () => {
    expect(filtrosDaUrl('?criticidade=alta,urgente&categoria=xyz')).toEqual({
      criticidades: ['alta'],
      categorias: [],
      busca: '',
    })
  })

  it('não escreve parâmetro quando não há filtro', () => {
    expect(filtrosParaUrl({ ...SEM_FILTROS, busca: '   ' })).toBe('')
    expect(temFiltro({ ...SEM_FILTROS, busca: '   ' })).toBe(false)
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
    const { itens: visiveis } = filtrarIncidentes(itens, {
      ...SEM_FILTROS,
      criticidades: ['alta'],
      categorias: ['bloqueio_pista'],
    })

    expect(visiveis.map((i) => i.id)).toEqual([1, 4])
  })

  it('conta cada categoria com a criticidade escolhida, só os ativos', () => {
    const { ativosPorCategoria } = filtrarIncidentes(itens, {
      ...SEM_FILTROS,
      criticidades: ['alta'],
    })

    expect(ativosPorCategoria.bloqueio_pista).toBe(1)
    expect(ativosPorCategoria.problema_mecanico).toBe(1)
  })

  it('base dos cartões ignora o filtro de criticidade', () => {
    const { semFiltroDeCriticidade } = filtrarIncidentes(itens, {
      ...SEM_FILTROS,
      criticidades: ['alta'],
      categorias: ['bloqueio_pista'],
    })

    expect(semFiltroDeCriticidade.map((i) => i.id)).toEqual([1, 3, 4])
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
        criticidades: ['alta', 'media'],
        categorias: ['bloqueio_pista'],
        busca: ' br ',
      }),
    ).toBe('Criticidade Alta, Média · Bloqueio de Pista · busca "br"')
  })
})
