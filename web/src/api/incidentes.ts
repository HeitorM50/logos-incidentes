import { requisitar } from './cliente'
import { ehErroApi } from './erros'
import type {
  EdicaoIncidente,
  EventoIncidente,
  FiltrosIncidentes,
  Incidente,
  ListaIncidentes,
  NovoIncidente,
  StatusIncidente,
  Veiculo,
} from './tipos'

export function listarIncidentes(
  filtros: FiltrosIncidentes = {},
  sinal?: AbortSignal,
): Promise<ListaIncidentes> {
  return requisitar('/incidentes', { consulta: { ...filtros }, sinal })
}

export function obterIncidente(id: number, sinal?: AbortSignal): Promise<Incidente> {
  return requisitar(`/incidentes/${id}`, { sinal })
}

export function listarEventos(id: number, sinal?: AbortSignal): Promise<EventoIncidente[]> {
  return requisitar(`/incidentes/${id}/eventos`, { sinal })
}

/** Veículo da frota e o motorista atual; null quando a placa não está cadastrada. */
export async function obterVeiculo(placa: string, sinal?: AbortSignal): Promise<Veiculo | null> {
  try {
    return await requisitar(`/veiculos/${encodeURIComponent(placa)}`, { sinal })
  } catch (erro) {
    if (ehErroApi(erro) && erro.codigo === 'nao_encontrado') return null
    throw erro
  }
}

export function criarIncidente(dados: NovoIncidente): Promise<Incidente> {
  return requisitar('/incidentes', { metodo: 'POST', corpo: dados })
}

export function editarIncidente(id: number, dados: EdicaoIncidente): Promise<Incidente> {
  return requisitar(`/incidentes/${id}`, { metodo: 'PATCH', corpo: dados })
}

export function removerIncidente(id: number, versao: number): Promise<void> {
  return requisitar(`/incidentes/${id}`, { metodo: 'DELETE', consulta: { versao } })
}

// Toda alteração envia a versão que o analista viu (controle de concorrência, ADR 0002).

export function assumirIncidente(id: number, versao: number): Promise<Incidente> {
  return requisitar(`/incidentes/${id}/assumir`, { metodo: 'POST', corpo: { versao } })
}

export function liberarIncidente(
  id: number,
  versao: number,
  comentario?: string,
): Promise<Incidente> {
  return requisitar(`/incidentes/${id}/liberar`, {
    metodo: 'POST',
    corpo: { versao, ...(comentario ? { comentario } : {}) },
  })
}

export function mudarStatus(
  id: number,
  versao: number,
  status: StatusIncidente,
  comentario?: string,
): Promise<Incidente> {
  return requisitar(`/incidentes/${id}/status`, {
    metodo: 'POST',
    corpo: { versao, status, ...(comentario ? { comentario } : {}) },
  })
}
