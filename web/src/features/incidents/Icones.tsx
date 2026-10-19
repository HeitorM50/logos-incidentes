import type { Criticidade, StatusIncidente } from '@/api/tipos'

// Criticidade nunca depende só da cor (ADR 0004): cada nível tem uma forma própria.
// Alta = triângulo de alerta, Média = losango, Baixa = círculo vazado.

export function IconeCriticidade({
  criticidade,
  tamanho = 14,
}: {
  criticidade: Criticidade
  tamanho?: number
}) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 16 16" aria-hidden="true">
      {criticidade === 'alta' && (
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M8 0.8 15.6 14.6H0.4Z M7.1 5.2h1.8v5H7.1Z M7.1 11.3h1.8v1.8H7.1Z"
        />
      )}
      {criticidade === 'media' && (
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M8 0.6 15.4 8 8 15.4 0.6 8Z M4.6 7.1h6.8v1.8H4.6Z"
        />
      )}
      {criticidade === 'baixa' && (
        <circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" strokeWidth="2" />
      )}
    </svg>
  )
}

export function IconeStatus({ status }: { status: StatusIncidente }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" className="flex-none">
      {status === 'aberto' && (
        <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      )}
      {status === 'em_investigacao' && (
        <>
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {status === 'inconclusivo' && (
        <circle
          cx="8"
          cy="8"
          r="5.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeDasharray="2.2 2"
        />
      )}
      {status === 'fechado' && (
        <>
          <circle cx="8" cy="8" r="6.5" fill="currentColor" />
          <path
            d="M5 8.2l2 2 4-4.2"
            fill="none"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-card"
          />
        </>
      )}
    </svg>
  )
}
