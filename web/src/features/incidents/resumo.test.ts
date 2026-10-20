import { describe, expect, it } from 'vitest'
import type { Incidente } from '@/api/tipos'
import { resumirTriagem } from './resumo'

const AGORA = Date.parse('2026-10-19T12:00:00Z')

function incidente(dados: Partial<Incidente>): Incidente {
  return {
    id: 1,
    titulo: 'Pneu estourado',
    descricao: null,
    categoria: 'problema_mecanico',
    criticidade: 'media',
    status: 'aberto',
    local: 'BR-116, km 212',
    placa: null,
    responsavel: null,
    atualizado_por: null,
    dispositivo: null,
    versao: 1,
    criado_em: '2026-10-19T11:00:00Z',
    atualizado_em: '2026-10-19T11:00:00Z',
    ...dados,
  }
}

describe('resumirTriagem', () => {
  it('conta só os ativos por status e por criticidade', () => {
    const resumo = resumirTriagem(
      [
        incidente({ criticidade: 'alta', status: 'aberto' }),
        incidente({ criticidade: 'alta', status: 'em_investigacao' }),
        incidente({ criticidade: 'baixa', status: 'inconclusivo' }),
        incidente({ criticidade: 'alta', status: 'fechado' }),
      ],
      AGORA,
    )

    expect(resumo.ativos).toBe(3)
    expect(resumo.fechados).toBe(1)
    expect(resumo.porStatus).toEqual({ aberto: 1, em_investigacao: 1, inconclusivo: 1 })
    expect(resumo.porCriticidade.alta.quantidade).toBe(2)
    expect(resumo.porCriticidade.media.quantidade).toBe(0)
  })

  it('guarda a idade do ativo mais antigo de cada criticidade', () => {
    const resumo = resumirTriagem(
      [
        incidente({ criticidade: 'alta', criado_em: '2026-10-19T11:30:00Z' }),
        incidente({ criticidade: 'alta', criado_em: '2026-10-19T07:30:00Z' }),
        // Fechado mais antigo não conta: ninguém precisa agir nele.
        incidente({ criticidade: 'alta', status: 'fechado', criado_em: '2026-10-18T00:00:00Z' }),
      ],
      AGORA,
    )

    expect(resumo.porCriticidade.alta.maisAntigoMin).toBe(270)
    expect(resumo.porCriticidade.baixa.maisAntigoMin).toBeNull()
  })
})
