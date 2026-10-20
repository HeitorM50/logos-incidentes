import { describe, expect, it } from 'vitest'
import { ANA, BRUNO, incidente } from '@/test/fabricas'
import { acoesParaDesfazer, aplicarAcao, motivoBloqueio, type Acao } from './acoes'

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

describe('transferir', () => {
  it('aplica o novo responsável e leva um Aberto para Em Investigação', () => {
    const novo = aplicarAcao(incidente(), { tipo: 'transferir', para: BRUNO }, ANA)
    expect(novo.responsavel).toEqual(BRUNO)
    expect(novo.status).toBe('em_investigacao')
    const inconclusivo = incidente({ status: 'inconclusivo', responsavel: ANA })
    expect(aplicarAcao(inconclusivo, { tipo: 'transferir', para: BRUNO }, ANA).status).toBe(
      'inconclusivo',
    )
  })

  it('bloqueia transferir para quem já é o responsável', () => {
    const comBruno = incidente({ status: 'em_investigacao', responsavel: BRUNO })
    expect(motivoBloqueio(comBruno, { tipo: 'transferir', para: BRUNO }, ANA.id)).toBe(
      'Bruno Lima já é o responsável.',
    )
  })
})

describe('acoesParaDesfazer', () => {
  // Cada caso: estado antes da ação e a ação. Desfazer = aplicar os passos devolvidos, cada um
  // permitido pelas regras no momento em que roda, até voltar ao status e responsável de antes.
  const casos: [string, Parameters<typeof incidente>[0], Acao][] = [
    ['assumir um Aberto', { status: 'aberto' }, { tipo: 'assumir' }],
    ['assumir um Inconclusivo', { status: 'inconclusivo' }, { tipo: 'assumir' }],
    [
      'liberar um Em Investigação',
      { status: 'em_investigacao', responsavel: ANA },
      { tipo: 'liberar' },
    ],
    ['liberar um Inconclusivo', { status: 'inconclusivo', responsavel: ANA }, { tipo: 'liberar' }],
    [
      'Em Investigação → Inconclusivo',
      { status: 'em_investigacao', responsavel: ANA },
      { tipo: 'status', status: 'inconclusivo' },
    ],
    [
      'Inconclusivo → Em Investigação',
      { status: 'inconclusivo', responsavel: ANA },
      { tipo: 'status', status: 'em_investigacao' },
    ],
  ]

  it.each(casos)('%s volta ao estado de antes', (_nome, dados, acao) => {
    const antes = incidente(dados)
    let atual = aplicarAcao(antes, acao, ANA)
    for (const passo of acoesParaDesfazer(antes, acao)!) {
      expect(motivoBloqueio(atual, passo, ANA.id)).toBeNull()
      atual = aplicarAcao(atual, passo, ANA)
    }
    expect(atual.status).toBe(antes.status)
    expect(atual.responsavel?.id ?? null).toBe(antes.responsavel?.id ?? null)
  })

  it('transferir volta para o responsável anterior; sem responsável antes, não há desfazer', () => {
    const comAna = incidente({ status: 'em_investigacao', responsavel: ANA })
    expect(acoesParaDesfazer(comAna, { tipo: 'transferir', para: BRUNO })).toEqual([
      { tipo: 'transferir', para: ANA },
    ])
    expect(acoesParaDesfazer(incidente(), { tipo: 'transferir', para: BRUNO })).toBeNull()
  })

  it('fechar não tem desfazer', () => {
    const antes = incidente({ status: 'em_investigacao', responsavel: ANA })
    expect(acoesParaDesfazer(antes, { tipo: 'status', status: 'fechado' })).toBeNull()
  })
})
