import type { Categoria, Criticidade, StatusIncidente } from './tipos'

// Rótulos exatamente como no enunciado do case.
export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  acidente_veiculo: 'Acidente com Veículo',
  acidente_vitimas: 'Acidente com Vítimas',
  condicao_climatica: 'Condição Climática Atípica na Pista',
  problema_mecanico: 'Problema Mecânico',
  bloqueio_pista: 'Bloqueio de Pista',
}

export const ROTULO_CRITICIDADE: Record<Criticidade, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
}

export const ROTULO_STATUS: Record<StatusIncidente, string> = {
  aberto: 'Aberto',
  em_investigacao: 'Em Investigação',
  inconclusivo: 'Inconclusivo',
  fechado: 'Fechado',
}
