import { QueryClient } from '@tanstack/react-query'
import { ehErroApi } from '@/api/erros'

const MAXIMO_TENTATIVAS = 3
const ESPERA_MAXIMA_MS = 8000

/**
 * Leituras são repetidas só em falha passageira (rede, 502/503/504). Erros 4xx são
 * definitivos: repetir não muda a resposta e só atrasa o aviso ao analista.
 */
export function deveRepetir(falhas: number, erro: unknown): boolean {
  return falhas < MAXIMO_TENTATIVAS && ehErroApi(erro) && erro.ehTransitorio
}

/** Backoff exponencial (1 s, 2 s, 4 s...), respeitando o Retry-After da API quando vier. */
export function esperaAntesDeRepetir(falhas: number, erro: unknown): number {
  if (ehErroApi(erro) && erro.tentarApos) return erro.tentarApos * 1000
  return Math.min(1000 * 2 ** falhas, ESPERA_MAXIMA_MS)
}

export function criarClienteDeConsultas(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: deveRepetir,
        retryDelay: esperaAntesDeRepetir,
        staleTime: 2_000,
      },
      mutations: {
        // Escritas nunca se repetem sozinhas: poderiam aplicar a mesma ação duas vezes.
        retry: false,
      },
    },
  })
}
