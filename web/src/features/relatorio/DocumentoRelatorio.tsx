import type { Metrica, RegistroDoPeriodo, Relatorio } from '@/api/relatorio'
import { ROTULO_CATEGORIA, ROTULO_CRITICIDADE, ROTULO_STATUS } from '@/api/rotulos'
import { descreverEvento } from '@/features/incidents/eventos'
import { formatarDuracao } from '@/features/incidents/tempo'
import { variacao } from './variacao'

// Documento do "Exportar PDF": uma página pensada para o papel (A4), impressa pelo navegador
// ("Salvar como PDF"). Sempre em tema claro e em tons de cinza: o PDF precisa ser legível
// impresso em preto e branco, qualquer que seja o tema da tela. Fica fora da tela e só aparece
// durante a impressão (regras de @media print em index.css).

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const dataHora = (iso: string) => DATA_HORA.format(new Date(iso))
const hora = (iso: string | null) => (iso ? HORA.format(new Date(iso)) : '—')

/** Data e hora em duas linhas, para as colunas de horário caberem estreitas. */
function Horario({ iso }: { iso: string | null }) {
  if (!iso) return <>—</>
  const [data, horario] = HORA.format(new Date(iso)).split(', ')
  return (
    <>
      {data}
      <br />
      {horario}
    </>
  )
}

// Larguras das colunas da tabela (somam 100%): o comentário de fechamento é o texto mais longo.
const COLUNAS = ['4%', '8%', '15%', '13%', '7%', '9%', '9%', '7%', '7%', '7%', '14%']
const minutos = (valor: number | null) => (valor === null ? '—' : formatarDuracao(Math.round(valor)))

function comparacao(metrica: Metrica, formatar: (n: number) => string = String): string {
  if (metrica.anterior === null) return 'sem período anterior'
  const v = variacao(metrica)
  const anterior = `antes: ${formatar(metrica.anterior)}`
  if (!v || v.direcao === 'igual') return anterior
  return `${anterior} (${v.direcao === 'sobe' ? '+' : '−'}${v.pct}%)`
}

interface Props {
  relatorio: Relatorio
  registro: RegistroDoPeriodo
  /** Quem gerou: aparece no rodapé do documento. */
  analista: { id: number; nome: string }
}

export function DocumentoRelatorio({ relatorio, registro, analista }: Props) {
  const maior = Math.max(1, ...relatorio.funil.map((e) => e.quantidade))
  const numeros: { rotulo: string; valor: string; detalhe: string }[] = [
    {
      rotulo: 'Total recebidos',
      valor: String(relatorio.recebidos.atual ?? 0),
      detalhe: comparacao(relatorio.recebidos),
    },
    {
      rotulo: 'Alta recebidos',
      valor: String(relatorio.alta.atual ?? 0),
      detalhe: comparacao(relatorio.alta),
    },
    {
      rotulo: 'Tempo médio até assumir',
      valor: minutos(relatorio.tempo_ate_assumir_min.atual),
      detalhe: comparacao(relatorio.tempo_ate_assumir_min, (n) => minutos(n)),
    },
    {
      rotulo: 'Tempo médio até fechar',
      valor: minutos(relatorio.tempo_ate_fechar_min.atual),
      detalhe: comparacao(relatorio.tempo_ate_fechar_min, (n) => minutos(n)),
    },
    {
      rotulo: 'Taxa de atraso',
      valor:
        relatorio.taxa_atraso_pct.atual === null ? '—' : `${relatorio.taxa_atraso_pct.atual}%`,
      detalhe: comparacao(relatorio.taxa_atraso_pct, (n) => `${n}%`),
    },
  ]

  return (
    <article className="documento-impressao bg-white font-sans text-[11px] leading-snug text-black">
      <header className="mb-5 flex items-end justify-between border-b-2 border-black pb-3">
        <div>
          <p className="font-mono text-[12px] font-bold tracking-[0.12em]">LOGOS</p>
          <h1 className="text-[20px] font-semibold">Relatório de incidentes</h1>
          <p className="text-neutral-700">
            Período: {dataHora(registro.inicio)} a {dataHora(registro.gerado_em)} (
            {relatorio.horas === 168 ? '7 dias' : `${relatorio.horas} horas`})
          </p>
        </div>
        <p className="text-right text-neutral-700">
          Gerado em {dataHora(registro.gerado_em)}
          <br />
          por {analista.nome}
        </p>
      </header>

      <section className="mb-5 break-inside-avoid">
        <h2 className="mb-2 text-[13px] font-semibold">1. Resumo</h2>
        <div className="grid grid-cols-5 gap-2">
          {numeros.map((n) => (
            <div key={n.rotulo} className="rounded border border-neutral-400 p-2">
              <p className="text-neutral-700">{n.rotulo}</p>
              <p className="font-mono text-[16px] font-semibold">{n.valor}</p>
              <p className="text-[10px] text-neutral-600">{n.detalhe}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-5 break-inside-avoid">
        <h2 className="mb-2 text-[13px] font-semibold">2. Funil do atendimento</h2>
        <ul className="flex flex-col gap-1">
          {relatorio.funil.map((etapa) => (
            <li key={etapa.etapa} className="grid grid-cols-[140px_1fr_40px] items-center gap-2">
              <span>{etapa.etapa}</span>
              <span className="h-3 border border-neutral-500">
                <span
                  className="block h-full bg-neutral-700 print:[print-color-adjust:exact]"
                  style={{ width: `${(etapa.quantidade / maior) * 100}%` }}
                />
              </span>
              <span className="text-right font-mono">{etapa.quantidade}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-[13px] font-semibold">
          3. Incidentes recebidos ou fechados no período ({registro.incidentes.length})
        </h2>
        {registro.incidentes.length === 0 ? (
          <p className="text-neutral-700">Nenhum incidente no período.</p>
        ) : (
          <table className="w-full table-fixed border-collapse text-[9.5px]">
            <colgroup>
              {COLUNAS.map((largura, n) => (
                <col key={n} style={{ width: largura }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-black text-left">
                {['#', 'Criticidade', 'Incidente', 'Local e placa', 'Origem', 'Responsável', 'Motorista', 'Aberto', 'Assumido', 'Fechado', 'Situação e comentário'].map(
                  (c) => (
                    <th key={c} className="px-1 py-1 font-semibold">
                      {c}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {registro.incidentes.map((i) => (
                <tr key={i.id} className="break-inside-avoid border-b border-neutral-300 align-top">
                  <td className="px-1 py-1 font-mono">{i.id}</td>
                  <td className="px-1 py-1 font-semibold uppercase">
                    {ROTULO_CRITICIDADE[i.criticidade]}
                  </td>
                  <td className="px-1 py-1">
                    {i.titulo}
                    <br />
                    <span className="text-neutral-600">{ROTULO_CATEGORIA[i.categoria]}</span>
                  </td>
                  <td className="px-1 py-1">
                    {i.local}
                    {i.placa && <span className="block font-mono text-neutral-600">{i.placa}</span>}
                  </td>
                  <td className="px-1 py-1">{i.origem}</td>
                  <td className="px-1 py-1">{i.responsavel ?? '—'}</td>
                  <td className="px-1 py-1">{i.motorista ?? '—'}</td>
                  <td className="px-1 py-1 font-mono">
                    <Horario iso={i.criado_em} />
                  </td>
                  <td className="px-1 py-1 font-mono">
                    <Horario iso={i.assumido_em} />
                  </td>
                  <td className="px-1 py-1 font-mono">
                    <Horario iso={i.fechado_em} />
                  </td>
                  <td className="px-1 py-1">
                    {ROTULO_STATUS[i.status]}
                    {i.comentario_fechamento && (
                      <span className="block text-neutral-700">“{i.comentario_fechamento}”</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-semibold">
          4. Linha do tempo ({registro.eventos.length} eventos)
        </h2>
        <ol className="flex flex-col">
          {registro.eventos.map((e) => (
            <li
              key={e.id}
              className="grid break-inside-avoid grid-cols-[86px_44px_1fr] gap-2 border-b border-neutral-200 py-0.5"
            >
              <span className="font-mono">{hora(e.criado_em)}</span>
              <span className="font-mono">#{e.incidente_id}</span>
              <span>
                {/* Id que não existe: o PDF é lido por outras pessoas, então nunca "Você". */}
                {descreverEvento(e, -1)}
                {e.incidente_titulo && (
                  <span className="text-neutral-600"> — {e.incidente_titulo}</span>
                )}
                {e.comentario && <span className="block text-neutral-700">“{e.comentario}”</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-5 border-t border-neutral-400 pt-2 text-[9.5px] text-neutral-600">
        Logos — Central de Resposta a Incidentes. Dados do histórico de cada incidente; período
        anterior do mesmo tamanho para comparação.
      </footer>
    </article>
  )
}
