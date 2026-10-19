import { describe, expect, it } from 'vitest'
import { ANA, BRUNO, incidente } from '@/test/fabricas'
import { aplicarAcao, motivoBloqueio } from './acoes'

describe('motivoBloqueio', () => {
  it.each([
    ['assumir livre e aberto', incidente({ status: 'aberto' }), { tipo: 'assumir' } as const, null],
    [
      'assumir de outro analista',
      incidente({ status: 'em_investigacao', responsavel: BRUNO }),
      { tipo: 'assumir' } as const,
      'Bruno Lima é o responsável por este incidente.',
    ],
    [
      'qualquer ação em fechado',
      incidente({ status: 'fechado', responsavel: ANA }),
      { tipo: 'liberar' } as const,
      'Incidente fechado: não aceita mais alterações.',
    ],
    [
      'status sem responsável',
      incidente({ status: 'aberto' }),
      { tipo: 'status', status: 'fechado' } as const,
      'Assuma o incidente para mudar o status.',
    ],
    [
      'status de outro analista',
      incidente({ status: 'em_investigacao', responsavel: BRUNO }),
      { tipo: 'status', status: 'fechado' } as const,
      'Só Bruno Lima pode mudar o status.',
    ],
    [
      'transição fora do ciclo de vida',
      incidente({ status: 'em_investigacao', responsavel: ANA }),
      { tipo: 'status', status: 'aberto' } as const,
      'Não é possível mudar de Em Investigação para Aberto.',
    ],
    [
      'assumir o que já é seu',
      incidente({ status: 'inconclusivo', responsavel: ANA }),
      { tipo: 'assumir' } as const,
      'Você já é o responsável.',
    ],
    [
      'liberar sem responsável',
      incidente({ status: 'aberto' }),
      { tipo: 'liberar' } as const,
      'O incidente não tem responsável.',
    ],
    [
      'status válido do responsável',
      incidente({ status: 'inconclusivo', responsavel: ANA }),
      { tipo: 'status', status: 'fechado' } as const,
      null,
    ],
  ])('%s', (_, item, acao, esperado) => {
    expect(motivoBloqueio(item, acao, ANA.id)).toBe(esperado)
  })
})

describe('aplicarAcao', () => {
  it('assumir define o responsável e coloca em investigação', () => {
    const novo = aplicarAcao(incidente({ status: 'inconclusivo' }), { tipo: 'assumir' }, ANA)

    expect(novo.responsavel).toEqual(ANA)
    expect(novo.status).toBe('em_investigacao')
  })

  it('liberar volta a investigação para aberto e mantém o inconclusivo', () => {
    const emInvestigacao = incidente({ status: 'em_investigacao', responsavel: ANA })
    const inconclusivo = incidente({ status: 'inconclusivo', responsavel: ANA })

    expect(aplicarAcao(emInvestigacao, { tipo: 'liberar' }, ANA).status).toBe('aberto')
    expect(aplicarAcao(inconclusivo, { tipo: 'liberar' }, ANA)).toMatchObject({
      status: 'inconclusivo',
      responsavel: null,
    })
  })
})
