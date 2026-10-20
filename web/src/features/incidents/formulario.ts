import { ehErroApi } from '@/api/erros'
import { ehFinal, REGRAS } from '@/api/regras'
import type { Categoria, Criticidade, Incidente, NovoIncidente } from '@/api/tipos'
import { formatarTelefone, lerTelefone } from '@/lib/telefone'

// Espelho da validação da API (api/app/schemas/incidente.py). O formulário barra o que a API
// recusaria, e a API continua sendo a autoridade: um 422 dela também aparece no campo.

// Limites e padrão da placa vêm das regras geradas pela API (src/api/regras.ts).
export const LIMITES = {
  titulo: REGRAS.limites.titulo.max,
  descricao: REGRAS.limites.descricao.max,
  local: REGRAS.limites.local.max,
  motoristaNome: REGRAS.limites.motorista_nome.max,
}
const MINIMO = { titulo: REGRAS.limites.titulo.min, local: REGRAS.limites.local.min }

// Placa no padrão antigo (ABC1234) ou Mercosul (ABC1D23), depois de tirar hífen e espaço.
const PADRAO_PLACA = REGRAS.padraoPlaca

export const CAMPOS = [
  'titulo',
  'categoria',
  'criticidade',
  'local',
  'placa',
  'motorista_nome',
  'motorista_telefone',
  'descricao',
] as const
export type Campo = (typeof CAMPOS)[number]

/** O que está digitado no formulário (texto cru; selects vazios valem ''). */
export interface ValoresFormulario {
  titulo: string
  descricao: string
  categoria: Categoria | ''
  criticidade: Criticidade | ''
  local: string
  placa: string
  motorista_nome: string
  motorista_telefone: string
}

export type ErrosFormulario = Partial<Record<Campo, string>>

export const FORMULARIO_VAZIO: ValoresFormulario = {
  titulo: '',
  descricao: '',
  categoria: '',
  criticidade: '',
  local: '',
  placa: '',
  motorista_nome: '',
  motorista_telefone: '',
}

export function valoresDe(incidente: Incidente): ValoresFormulario {
  return {
    titulo: incidente.titulo,
    descricao: incidente.descricao ?? '',
    categoria: incidente.categoria,
    criticidade: incidente.criticidade,
    local: incidente.local,
    placa: incidente.placa ?? '',
    motorista_nome: incidente.motorista_nome ?? '',
    motorista_telefone: incidente.motorista_telefone
      ? formatarTelefone(incidente.motorista_telefone)
      : '',
  }
}

/** "abc-1d23" → "ABC1D23"; vazio → null. */
export function normalizarPlaca(texto: string): string | null {
  const placa = texto.replace(/[-\s]/g, '').toUpperCase()
  return placa || null
}

// O Python conta caracteres por ponto de código; o .length do JS conta um emoji como 2.
const tamanho = (texto: string) => [...texto].length

// O Postgres não aceita o caractere nulo, e a API o recusa.
const INVALIDO = 'O texto contém caracteres inválidos.'

function validarTexto(texto: string, nome: string, minimo: number, maximo: number) {
  const limpo = texto.trim()
  if (!limpo) return `Informe ${nome}.`
  if (limpo.includes('\0')) return INVALIDO
  if (tamanho(limpo) < minimo) return `Use pelo menos ${minimo} caracteres.`
  if (tamanho(limpo) > maximo) return `Use no máximo ${maximo} caracteres.`
  return undefined
}

export function validar(valores: ValoresFormulario): ErrosFormulario {
  const erros: ErrosFormulario = {}
  const titulo = validarTexto(valores.titulo, 'o título', MINIMO.titulo, LIMITES.titulo)
  if (titulo) erros.titulo = titulo
  if (!valores.categoria) erros.categoria = 'Escolha a categoria.'
  if (!valores.criticidade) erros.criticidade = 'Escolha a criticidade.'
  const local = validarTexto(valores.local, 'o local', MINIMO.local, LIMITES.local)
  if (local) erros.local = local
  const placa = normalizarPlaca(valores.placa)
  if (placa && !PADRAO_PLACA.test(placa)) {
    erros.placa = 'Placa inválida. Use o formato ABC1234 ou ABC1D23.'
  }
  // Contato do motorista: opcional (sem ele, a API copia do cadastro da frota).
  if (valores.motorista_nome.trim()) {
    const nome = validarTexto(
      valores.motorista_nome,
      'o nome',
      REGRAS.limites.motorista_nome.min,
      LIMITES.motoristaNome,
    )
    if (nome) erros.motorista_nome = nome
  }
  if (lerTelefone(valores.motorista_telefone) === 'invalido') {
    erros.motorista_telefone = 'Telefone inválido. Use DDD + número, ex.: (11) 98765-4321.'
  }
  if (valores.descricao.includes('\0')) erros.descricao = INVALIDO
  else if (tamanho(valores.descricao.trim()) > LIMITES.descricao) {
    erros.descricao = `Use no máximo ${LIMITES.descricao} caracteres.`
  }
  return erros
}

/** Corpo do POST. Só chame com o formulário válido. */
export function paraNovo(valores: ValoresFormulario): NovoIncidente {
  return {
    titulo: valores.titulo.trim(),
    descricao: valores.descricao.trim() || null,
    categoria: valores.categoria as Categoria,
    criticidade: valores.criticidade as Criticidade,
    local: valores.local.trim(),
    placa: normalizarPlaca(valores.placa),
    motorista_nome: valores.motorista_nome.trim() || null,
    // validar() já barrou o inválido.
    motorista_telefone: lerTelefone(valores.motorista_telefone) as string | null,
  }
}

/**
 * Campos que mudaram em relação ao incidente, já normalizados. O PATCH leva só eles: um campo
 * que o analista não tocou não sobrescreve a mudança de outra pessoa.
 */
export function alteracoes(
  original: Incidente,
  valores: ValoresFormulario,
): Partial<NovoIncidente> {
  const novo = paraNovo(valores)
  const mudou: Partial<NovoIncidente> = {}
  for (const campo of CAMPOS) {
    if ((novo[campo] ?? null) !== (original[campo] ?? null)) {
      Object.assign(mudou, { [campo]: novo[campo] })
    }
  }
  return mudou
}

/** Campos cujo valor digitado difere do incidente (para avisar o que outra pessoa mudou). */
export function camposDiferentes(a: Incidente, b: Incidente): Campo[] {
  return CAMPOS.filter((campo) => (a[campo] ?? null) !== (b[campo] ?? null))
}

export const ROTULO_CAMPO: Record<Campo, string> = {
  titulo: 'Título',
  categoria: 'Categoria',
  criticidade: 'Criticidade',
  local: 'Local',
  placa: 'Placa',
  motorista_nome: 'Motorista',
  motorista_telefone: 'Telefone do motorista',
  descricao: 'Descrição',
}

/** Motivo pelo qual o analista não pode editar nem remover, ou null quando pode. */
export function motivoEdicao(incidente: Incidente, idAnalista: number): string | null {
  if (ehFinal(incidente.status)) return 'Incidente fechado: não aceita mais alterações.'
  const responsavel = incidente.responsavel
  if (responsavel && responsavel.id !== idAnalista) {
    return `Só ${responsavel.nome} pode editar ou remover este incidente.`
  }
  return null
}

function ehCampo(nome: string): nome is Campo {
  return (CAMPOS as readonly string[]).includes(nome)
}

/**
 * Separa um erro da API em erros por campo (422 de validação) e uma mensagem geral.
 * Erros de campo que o formulário não conhece viram parte da mensagem geral.
 */
export function errosDaApi(erro: unknown): { campos: ErrosFormulario; geral: string | null } {
  if (!ehErroApi(erro)) {
    return { campos: {}, geral: 'Erro inesperado. Seus dados continuam no formulário.' }
  }
  if (erro.codigo === 'validacao') {
    const campos: ErrosFormulario = {}
    const outros: string[] = []
    for (const { campo, mensagem } of erro.campos) {
      if (ehCampo(campo)) campos[campo] ??= mensagem
      else outros.push(mensagem)
    }
    const geral = outros.length ? `A API recusou os dados: ${outros.join('; ')}.` : null
    return { campos, geral: geral ?? (Object.keys(campos).length ? null : erro.message) }
  }
  if (erro.ehTransitorio) {
    return {
      campos: {},
      geral:
        'Não foi possível salvar. Verifique a conexão e tente de novo. ' +
        'Seus dados continuam no formulário.',
    }
  }
  if (erro.codigo === 'erro_interno' || erro.codigo === 'resposta_invalida') {
    return {
      campos: {},
      geral: 'Erro inesperado no servidor. Confira a lista antes de tentar de novo.',
    }
  }
  return { campos: {}, geral: erro.message }
}
