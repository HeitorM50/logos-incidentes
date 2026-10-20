import { Check, CircleAlert, UserRoundCog } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ehErroApi } from '@/api/erros'
import { obterVeiculo } from '@/api/incidentes'
import { REGRAS } from '@/api/regras'
import { ROTULO_CATEGORIA, ROTULO_CRITICIDADE } from '@/api/rotulos'
import { CATEGORIAS, CRITICIDADES, type AnalistaResumo, type Incidente } from '@/api/tipos'
import { LogosLoader } from '@/components/LogosLoader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { formatarTelefone } from '@/lib/telefone'
import { useValorAtrasado } from '@/lib/useValorAtrasado'
import { cn } from '@/lib/utils'
import {
  alteracoes,
  CAMPOS,
  camposDiferentes,
  errosDaApi,
  FORMULARIO_VAZIO,
  LIMITES,
  motivoEdicao,
  paraNovo,
  ROTULO_CAMPO,
  validar,
  valoresDe,
  type Campo,
  type ErrosFormulario,
  type ValoresFormulario,
} from './formulario'
import { IconeCriticidade } from './Icones'
import { useCrudIncidente } from './useCrudIncidente'

export type ModoPainel = { tipo: 'criar' } | { tipo: 'editar'; id: number }

export interface Concluido {
  texto: string
  id: number
  /** Incidente novo: o aviso oferece mostrá-lo na lista. */
  criado?: boolean
}

interface Props {
  /** null fecha o painel. Um objeto novo a cada abertura limpa o formulário. */
  modo: ModoPainel | null
  /** A lista atual (com o que a leitura de 5 s trouxe): mostra se outra pessoa mudou algo. */
  itens: Incidente[] | undefined
  analista: AnalistaResumo
  aoFechar: () => void
  aoConcluir: (concluido: Concluido) => void
  /** Para onde vai o foco se o botão que abriu o painel saiu da tela. */
  aoFocarDepois: () => void
}

const SELO_MARCADO = {
  alta: 'has-checked:bg-alta-fundo has-checked:text-alta-texto has-checked:border-alta-borda has-checked:font-bold',
  media:
    'has-checked:bg-media-fundo has-checked:text-media-texto has-checked:border-media-borda has-checked:font-semibold',
  baixa: 'has-checked:bg-baixa-fundo has-checked:text-baixa-texto has-checked:border-baixa-borda',
} as const

const SELECT =
  'h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20'

/**
 * Painel lateral para criar e editar incidentes. O protótipo não desenha formulário: o painel
 * usa os mesmos tokens da triagem. Status e responsável continuam nas ações da linha.
 */
export function PainelIncidente({ modo, aoFocarDepois, ...resto }: Props) {
  // As mutações ficam aqui, e não no formulário: o painel não fecha durante o envio, e o
  // resultado (sucesso ou erro) sempre chega a um formulário montado.
  const crud = useCrudIncidente()
  const pendente = crud.criar.isPending || crud.editar.isPending
  const sujo = useRef(false)
  const [pedirDescarte, setPedirDescarte] = useState(false)

  // Guarda o último modo: na animação de saída o conteúdo continua na tela.
  const [aberto, setAberto] = useState<{ modo: ModoPainel | null; chave: number }>({
    modo: null,
    chave: 0,
  })
  if (modo !== null && modo !== aberto.modo) {
    setAberto({ modo, chave: aberto.chave + 1 })
    setPedirDescarte(false)
  }
  const exibido = modo ?? aberto.modo
  // O painel abre sem SheetTrigger, e o Radix devolveria o foco ao body: guarda quem abriu.
  const quemAbriu = useRef<HTMLElement | null>(null)

  /** Esc, X e Cancelar: com algo digitado, pergunta antes de descartar. */
  function pedirFechar() {
    if (pendente) return
    if (sujo.current) setPedirDescarte(true)
    else resto.aoFechar()
  }

  return (
    <Sheet open={modo !== null} onOpenChange={(abrir) => !abrir && pedirFechar()}>
      {exibido && (
        <SheetContent
          side="right"
          // Um clique fora não apaga o que foi digitado: fechar só por Esc, X ou Cancelar.
          onInteractOutside={(evento) => evento.preventDefault()}
          onOpenAutoFocus={() => {
            quemAbriu.current = document.activeElement as HTMLElement | null
          }}
          onCloseAutoFocus={(evento) => {
            evento.preventDefault()
            if (quemAbriu.current?.isConnected) quemAbriu.current.focus()
            else aoFocarDepois()
          }}
          className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[480px]"
        >
          <Formulario
            key={aberto.chave}
            modo={exibido}
            crud={crud}
            pedirFechar={pedirFechar}
            pedirDescarte={pedirDescarte}
            aoContinuar={() => setPedirDescarte(false)}
            aoMudarSujo={(valor) => {
              sujo.current = valor
            }}
            {...resto}
          />
        </SheetContent>
      )}
    </Sheet>
  )
}

type Alvo = Campo | 'geral' | 'aviso' | 'continuar'

interface PropsFormulario extends Omit<Props, 'modo' | 'aoFocarDepois'> {
  modo: ModoPainel
  crud: ReturnType<typeof useCrudIncidente>
  pedirFechar: () => void
  pedirDescarte: boolean
  aoContinuar: () => void
  aoMudarSujo: (sujo: boolean) => void
}

function Formulario({
  modo,
  itens,
  analista,
  aoFechar,
  aoConcluir,
  crud,
  pedirFechar,
  pedirDescarte,
  aoContinuar,
  aoMudarSujo,
}: PropsFormulario) {
  const { criar, editar } = crud
  const editando = modo.tipo === 'editar'
  const atual = editando ? itens?.find((item) => item.id === modo.id) : undefined

  // Versão que o formulário tomou como base: o PATCH envia a versão dela.
  const [base, setBase] = useState<Incidente | undefined>(atual)
  const [valores, setValores] = useState<ValoresFormulario>(() =>
    atual ? valoresDe(atual) : FORMULARIO_VAZIO,
  )
  const [erros, setErros] = useState<ErrosFormulario>({})
  const [tentou, setTentou] = useState(false)
  const [geral, setGeral] = useState<string | null>(null)
  const [foco, setFoco] = useState<{ alvo: Alvo } | null>(null)

  // Salvou: o botão mostra "✓ Salvo" por meio segundo e só então o painel fecha (o analista
  // vê a confirmação no lugar onde clicou). Com menos movimento, fecha na hora.
  const [salvo, setSalvo] = useState(false)
  const conclusao = useRef<{ timer: ReturnType<typeof setTimeout>; concluir: () => void } | null>(
    null,
  )
  function concluirComConfirmacao(concluido: Concluido) {
    setSalvo(true)
    const semMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const concluir = () => {
      conclusao.current = null
      aoConcluir(concluido)
    }
    conclusao.current = { timer: setTimeout(concluir, semMovimento ? 0 : 500), concluir }
  }
  // Painel fechado durante o "Salvo" (Esc, X, saída): conclui na hora, sem perder o aviso.
  useEffect(
    () => () => {
      const pendente = conclusao.current
      if (!pendente) return
      clearTimeout(pendente.timer)
      pendente.concluir()
    },
    [],
  )

  const refs = useRef<Partial<Record<Alvo, HTMLElement | null>>>({})
  const prefixo = useId()

  // Outra pessoa mudou só status ou responsável: nenhum campo do formulário muda, então a base
  // avança sozinha. Se mudou um campo do formulário, o analista decide (aviso abaixo).
  if (atual && base && atual.versao > base.versao && camposDiferentes(base, atual).length === 0) {
    setBase(atual)
  }

  useEffect(() => {
    if (foco) refs.current[foco.alvo]?.focus()
  }, [foco])

  const removido = editando && itens !== undefined && !atual
  const motivo = atual ? motivoEdicao(atual, analista.id) : null
  const mudouFora = atual && base && atual.versao > base.versao ? camposDiferentes(base, atual) : []
  const minhas = base ? (Object.keys(alteracoes(base, valores)) as Campo[]) : []
  const pendente = criar.isPending || editar.isPending
  const bloqueado = removido || motivo !== null || mudouFora.length > 0
  const sujo = editando ? minhas.length > 0 : CAMPOS.some((c) => valores[c] !== FORMULARIO_VAZIO[c])

  // Já salvo: nada a descartar (Esc fecha direto, sem a pergunta de descarte).
  useEffect(() => aoMudarSujo(sujo && !salvo), [sujo, salvo, aoMudarSujo])
  useEffect(() => {
    if (pedirDescarte) refs.current.continuar?.focus()
  }, [pedirDescarte])

  function mudar<C extends keyof ValoresFormulario>(campo: C, valor: ValoresFormulario[C]) {
    const novos = { ...valores, [campo]: valor }
    setValores(novos)
    // Depois da primeira tentativa, o erro some assim que o campo fica certo.
    if (tentou) setErros(validar(novos))
  }

  function falhou(erro: unknown) {
    if (ehErroApi(erro) && erro.codigo === 'nao_encontrado') {
      setFoco({ alvo: 'aviso' })
      return
    }
    if (ehErroApi(erro) && erro.ehConflito) {
      // A lista já recebeu a versão atual. Se mudou um campo do formulário (ou a regra deixou de
      // permitir a edição), o aviso do topo explica; se mudou só status ou responsável, a base
      // avança sozinha e basta salvar de novo.
      const novo = erro.atual
      const temAviso =
        novo !== null &&
        base !== undefined &&
        (camposDiferentes(base, novo).length > 0 || motivoEdicao(novo, analista.id) !== null)
      setGeral(
        temAviso
          ? 'Não foi salvo: o incidente mudou antes. Confira o aviso acima.'
          : 'Não foi salvo: o status ou o responsável mudou antes. Seus dados continuam aqui; salve de novo.',
      )
      setFoco({ alvo: 'geral' })
      return
    }
    const { campos, geral: mensagem } = errosDaApi(erro)
    setErros(campos)
    setGeral(mensagem)
    const primeiro = CAMPOS.find((campo) => campos[campo])
    setFoco({ alvo: primeiro ?? 'geral' })
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (pendente || salvo) return
    // O botão continua focável quando bloqueado: o clique leva ao aviso que explica o motivo.
    if (bloqueado) {
      setFoco({ alvo: 'aviso' })
      return
    }
    setTentou(true)
    setGeral(null)
    const encontrados = validar(valores)
    setErros(encontrados)
    const primeiro = CAMPOS.find((campo) => encontrados[campo])
    // Dado inválido não sai do navegador.
    if (primeiro) {
      setFoco({ alvo: primeiro })
      return
    }
    if (!editando) {
      criar.mutate(paraNovo(valores), {
        onSuccess: (novo) =>
          concluirComConfirmacao({
            texto: `Incidente #${novo.id} criado.`,
            id: novo.id,
            criado: true,
          }),
        onError: falhou,
      })
      return
    }
    if (!base) return
    const mudou = alteracoes(base, valores)
    if (Object.keys(mudou).length === 0) {
      setGeral('Nada mudou. Altere um campo ou feche o painel.')
      setFoco({ alvo: 'geral' })
      return
    }
    editar.mutate(
      { base, mudou },
      {
        onSuccess: (novo) =>
          concluirComConfirmacao({ texto: `Incidente #${novo.id} salvo.`, id: novo.id }),
        onError: falhou,
      },
    )
  }

  /** Descarta o que o analista digitou e carrega a versão atual. */
  function usarAtual() {
    if (!atual) return
    setBase(atual)
    setValores(valoresDe(atual))
    setErros({})
    setGeral(null)
    setFoco({ alvo: 'titulo' })
  }

  /** Aplica só os campos que o analista mudou sobre a versão atual. */
  function manterMinhas() {
    if (!atual) return
    const daVersaoAtual = valoresDe(atual)
    const mesclados = { ...daVersaoAtual }
    for (const campo of minhas) Object.assign(mesclados, { [campo]: valores[campo] })
    setBase(atual)
    setValores(mesclados)
    setErros(tentou ? validar(mesclados) : {})
    setGeral(null)
    setFoco({ alvo: 'titulo' })
  }

  const id = (campo: Campo) => `${prefixo}-${campo}`
  const aria = (campo: Campo, dica?: boolean, obrigatorio?: boolean) => ({
    id: id(campo),
    'aria-required': obrigatorio || undefined,
    'aria-invalid': erros[campo] ? true : undefined,
    'aria-describedby':
      [erros[campo] && `${id(campo)}-erro`, dica && `${id(campo)}-dica`]
        .filter(Boolean)
        .join(' ') || undefined,
  })
  const guardar = (alvo: Alvo) => (elemento: HTMLElement | null) => {
    refs.current[alvo] = elemento
  }

  let aviso: ReactNode = null
  if (removido) {
    aviso = (
      <Aviso tom="erro" titulo="Este incidente não existe mais">
        Outro analista o removeu. Não há o que salvar; feche o painel.
      </Aviso>
    )
  } else if (motivo) {
    aviso = (
      <Aviso tom="erro" titulo="Não é possível editar agora">
        {motivo}
      </Aviso>
    )
  } else if (atual && mudouFora.length > 0) {
    const autor = atual.atualizado_por
    const quem = !autor
      ? 'Outro analista'
      : autor.id === analista.id
        ? 'Você (em outra janela)'
        : autor.nome
    const emComum = mudouFora.filter((campo) => minhas.includes(campo))
    const lista = (campos: Campo[]) => campos.map((c) => ROTULO_CAMPO[c]).join(', ')
    aviso = (
      <Aviso
        tom="info"
        titulo={`${quem} alterou este incidente depois que você abriu o painel`}
        acoes={
          <>
            <Button type="button" size="sm" onClick={usarAtual}>
              Usar a versão atual
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={manterMinhas}>
              Manter minhas mudanças
            </Button>
          </>
        }
      >
        Campos alterados: {lista(mudouFora)}.{' '}
        {emComum.length > 0
          ? `Você também mudou ${lista(emComum)}: se mantiver, a sua versão prevalece.`
          : 'Suas mudanças não tocam nesses campos.'}{' '}
        Escolha como continuar antes de salvar.
      </Aviso>
    )
  }

  const titulo = editando ? `Editar incidente #${modo.id}` : 'Novo incidente'

  return (
    <form noValidate onSubmit={enviar} aria-busy={pendente} className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="border-b px-5 py-4 pr-12">
        <SheetTitle className="text-lg font-semibold">{titulo}</SheetTitle>
        <SheetDescription className="text-texto-2">
          {editando
            ? 'Só os campos que você mudar são enviados. Status e responsável mudam pela lista.'
            : 'O incidente entra na lista como Aberto, sem responsável.'}{' '}
          Campos com * são obrigatórios.
        </SheetDescription>
      </SheetHeader>

      {/* Os campos entram em cascata logo depois do painel deslizar. */}
      <div className="flex min-h-0 flex-1 cascata flex-col gap-4 overflow-y-auto px-5 py-4 [--cascata-inicio:120ms] [--cascata-passo:30ms]">
        {/* Sempre montado: o aviso pode surgir com o painel aberto (leitura de 5 s), e uma
            região viva criada já com conteúdo nem sempre é anunciada. Vazio, o -mb-4 anula o
            espaço entre os campos. */}
        <div
          ref={guardar('aviso')}
          tabIndex={-1}
          role="status"
          className={cn('outline-none', !aviso && '-mb-4')}
        >
          {aviso}
        </div>

        <CampoRotulado id={id('titulo')} rotulo="Título" obrigatorio erro={erros.titulo}>
          <Input
            ref={guardar('titulo')}
            {...aria('titulo', false, true)}
            value={valores.titulo}
            onChange={(e) => mudar('titulo', e.target.value)}
            maxLength={LIMITES.titulo}
            autoComplete="off"
            className="h-9"
          />
        </CampoRotulado>

        <CampoRotulado id={id('categoria')} rotulo="Categoria" obrigatorio erro={erros.categoria}>
          <select
            ref={guardar('categoria')}
            {...aria('categoria', false, true)}
            value={valores.categoria}
            onChange={(e) => mudar('categoria', e.target.value as ValoresFormulario['categoria'])}
            className={SELECT}
          >
            <option value="" disabled>
              Escolha a categoria
            </option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {ROTULO_CATEGORIA[c]}
              </option>
            ))}
          </select>
        </CampoRotulado>

        <fieldset
          aria-describedby={erros.criticidade ? `${id('criticidade')}-erro` : undefined}
          className="flex flex-col gap-1.5"
        >
          <legend className="mb-1.5 text-sm font-medium">
            Criticidade <span aria-hidden>*</span>
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {CRITICIDADES.map((c, i) => (
              <label
                key={c}
                className={cn(
                  'flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-borda-forte bg-card text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                  SELO_MARCADO[c],
                  erros.criticidade && 'border-destructive',
                )}
              >
                <input
                  ref={i === 0 ? guardar('criticidade') : undefined}
                  type="radio"
                  name={`${prefixo}-criticidade`}
                  value={c}
                  checked={valores.criticidade === c}
                  onChange={() => mudar('criticidade', c)}
                  aria-invalid={erros.criticidade ? true : undefined}
                  // No rádio, e não só no fieldset: nem todo leitor de tela lê a descrição do grupo.
                  aria-describedby={erros.criticidade ? `${id('criticidade')}-erro` : undefined}
                  required
                  className="sr-only"
                />
                <IconeCriticidade criticidade={c} />
                {ROTULO_CRITICIDADE[c]}
              </label>
            ))}
          </div>
          <MensagemErro id={`${id('criticidade')}-erro`} texto={erros.criticidade} />
        </fieldset>

        <CampoRotulado id={id('local')} rotulo="Local" obrigatorio erro={erros.local}>
          <Input
            ref={guardar('local')}
            {...aria('local', false, true)}
            value={valores.local}
            onChange={(e) => mudar('local', e.target.value)}
            maxLength={LIMITES.local}
            placeholder="Rodovia, km e cidade"
            autoComplete="off"
            className="h-9"
          />
        </CampoRotulado>

        <CampoRotulado
          id={id('placa')}
          rotulo="Placa do caminhão"
          dica="Opcional. Formato ABC1234 ou ABC1D23."
          erro={erros.placa}
        >
          <Input
            ref={guardar('placa')}
            {...aria('placa', true)}
            value={valores.placa}
            onChange={(e) => mudar('placa', e.target.value)}
            maxLength={12}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="h-9 max-w-[200px] font-mono uppercase"
          />
        </CampoRotulado>

        <fieldset className="flex flex-col gap-3 rounded-md border px-3 pt-1 pb-3">
          <legend className="px-1 text-sm font-medium">Motorista</legend>
          {!editando && <AvisoCadastro placa={valores.placa} contato={valores} />}
          <CampoRotulado
            id={id('motorista_nome')}
            rotulo="Nome"
            erro={erros.motorista_nome}
          >
            <Input
              ref={guardar('motorista_nome')}
              {...aria('motorista_nome')}
              value={valores.motorista_nome}
              onChange={(e) => mudar('motorista_nome', e.target.value)}
              maxLength={LIMITES.motoristaNome}
              autoComplete="off"
              className="h-9"
            />
          </CampoRotulado>
          <CampoRotulado
            id={id('motorista_telefone')}
            rotulo="Telefone"
            dica="DDD + número, ex.: (11) 98765-4321."
            erro={erros.motorista_telefone}
          >
            <Input
              ref={guardar('motorista_telefone')}
              {...aria('motorista_telefone', true)}
              value={valores.motorista_telefone}
              onChange={(e) => mudar('motorista_telefone', e.target.value)}
              maxLength={20}
              inputMode="tel"
              autoComplete="off"
              className="h-9 max-w-[220px] font-mono"
            />
          </CampoRotulado>
        </fieldset>

        <CampoRotulado
          id={id('descricao')}
          rotulo="Descrição"
          dica={`Opcional. Até ${LIMITES.descricao} caracteres.`}
          erro={erros.descricao}
          extra={
            <span aria-hidden className="font-mono text-xs text-texto-3">
              {valores.descricao.length}/{LIMITES.descricao}
            </span>
          }
        >
          <Textarea
            ref={guardar('descricao')}
            {...aria('descricao', true)}
            value={valores.descricao}
            onChange={(e) => mudar('descricao', e.target.value)}
            maxLength={LIMITES.descricao}
            rows={4}
            className="max-h-60 min-h-24"
          />
        </CampoRotulado>

        {geral && (
          <div
            ref={guardar('geral')}
            tabIndex={-1}
            role="alert"
            className="flex items-start gap-2 rounded-md border border-erro-borda bg-erro-fundo px-3 py-2.5 text-[13px] text-erro-texto outline-none"
          >
            <CircleAlert aria-hidden className="mt-px size-4 flex-none" />
            {geral}
          </div>
        )}
      </div>

      {pedirDescarte ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t bg-superficie-2 px-5 py-3"
        >
          <span className="mr-auto text-sm font-medium">Descartar o que você digitou?</span>
          <Button
            ref={guardar('continuar')}
            type="button"
            variant="outline"
            onClick={() => {
              aoContinuar()
              setFoco({ alvo: 'titulo' })
            }}
            className="h-9"
          >
            Continuar editando
          </Button>
          <Button type="button" variant="destructive" onClick={aoFechar} className="h-9">
            Descartar
          </Button>
        </div>
      ) : (
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={pedirFechar}
            aria-disabled={pendente || undefined}
            className="h-9"
          >
            Cancelar
          </Button>
          {/* aria-disabled, e não disabled: se a leitura de 5 s bloquear o botão com o foco
              nele, o foco não cai no body. O motivo está no aviso do topo. */}
          <Button
            type="submit"
            aria-disabled={bloqueado || pendente || undefined}
            className="h-9 min-w-[150px] aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          >
            {salvo ? (
              <span className="flex animate-in items-center gap-1.5 duration-200 zoom-in-95 fade-in-0">
                <Check aria-hidden className="size-4" strokeWidth={3} />
                Salvo
              </span>
            ) : pendente ? (
              <>
                <LogosLoader tamanho={16} decorativo fundo="var(--primary)" />
                Salvando…
              </>
            ) : editando ? (
              'Salvar alterações'
            ) : (
              'Criar incidente'
            )}
          </Button>
        </div>
      )}
    </form>
  )
}

/**
 * Ao criar, com uma placa válida e o contato em branco, diz o que a API vai fazer: copiar o
 * motorista atual do cadastro da frota. O analista vê o contato antes de salvar.
 */
function AvisoCadastro({
  placa,
  contato,
}: {
  placa: string
  contato: { motorista_nome: string; motorista_telefone: string }
}) {
  const normalizada = placa.replace(/[-\s]/g, '').toUpperCase()
  // Espera a digitação parar: sem isto, cada letra da placa seria uma consulta.
  const consultada = useValorAtrasado(normalizada, 400)
  const valida = REGRAS.padraoPlaca.test(consultada)
  const consulta = useQuery({
    queryKey: ['veiculo', consultada],
    queryFn: ({ signal }) => obterVeiculo(consultada, signal),
    enabled: valida,
    staleTime: 60_000,
    retry: false,
  })
  const emBranco = !contato.motorista_nome.trim() && !contato.motorista_telefone.trim()
  if (!valida || !emBranco || consultada !== normalizada || !consulta.isSuccess) {
    return (
      <p className="text-xs text-texto-3">
        Opcional. Em branco, o Logos copia o motorista atual do caminhão no cadastro da frota.
      </p>
    )
  }
  const veiculo = consulta.data
  return (
    <p role="status" className="text-xs text-texto-2">
      {veiculo?.motorista ? (
        <>
          Em branco, o Logos usa o motorista atual do {veiculo.placa} ({veiculo.modelo}):{' '}
          <strong className="font-semibold text-foreground">{veiculo.motorista.nome}</strong>,{' '}
          <span className="font-mono">{formatarTelefone(veiculo.motorista.telefone)}</span>.
        </>
      ) : veiculo ? (
        <>O {veiculo.placa} está no pátio, sem motorista escalado. Informe o contato, se tiver.</>
      ) : (
        <>Placa fora do cadastro da frota. Informe o contato, se tiver.</>
      )}
    </p>
  )
}

function CampoRotulado({
  id,
  rotulo,
  obrigatorio,
  dica,
  erro,
  extra,
  children,
}: {
  id: string
  rotulo: string
  obrigatorio?: boolean
  dica?: string
  erro?: string
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {rotulo} {obrigatorio && <span aria-hidden>*</span>}
        </label>
        {extra}
      </div>
      {children}
      {dica && (
        <p id={`${id}-dica`} className="text-xs text-texto-3">
          {dica}
        </p>
      )}
      <MensagemErro id={`${id}-erro`} texto={erro} />
    </div>
  )
}

function MensagemErro({ id, texto }: { id: string; texto?: string }) {
  if (!texto) return null
  return (
    <p id={id} className="flex items-center gap-1.5 text-xs font-medium text-erro-texto">
      <CircleAlert aria-hidden className="size-3.5 flex-none" />
      {texto}
    </p>
  )
}

function Aviso({
  tom,
  titulo,
  acoes,
  children,
}: {
  tom: 'info' | 'erro'
  titulo: string
  acoes?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border px-3 py-2.5 text-[13px] leading-[1.45]',
        tom === 'info'
          ? 'border-info-borda bg-info-fundo text-info-texto'
          : 'border-erro-borda bg-erro-fundo text-erro-texto',
      )}
    >
      <div className="flex items-start gap-2">
        {tom === 'info' ? (
          <UserRoundCog aria-hidden className="mt-px size-4 flex-none" />
        ) : (
          <CircleAlert aria-hidden className="mt-px size-4 flex-none" />
        )}
        <div className="flex flex-col gap-0.5">
          <strong className="text-sm font-semibold">{titulo}</strong>
          <span>{children}</span>
        </div>
      </div>
      {acoes && <div className="flex flex-wrap gap-2 pl-6">{acoes}</div>}
    </div>
  )
}
