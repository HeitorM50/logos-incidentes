// Tipos espelhados de docs/contrato-api.md. Os valores trafegam como códigos estáveis;
// os rótulos exibidos ficam em src/api/rotulos.ts.

export const CATEGORIAS = [
  'acidente_veiculo',
  'acidente_vitimas',
  'condicao_climatica',
  'problema_mecanico',
  'bloqueio_pista',
] as const
export type Categoria = (typeof CATEGORIAS)[number]

// A ordem importa: é a ordem de prioridade (alta primeiro).
export const CRITICIDADES = ['alta', 'media', 'baixa'] as const
export type Criticidade = (typeof CRITICIDADES)[number]

export const STATUS = ['aberto', 'em_investigacao', 'inconclusivo', 'fechado'] as const
export type StatusIncidente = (typeof STATUS)[number]

export interface AnalistaResumo {
  id: number
  nome: string
}

export interface AnalistaLogado extends AnalistaResumo {
  usuario: string
}

export interface Incidente {
  id: number
  titulo: string
  descricao: string | null
  categoria: Categoria
  criticidade: Criticidade
  status: StatusIncidente
  local: string
  placa: string | null
  responsavel: AnalistaResumo | null
  atualizado_por: AnalistaResumo | null
  versao: number
  criado_em: string
  atualizado_em: string
}

export interface ListaIncidentes {
  itens: Incidente[]
  total: number
  contagem_por_criticidade: Record<Criticidade, number>
}

export interface FiltrosIncidentes {
  criticidade?: Criticidade[]
  categoria?: Categoria[]
  status?: StatusIncidente[]
  responsavel?: 'eu'
}

export interface NovoIncidente {
  titulo: string
  descricao?: string | null
  categoria: Categoria
  criticidade: Criticidade
  local: string
  placa?: string | null
}

export type EdicaoIncidente = Partial<NovoIncidente> & { versao: number }

export interface TokenAcesso {
  token: string
  expira_em: string
  analista: AnalistaLogado
}

export interface Saude {
  status: 'ok' | 'degradado'
  banco: 'ok' | 'indisponivel'
}
