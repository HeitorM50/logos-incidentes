import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileDown } from 'lucide-react'
import { lazy, Suspense, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  obterRegistro,
  obterRelatorio,
  PERIODOS_HORAS,
  type PeriodoHoras,
  type RegistroDoPeriodo,
  type Relatorio,
} from '@/api/relatorio'
import type { AnalistaResumo } from '@/api/tipos'
import { LogosLoader } from '@/components/LogosLoader'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { DocumentoRelatorio } from './DocumentoRelatorio'

// Painel lateral do relatório, aberto pelo botão "Relatório" da triagem: a lista continua
// no topo, e o resumo da central fica a um clique. O conteúdo (com os gráficos) é carregado
// só quando o painel abre.
const ConteudoRelatorio = lazy(() => import('./ConteudoRelatorio'))

const ROTULO_PERIODO: Record<PeriodoHoras, string> = {
  6: 'Últimas 6 horas',
  24: 'Últimas 24 horas',
  168: 'Últimos 7 dias',
}

function Carregando({ texto }: { texto: string }) {
  return (
    <p role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-texto-2">
      <LogosLoader tamanho={20} decorativo fundo="var(--background)" />
      {texto}
    </p>
  )
}

interface Props {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  /** Quem está gerando: vai para o rodapé do PDF. */
  analista: AnalistaResumo
}

/**
 * "Exportar PDF": busca o registro do período, monta o documento fora da tela e abre a
 * impressão do navegador, onde o analista escolhe "Salvar como PDF". Sem biblioteca de PDF:
 * fonte, acentos e layout são os do próprio app.
 */
function useExportarPdf(horas: PeriodoHoras, relatorio: Relatorio | undefined) {
  const cliente = useQueryClient()
  const [documento, setDocumento] = useState<{
    relatorio: Relatorio
    registro: RegistroDoPeriodo
  } | null>(null)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState(false)

  async function exportar() {
    if (!relatorio) return
    setGerando(true)
    setErro(false)
    try {
      const registro = await cliente.fetchQuery({
        queryKey: ['relatorio-registro', horas],
        queryFn: ({ signal }) => obterRegistro(horas, signal),
        staleTime: 0,
      })
      setDocumento({ relatorio, registro })
    } catch {
      setErro(true)
    } finally {
      setGerando(false)
    }
  }

  // Com o documento na página, abre a impressão; ao fechar o diálogo, desmonta e devolve o
  // título da aba (que vira o nome sugerido do arquivo).
  useEffect(() => {
    if (!documento) return
    const raiz = document.documentElement
    const tituloAntes = document.title
    const data = new Date(documento.registro.gerado_em).toISOString().slice(0, 10)
    document.title = `Logos - relatorio de incidentes - ${data}`
    raiz.classList.add('imprimindo')
    const terminar = () => {
      raiz.classList.remove('imprimindo')
      document.title = tituloAntes
      setDocumento(null)
    }
    window.addEventListener('afterprint', terminar, { once: true })
    const quadro = requestAnimationFrame(() => window.print())
    return () => {
      cancelAnimationFrame(quadro)
      window.removeEventListener('afterprint', terminar)
      raiz.classList.remove('imprimindo')
      document.title = tituloAntes
    }
  }, [documento])

  return { exportar, gerando, erro, documento }
}

export function PainelRelatorio({ aberto, aoMudar, analista }: Props) {
  const idPeriodo = useId()
  // 6 h por padrão: os dados de demonstração cobrem poucas horas, e o período anterior também
  // tem incidentes para comparar.
  const [horas, setHoras] = useState<PeriodoHoras>(6)
  const consulta = useQuery({
    queryKey: ['relatorio', horas],
    queryFn: ({ signal }) => obterRelatorio(horas, signal),
    enabled: aberto,
    refetchInterval: aberto ? 30_000 : false,
    placeholderData: keepPreviousData,
  })
  const pdf = useExportarPdf(horas, consulta.data)

  return (
    <Sheet open={aberto} onOpenChange={aoMudar}>
      <SheetContent
        side="right"
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[520px]"
      >
        <SheetHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b px-5 py-4 pr-12">
          <div className="flex flex-col gap-0.5">
            <SheetTitle className="text-xl font-semibold">Relatório de incidentes</SheetTitle>
            <SheetDescription className="text-texto-2">
              Atendimento da frota, comparado com o período anterior.
            </SheetDescription>
          </div>
          <label htmlFor={idPeriodo} className="sr-only">
            Período
          </label>
          <span className="flex items-center gap-2">
          <select
            id={idPeriodo}
            value={horas}
            onChange={(e) => setHoras(Number(e.target.value) as PeriodoHoras)}
            className="h-9 rounded-full border-0 bg-pilula px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {PERIODOS_HORAS.map((p) => (
              <option key={p} value={p}>
                {ROTULO_PERIODO[p]}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void pdf.exportar()}
            disabled={!consulta.data || pdf.gerando}
            title="Abre a impressão do navegador: escolha Salvar como PDF"
            className="h-9 bg-pilula px-3.5"
          >
            <FileDown aria-hidden />
            {pdf.gerando ? 'Gerando…' : 'Exportar PDF'}
          </Button>
          </span>
          {pdf.erro && (
            <p role="alert" className="w-full text-[13px] text-erro-texto">
              Não foi possível gerar o PDF. Tente de novo.
            </p>
          )}
        </SheetHeader>
        {pdf.documento &&
          createPortal(
            <DocumentoRelatorio
              relatorio={pdf.documento.relatorio}
              registro={pdf.documento.registro}
              analista={analista}
            />,
            document.body,
          )}
        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
          aria-busy={consulta.isFetching}
        >
          {consulta.data ? (
            <Suspense fallback={<Carregando texto="Preparando os gráficos…" />}>
              <ConteudoRelatorio relatorio={consulta.data} />
            </Suspense>
          ) : consulta.isError ? (
            <div role="alert" className="flex flex-col items-center gap-3 py-16 text-sm text-texto-2">
              Não foi possível carregar o relatório.
              <button
                type="button"
                onClick={() => void consulta.refetch()}
                className="apertar h-9 cursor-pointer rounded-full bg-pilula px-4 font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Tentar de novo
              </button>
            </div>
          ) : (
            <Carregando texto="Carregando o relatório…" />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
