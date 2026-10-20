import type { Categoria } from '@/api/tipos'

// Protocolo sugerido por categoria: o que a central costuma fazer, em ordem. Ajuda o analista
// novo a agir sem treinamento e lembra o experiente do que não pode faltar. É orientação, não
// regra: nada aqui bloqueia ação nenhuma.
//
// Telefones de emergência do Brasil: SAMU 192, Bombeiros 193, PRF 191, Defesa Civil 199.

export const PROTOCOLOS: Record<Categoria, string[]> = {
  acidente_veiculo: [
    'Confirmar com o motorista se há feridos. Se houver, tratar como Acidente com Vítimas.',
    'Orientar a sinalização do local: pisca-alerta e triângulo a pelo menos 30 m.',
    'Acionar a PRF (191) em rodovia federal, ou a polícia rodoviária do estado.',
    'Acionar a seguradora e o guincho credenciado.',
    'Registrar o boletim de ocorrência e as fotos do local.',
  ],
  acidente_vitimas: [
    'Acionar o SAMU (192) e os Bombeiros (193) antes de qualquer outro passo.',
    'Acionar a PRF (191) ou a polícia rodoviária do estado.',
    'Orientar o motorista a não remover as vítimas e a sinalizar o local.',
    'Ficar em contato com o motorista até a chegada do socorro.',
    'Avisar a gestão de frota e o RH.',
  ],
  condicao_climatica: [
    'Orientar o motorista a reduzir a velocidade ou parar em local seguro (posto, área de descanso).',
    'Consultar os alertas da Defesa Civil (199) e do INMET para o trecho.',
    'Avisar os outros caminhões na mesma rota.',
    'Reavaliar a rota e o prazo da entrega com o cliente.',
  ],
  problema_mecanico: [
    'Orientar a parada em local seguro, com pisca-alerta e triângulo.',
    'Acionar a assistência mecânica ou o guincho credenciado.',
    'Avaliar o transbordo da carga, se o prazo da entrega exigir.',
    'Registrar a placa para a manutenção avaliar o veículo.',
  ],
  bloqueio_pista: [
    'Confirmar a causa e a previsão de liberação com a PRF (191) ou a concessionária.',
    'Avaliar uma rota alternativa.',
    'Avisar os outros caminhões na mesma rota.',
    'Informar o cliente sobre o atraso previsto.',
  ],
}

/** Busca do local no Google Maps (sem chave de API): abre em outra aba. */
export function linkDoMapa(local: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(local)}`
}
