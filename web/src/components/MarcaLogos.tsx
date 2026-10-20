interface Props {
  /** Sobre o painel escuro do login: quadrado claro e sem o subtítulo. */
  inversa?: boolean
}

export function MarcaLogos({ inversa = false }: Props) {
  return (
    <div className="flex items-center gap-2.5">
      {/* data-marca-logos: destino do voo do loader na abertura (TelaAbertura). */}
      <svg data-marca-logos width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x="1"
          y="1"
          width="22"
          height="22"
          rx="7"
          className={inversa ? 'fill-white' : 'fill-foreground'}
        />
        <path
          d="M8.5 6.5v9a2 2 0 0 0 2 2h6"
          fill="none"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={inversa ? 'stroke-painel-login' : 'stroke-background'}
        />
      </svg>
      <span className="font-mono text-[15px] font-bold tracking-[0.12em]">LOGOS</span>
      {!inversa && (
        <span className="text-[13px] text-texto-2 max-sm:hidden">
          Central de Resposta a Incidentes
        </span>
      )}
    </div>
  )
}
