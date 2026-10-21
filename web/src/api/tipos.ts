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

export type PapelAnalista = 'analista' | 'supervisor'

export interface AnalistaComPapel extends AnalistaResumo {
  papel: PapelAnalista
}

export interface AnalistaLogado extends AnalistaResumo {
  usuario: string
  /** Ausente numa sessão salva antes do papel existir: vale como analista. */
  papel?: PapelAnalista
}

export interface DispositivoResumo {
  id: number
  nome: string
  placa: string | null
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
  /** Contato do motorista no momento do incidente (cópia do cadastro da frota). */
  motorista_nome: string | null
  motorista_telefone: string | null
  /** Posição do caminhão quando a telemetria abriu o incidente (nulo nos demais). */
  latitude?: number | null
  longitude?: number | null
  responsavel: AnalistaResumo | null
  atualizado_por: AnalistaResumo | null
  /** Caminhão que enviou pela ingestão (ADR 0008); nulo quando um analista registrou. */
  dispositivo: DispositivoResumo | null
  /** Incidente ativo mais antigo de que este parece cópia (mesma placa, ou local e categoria). */
  possivel_duplicata_de: number | null
  versao: number
  criado_em: string
  atualizado_em: string
}

export type TipoEvento =
  | 'criado'
  | 'assumido'
  | 'liberado'
  | 'status'
  | 'editado'
  | 'transferido'

/** Item do histórico (GET /incidentes/{id}/eventos). `analista` nulo: evento sem autor. */
export interface EventoIncidente {
  id: number
  tipo: TipoEvento
  analista: AnalistaResumo | null
  status_anterior: StatusIncidente | null
  status_novo: StatusIncidente | null
  campos: string[] | null
  comentario: string | null
  /** Transferência: o novo responsável. */
  responsavel_novo?: AnalistaResumo | null
  criado_em: string
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
  motorista_nome?: string | null
  motorista_telefone?: string | null
}

/** Veículo da frota (GET /veiculos/{placa}). */
export interface Veiculo {
  placa: string
  modelo: string
  motorista: { nome: string; telefone: string } | null
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
