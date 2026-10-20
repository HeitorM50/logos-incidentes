export function MarcaLogos() {
  return (
    <div className="flex items-center gap-2.5">
      {/* data-marca-logos: destino do voo do loader na abertura (TelaAbertura). */}
      <svg data-marca-logos width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="1" y="1" width="22" height="22" rx="4" className="fill-foreground" />
        <path
          d="M8 6v12h9"
          fill="none"
          strokeWidth="2.6"
          strokeLinecap="square"
          className="stroke-background"
        />
      </svg>
      <span className="font-mono text-base font-bold tracking-[0.12em]">LOGOS</span>
      <span className="text-sm text-texto-2 max-sm:hidden">Central de Resposta a Incidentes</span>
    </div>
  )
}
