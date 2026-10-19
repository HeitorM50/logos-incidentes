import { describe, expect, it } from 'vitest'
import { ErroApi } from '@/api/erros'
import { ANA, BRUNO, incidente } from '@/test/fabricas'
import {
  alteracoes,
  errosDaApi,
  FORMULARIO_VAZIO,
  motivoEdicao,
  normalizarPlaca,
  paraNovo,
  validar,
  valoresDe,
  type ValoresFormulario,
} from './formulario'

const VALIDO: ValoresFormulario = {
  titulo: 'Tombamento na serra',
  descricao: '',
  categoria: 'acidente_veiculo',
  criticidade: 'alta',
  local: 'BR-376, km 668',
  placa: '',
}

describe('validar', () => {
  it('exige título, categoria, criticidade e local', () => {
    expect(validar(FORMULARIO_VAZIO)).toEqual({
      titulo: 'Informe o título.',
      categoria: 'Escolha a categoria.',
      criticidade: 'Escolha a criticidade.',
      local: 'Informe o local.',
    })
  })

  it('conta o texto sem os espaços das pontas, como a API', () => {
    expect(validar({ ...VALIDO, titulo: '  ab  ' }).titulo).toBe('Use pelo menos 3 caracteres.')
    expect(validar({ ...VALIDO, titulo: '   ' }).titulo).toBe('Informe o título.')
    expect(validar({ ...VALIDO, local: 'x'.repeat(161) }).local).toBe(
      'Use no máximo 160 caracteres.',
    )
    expect(validar({ ...VALIDO, descricao: 'x'.repeat(2001) }).descricao).toBe(
      'Use no máximo 2000 caracteres.',
    )
  })

  it('conta emoji como um caractere, como a API, e recusa o caractere nulo', () => {
    expect(validar({ ...VALIDO, titulo: '🚚'.repeat(120) }).titulo).toBeUndefined()
    expect(validar({ ...VALIDO, titulo: 'ab\0c' }).titulo).toBe(
      'O texto contém caracteres inválidos.',
    )
    expect(validar({ ...VALIDO, descricao: 'x\0' }).descricao).toBe(
      'O texto contém caracteres inválidos.',
    )
  })

  it('aceita placa antiga e Mercosul, com hífen, espaço e minúsculas', () => {
    expect(validar({ ...VALIDO, placa: 'abc-1234' })).toEqual({})
    expect(validar({ ...VALIDO, placa: 'ABC 1D23' })).toEqual({})
    expect(validar({ ...VALIDO, placa: 'AB1234' }).placa).toMatch(/Placa inválida/)
    expect(validar({ ...VALIDO, placa: '1234ABC' }).placa).toMatch(/Placa inválida/)
  })
})

describe('paraNovo e alteracoes', () => {
  it('normaliza o corpo do POST: apara textos, vazio vira null, placa em maiúsculas', () => {
    expect(
      paraNovo({ ...VALIDO, titulo: '  Tombamento  ', descricao: '  ', placa: 'abc-1d23' }),
    ).toEqual({
      titulo: 'Tombamento',
      descricao: null,
      categoria: 'acidente_veiculo',
      criticidade: 'alta',
      local: 'BR-376, km 668',
      placa: 'ABC1D23',
    })
    expect(normalizarPlaca('  ')).toBeNull()
  })

  it('a edição envia só os campos que mudaram', () => {
    const original = incidente({ placa: 'ABC1D23', descricao: null })
    const valores = valoresDe(original)
    expect(alteracoes(original, valores)).toEqual({})
    // Mesma placa escrita de outro jeito não é mudança.
    expect(alteracoes(original, { ...valores, placa: 'abc-1d23' })).toEqual({})
    expect(alteracoes(original, { ...valores, titulo: 'Novo título', placa: '' })).toEqual({
      titulo: 'Novo título',
      placa: null,
    })
  })
})

describe('motivoEdicao', () => {
  it('bloqueia fechado e incidente de outro responsável', () => {
    expect(motivoEdicao(incidente(), ANA.id)).toBeNull()
    expect(motivoEdicao(incidente({ responsavel: ANA }), ANA.id)).toBeNull()
    expect(motivoEdicao(incidente({ responsavel: BRUNO }), ANA.id)).toBe(
      'Só Bruno Lima pode editar ou remover este incidente.',
    )
    expect(motivoEdicao(incidente({ status: 'fechado' }), ANA.id)).toMatch(/fechado/)
  })
})

describe('errosDaApi', () => {
  it('leva o 422 para o campo certo e o resto para a mensagem geral', () => {
    const erro = new ErroApi({
      status: 422,
      codigo: 'validacao',
      mensagem: 'Dados inválidos.',
      campos: [
        { campo: 'placa', mensagem: 'placa inválida' },
        { campo: 'extra', mensagem: 'campo não permitido' },
      ],
    })
    expect(errosDaApi(erro)).toEqual({
      campos: { placa: 'placa inválida' },
      geral: 'A API recusou os dados: campo não permitido.',
    })
  })

  it('falha passageira pede para tentar de novo e diz que nada se perdeu', () => {
    const erro = new ErroApi({ status: 503, codigo: 'servico_indisponivel', mensagem: 'x' })
    expect(errosDaApi(erro).geral).toMatch(/Verifique a conexão.*continuam no formulário/)
  })
})
