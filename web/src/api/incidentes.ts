import { requisitar } from './cliente'
import type {
  EdicaoIncidente,
  FiltrosIncidentes,
  Incidente,
  ListaIncidentes,
  NovoIncidente,
  StatusIncidente,
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

export function liberarIncidente(id: number, versao: number): Promise<Incidente> {
  return requisitar(`/incidentes/${id}/liberar`, { metodo: 'POST', corpo: { versao } })
}

export function mudarStatus(
  id: number,
  versao: number,
  status: StatusIncidente,
): Promise<Incidente> {
  return requisitar(`/incidentes/${id}/status`, { metodo: 'POST', corpo: { versao, status } })
}
