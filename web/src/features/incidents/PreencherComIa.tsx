import { useMutation, useQuery } from '@tanstack/react-query'
import { CircleAlert, Sparkles } from 'lucide-react'
import { useId, useState } from 'react'
import { ehErroApi } from '@/api/erros'
import { ROTULO_CRITICIDADE } from '@/api/rotulos'
import { obterDisponibilidadeSugestao, sugerirIncidente, type Sugestao } from '@/api/sugestao'
import { LogosLoader } from '@/components/LogosLoader'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// Limites do POST /sugestao (app/schemas/sugestao.py).
const MINIMO = 10
const MAXIMO = 2000

interface Props {
  aoSugerir: (sugestao: Sugestao) => void
}

/**
 * Novo incidente a partir da mensagem do motorista (ADR 0014): o analista cola o texto do
 * WhatsApp e a IA preenche o formulário. Nada é salvo sem o analista conferir. Sem a chave da
 * Anthropic na API, o bloco não aparece e o formulário funciona como antes.
 */
export function PreencherComIa({ aoSugerir }: Props) {
  const id = useId()
  const [mensagem, setMensagem] = useState('')
  const disponibilidade = useQuery({
    queryKey: ['sugestao', 'disponivel'],
    queryFn: ({ signal }) => obterDisponibilidadeSugestao(signal),
    staleTime: Infinity,
    retry: false,
  })
  const sugestao = useMutation({
    mutationFn: sugerirIncidente,
    onSuccess: aoSugerir,
  })

  if (disponibilidade.data?.disponivel !== true) return null

  const texto = mensagem.trim()
  const curta = texto.length < MINIMO
  const erro = sugestao.error
    ? ehErroApi(sugestao.error)
      ? sugestao.error.message
      : 'Não foi possível pedir a sugestão. Preencha à mão.'
    : null

  function pedir() {
    if (curta || sugestao.isPending) return
    sugestao.mutate(texto)
  }

  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="flex flex-col gap-2 rounded-md border border-dashed border-borda-forte bg-superficie-2 px-3 py-3"
    >
      <h3 id={`${id}-titulo`} className="flex items-center gap-1.5 text-sm font-medium">
        <Sparkles aria-hidden className="size-4 text-texto-2" />
        Recebeu pelo WhatsApp?
      </h3>
      <label htmlFor={`${id}-mensagem`} className="text-[13px] text-texto-2">
        Cole a mensagem do motorista. A IA preenche os campos abaixo; confira antes de salvar.
      </label>
      <Textarea
        id={`${id}-mensagem`}
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        maxLength={MAXIMO}
        rows={3}
        placeholder="Ex.: Aqui é o Carlos, placa ABC1D23. Estourou o pneu na BR-116 km 230…"
        className="max-h-40 min-h-20 bg-card"
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={pedir}
          aria-disabled={curta || sugestao.isPending}
          className="aria-disabled:opacity-60"
        >
          {sugestao.isPending ? (
            <LogosLoader tamanho={14} decorativo fundo="var(--card)" />
          ) : (
            <Sparkles aria-hidden />
          )}
          {sugestao.isPending ? 'Lendo a mensagem…' : 'Preencher com IA'}
        </Button>
        {curta && mensagem.length > 0 && (
          <span className="text-xs text-texto-3">Cole a mensagem inteira (mín. {MINIMO} caracteres).</span>
        )}
      </div>
      <div role="status" className="text-[13px]">
        {sugestao.isSuccess && !sugestao.isPending && (
          <p className="text-texto-2">
            <strong className="font-semibold text-foreground">Sugestão da IA: confira os campos.</strong>{' '}
            Criticidade {ROTULO_CRITICIDADE[sugestao.data.criticidade]}
            {sugestao.data.justificativa ? `: ${sugestao.data.justificativa}` : '.'}
          </p>
        )}
      </div>
      {erro && (
        <p role="alert" className="flex items-start gap-1.5 text-[13px] text-erro-texto">
          <CircleAlert aria-hidden className="mt-px size-4 flex-none" />
          {erro}
        </p>
      )}
    </section>
  )
}
