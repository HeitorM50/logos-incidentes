import type { Incidente } from './tipos'

// Códigos do contrato da API, mais dois produzidos pelo próprio cliente.
export type CodigoErro =
  | 'nao_autenticado'
  | 'credenciais_invalidas'
  | 'nao_responsavel'
  | 'nao_encontrado'
  | 'metodo_nao_permitido'
  | 'conflito_versao'
  | 'ja_assumido'
  | 'validacao'
  | 'transicao_invalida'
  | 'incidente_fechado'
  | 'muitas_tentativas'
  | 'servico_indisponivel'
  | 'erro_interno'
  | 'ia_desligada' // sugestão pela IA: sem chave da Anthropic neste ambiente
  | 'ia_indisponivel'
  | 'sem_sugestao'
  | 'cota_ia_esgotada'
  | 'sem_conexao' // a requisição nem chegou à API (rede, DNS, servidor fora do ar)
  | 'resposta_invalida' // a API respondeu algo fora do formato do contrato

export interface ErroDeCampo {
  campo: string
  mensagem: string
}

/** Erro único que o front inteiro trata. Componentes nunca leem a Response crua. */
export class ErroApi extends Error {
  readonly status: number
  readonly codigo: CodigoErro
  readonly campos: ErroDeCampo[]
  /** Estado atual do incidente, enviado pela API junto com o 409. */
  readonly atual: Incidente | null
  /** Segundos sugeridos pela API (cabeçalho Retry-After) antes de tentar de novo. */
  readonly tentarApos: number | null

  constructor(dados: {
    status: number
    codigo: CodigoErro
    mensagem: string
    campos?: ErroDeCampo[]
    atual?: Incidente | null
    tentarApos?: number | null
  }) {
    super(dados.mensagem)
    this.name = 'ErroApi'
    this.status = dados.status
    this.codigo = dados.codigo
    this.campos = dados.campos ?? []
    this.atual = dados.atual ?? null
    this.tentarApos = dados.tentarApos ?? null
  }

  /** Conflito de edição simultânea: outro analista alterou ou assumiu antes. */
  get ehConflito(): boolean {
    return this.status === 409
  }

  /** Falha passageira: vale tentar de novo sem o usuário mudar nada. */
  get ehTransitorio(): boolean {
    return this.codigo === 'sem_conexao' || [502, 503, 504].includes(this.status)
  }

  mensagemDoCampo(campo: string): string | undefined {
    return this.campos.find((erro) => erro.campo === campo)?.mensagem
  }
}

export function ehErroApi(erro: unknown): erro is ErroApi {
  return erro instanceof ErroApi
}
