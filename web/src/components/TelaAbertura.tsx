import { LogosLoader } from './LogosLoader'

/** Transição pós-login: cobre a tela por um ciclo do loader enquanto a lista começa a carregar. */
export function TelaAbertura({ saindo }: { saindo: boolean }) {
  return (
    <div
      className={
        'fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-300 ' +
        (saindo ? 'pointer-events-none opacity-0' : 'opacity-100')
      }
    >
      <LogosLoader tamanho={88} legenda="Abrindo a central…" />
    </div>
  )
}
