import { ChartNoAxesColumn, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ehErroApi } from '@/api/erros'
import type { AnalistaLogado, Incidente } from '@/api/tipos'
import { Button } from '@/components/ui/button'
import { PainelRelatorio } from '@/features/relatorio/PainelRelatorio'
import { useAgora } from '@/lib/useAgora'
import { useSegundosAguardando } from '@/lib/useSegundosAguardando'
import { useValorAtrasado } from '@/lib/useValorAtrasado'
import { AvisoAltaNova, AvisoDesfazer, AvisoSucesso, PilhaAvisos } from './Avisos'
import { AvisoReconectado, BannerReconexao } from './BannerReconexao'
import { BarraStatus } from './BarraStatus'
import { CabecalhoTriagem } from './CabecalhoTriagem'
import { CampoBusca, ID_CAMPO_BUSCA } from './CampoBusca'
import { CartoesCriticidade } from './CartoesCriticidade'
import { ConfirmarRemocao } from './ConfirmarRemocao'
import { FiltroCategorias } from './FiltroCategorias'
import { DicaPrimeiroAcesso, GuiaTriagem } from './GuiaTriagem'
import {
  alternar,
  descreverFiltros,
  filtrarIncidentes,
  SEM_FILTROS,
  type ResultadoFiltro,
  type Situacao,
  temFiltro,
} from './filtros'
import { PainelIncidente, type Concluido, type ModoPainel } from './PainelIncidente'
import { PainelAcordando, PainelErro, PainelVazio, PainelVazioFiltro } from './PainelEstado'
import { resumirTriagem } from './resumo'
import { SeletorSituacao } from './SeletorSituacao'
import { TabelaCarregando, TabelaIncidentes } from './TabelaIncidentes'
import { definirFiltros, useFiltros } from './useFiltros'
import { useAcoesIncidente } from './useAcoesIncidente'
import { useAltaNova } from './useAltaNova'
import { useGuia } from './useGuia'
import { estadoDaConexao, useIncidentes } from './useIncidentes'

// Uma leitura normal leva menos de 1 s. Acima disto, o servidor do Render está acordando.
const ESPERA_NORMAL_S = 3
const ATRASO_ANUNCIO_MS = 700
const DURACAO_SUCESSO_MS = 8000
const ID_TITULO = 'titulo-triagem'
const TITULO_DA_ABA = 'Logos — Central de Incidentes'

function mensagemFalhaLista(erro: unknown): string {
  if (!erro) return 'Sem conexão com o servidor. Confira a internet e tente de novo.'
  if (ehErroApi(erro)) {
    if (erro.codigo === 'sem_conexao') {
      return 'Sem conexão com o servidor. Confira a internet e tente de novo.'
    }
    if (erro.ehTransitorio) {
      return `O servidor não respondeu a tempo (erro ${erro.status}). Nenhum dado foi alterado.`
    }
    return `O servidor recusou a leitura (erro ${erro.status}). Nenhum dado foi alterado.`
  }
  return 'Erro inesperado. Nenhum dado foi alterado.'
}

/** Troca de estado da tabela (carregando, lista, vazio, erro) com entrada suave. */
function Entrada({ children }: { children: ReactNode }) {
  return <div className="h-full animate-in duration-200 fade-in-0">{children}</div>
}

const PALAVRA_SITUACAO: Record<Situacao, [string, string]> = {
  ativos: ['incidente ativo', 'incidentes ativos'],
  fechados: ['incidente fechado', 'incidentes fechados'],
  todos: ['incidente', 'incidentes'],
}

/**
 * "Mostrando 31 de 94 incidentes ativos (filtrado)". Em "Todos", os cartões contam só ativos e
 * a lista traz também os fechados, no fim: o aviso explica a diferença. Em "Ativos", uma busca
 * que só acha fechados diz que eles existem (estão em "Fechados").
 */
function textoMostrando(
  resultado: ResultadoFiltro,
  situacao: Situacao,
  total: number,
  filtrando: boolean,
): string {
  const [singular, plural] = PALAVRA_SITUACAO[situacao]
  const texto = `Mostrando ${resultado.itens.length} de ${total} ${total === 1 ? singular : plural}`
  const extras: string[] = []
  if (situacao === 'todos') {
    const fechados = resultado.itens.filter((i) => i.status === 'fechado').length
    if (fechados) extras.push(`${fechados} ${fechados === 1 ? 'fechado' : 'fechados'} no fim da lista`)
  }
  if (situacao === 'ativos' && filtrando && resultado.fechadosOcultos) {
    const n = resultado.fechadosOcultos
    extras.push(`${n} ${n === 1 ? 'fechado' : 'fechados'} em "Fechados"`)
  }
  return [filtrando ? `${texto} (filtrado)` : texto, ...extras].join(' · ')
}

interface Props {
  analista: AnalistaLogado
  aoSair: () => void
}

export function TelaTriagem({ analista, aoSair }: Props) {
  const consulta = useIncidentes()
  const agora = useAgora(30_000)
  const estado = estadoDaConexao(consulta)
  const acoes = useAcoesIncidente(analista)
  const confirmados = consulta.data?.itens
  // Ações em andamento aparecem por cima da lista confirmada (contadores incluídos).
  const { sobrepor } = acoes
  const itens = useMemo(() => confirmados && sobrepor(confirmados), [confirmados, sobrepor])
  // Queda e volta da conexão: quando a lista volta a ficar ao vivo, avisa por alguns segundos.
  const [conexao, setConexao] = useState({ estado, reconectou: false })
  if (estado !== conexao.estado) {
    const caiu = conexao.estado === 'reconectando' || conexao.estado === 'sem_conexao'
    setConexao({ estado, reconectou: estado === 'ao_vivo' && caiu })
  }
  const reconectou = conexao.reconectou
  useEffect(() => {
    if (!reconectou) return
    const id = setTimeout(() => setConexao((atual) => ({ ...atual, reconectou: false })), 2_500)
    return () => clearTimeout(id)
  }, [reconectou])

  const altaNova = useAltaNova(confirmados, analista.id, TITULO_DA_ABA)
  const guia = useGuia()
  const resumo = useMemo(() => (itens ? resumirTriagem(itens, agora) : null), [itens, agora])

  const filtros = useFiltros()
  const filtrando = temFiltro(filtros)
  // Incidentes por placa (ativos e fechados), para "Mesma placa" nos detalhes: problema
  // recorrente no mesmo caminhão indica manutenção a fazer.
  const porPlaca = useMemo(() => {
    const mapa = new Map<string, Incidente[]>()
    for (const i of itens ?? []) {
      if (i.placa) mapa.set(i.placa, [...(mapa.get(i.placa) ?? []), i])
    }
    return mapa
  }, [itens])
  const resultado = useMemo(
    () => (itens ? filtrarIncidentes(itens, filtros, analista.id, agora) : null),
    // agora: um incidente passa a atrasado com o tempo, sem nova leitura.
    [itens, filtros, analista.id, agora],
  )
  // Os cartões respeitam a categoria e a busca, mas não o próprio filtro de criticidade:
  // assim o analista vê quantos incidentes cada cartão traria ao ser escolhido.
  const porCriticidade = useMemo(
    () =>
      resultado ? resumirTriagem(resultado.semFiltroDeCriticidade, agora).porCriticidade : null,
    [resultado, agora],
  )
  function limparFiltros() {
    definirFiltros(() => SEM_FILTROS)
    // O botão clicado some junto com os filtros: o foco vai para a busca, e não para o topo
    // da página.
    document.getElementById(ID_CAMPO_BUSCA)?.focus()
  }

  const [painel, setPainel] = useState<ModoPainel | null>(null)
  const [relatorioAberto, setRelatorioAberto] = useState(false)
  const [removendo, setRemovendo] = useState<Incidente | null>(null)
  const [sucesso, setSucesso] = useState<(Concluido & { chave: number }) | null>(null)
  // O aviso de sucesso para de contar enquanto o mouse ou o foco estão nele.
  const [sucessoParado, setSucessoParado] = useState(false)

  useEffect(() => {
    if (!sucesso || sucessoParado) return
    const id = setTimeout(() => setSucesso(null), DURACAO_SUCESSO_MS)
    return () => clearTimeout(id)
  }, [sucesso, sucessoParado])

  function concluir(concluido: Concluido) {
    setPainel(null)
    setRemovendo(null)
    setSucessoParado(false)
    setSucesso({ ...concluido, chave: Date.now() })
  }

  // "Desfazer" só vale enquanto o incidente está na versão que a ação gerou: se alguém mudou
  // depois (outro analista, outra janela), desfazer apagaria essa mudança sem ninguém ver.
  // Também fica escondido enquanto outra ação do mesmo incidente está em voo.
  const desfazivel = (() => {
    const ultima = acoes.ultima
    const incidente = ultima && confirmados?.find((i) => i.id === ultima.id)
    if (!ultima || !incidente || acoes.pendentes.has(ultima.id)) return null
    return incidente.versao === ultima.versao ? { ultima, incidente } : null
  })()

  // Versão mudou ou o incidente sumiu: o desfazer não volta a valer, então sai da memória.
  const ultimaVelha =
    !!acoes.ultima &&
    !!confirmados &&
    confirmados.find((i) => i.id === acoes.ultima!.id)?.versao !== acoes.ultima.versao
  const { dispensarUltima } = acoes
  useEffect(() => {
    if (ultimaVelha) dispensarUltima()
  }, [ultimaVelha, dispensarUltima])

  /** Foco depois do aviso de desfazer sumir: a linha do incidente, ou o título. */
  function focarLinhaOuTitulo(id: number) {
    const botao = document.querySelector<HTMLElement>(
      `[data-incidente="${id}"] button[data-alternar-detalhes]`,
    )
    if (botao) botao.focus()
    else focarTitulo()
  }

  function desfazerAgora() {
    if (!desfazivel) return
    focarLinhaOuTitulo(desfazivel.incidente.id)
    void acoes.desfazer(desfazivel.incidente)
  }

  // Ctrl+Z (⌘Z) desfaz de qualquer lugar e Esc fecha o aviso, enquanto ele estiver na tela:
  // sem isso, quem usa teclado teria de atravessar a lista com Tab em 6 s (WCAG 2.2.1).
  const desfazerRef = useRef(desfazerAgora)
  desfazerRef.current = desfazerAgora
  const idDesfazivel = desfazivel?.incidente.id
  useEffect(() => {
    if (idDesfazivel === undefined) return
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.defaultPrevented || evento.isComposing) return
      if (document.querySelector('[aria-modal="true"]')) return
      const alvo = evento.target as HTMLElement | null
      const digitando =
        alvo?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo?.tagName ?? '')
      if (digitando) return
      const ctrlZ =
        (evento.ctrlKey || evento.metaKey) &&
        !evento.shiftKey &&
        !evento.altKey &&
        evento.key.toLowerCase() === 'z'
      if (ctrlZ) {
        evento.preventDefault()
        desfazerRef.current()
      } else if (evento.key === 'Escape') {
        dispensarUltima()
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [idDesfazivel, dispensarUltima])

  // O botão que abriu o painel ou o diálogo pode ter saído da tela (linha removida ou lista
  // reordenada): o foco vem para o título, e não para o topo da página.
  const focarTitulo = () => document.getElementById(ID_TITULO)?.focus()

  /** "Ver" do aviso de Alta novo: rola até a linha; se um filtro a esconde, busca por ela. */
  function irPara(id: number) {
    const linha = document.querySelector<HTMLElement>(`[data-incidente="${id}"]`)
    if (linha) {
      const semMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      linha.scrollIntoView?.({ block: 'center', behavior: semMovimento ? 'auto' : 'smooth' })
      linha
        .querySelector<HTMLElement>('button[data-alternar-detalhes]')
        ?.focus({ preventScroll: true })
    } else {
      mostrarNaLista(id) // também leva o foco à busca
    }
    // Só depois de mover o foco: o botão "Ver" pode sumir junto com o aviso.
    altaNova.dispensar(id)
  }

  function mostrarNaLista(id: number) {
    // Um fechado só aparece em "Fechados": a busca precisa olhar a situação certa.
    const fechado = itens?.find((i) => i.id === id)?.status === 'fechado'
    definirFiltros(() => ({
      ...SEM_FILTROS,
      situacao: fechado ? 'fechados' : 'ativos',
      busca: `#${id}`,
    }))
    setSucesso(null)
    document.getElementById(ID_CAMPO_BUSCA)?.focus()
  }

  // Durante uma nova tentativa o TanStack apaga `error`: guarda o último para a mensagem
  // do painel não sumir no meio da tentativa.
  const [ultimoErro, setUltimoErro] = useState<unknown>(null)
  if (consulta.error && consulta.error !== ultimoErro) setUltimoErro(consulta.error)

  const segundosAguardando = useSegundosAguardando(estado === 'sincronizando')
  const acordando = segundosAguardando >= ESPERA_NORMAL_S

  const linhaEstado = resultado
    ? textoMostrando(
        resultado,
        filtros.situacao,
        filtros.situacao === 'ativos'
          ? (resumo?.ativos ?? 0)
          : filtros.situacao === 'fechados'
            ? (resumo?.fechados ?? 0)
            : (itens?.length ?? 0),
        filtrando,
      )
    : estado === 'sem_conexao'
      ? 'Falha ao carregar a lista'
      : acordando
        ? 'Aguardando o servidor responder'
        : 'Carregando incidentes…'

  const linhaAnunciada = useValorAtrasado(linhaEstado, ATRASO_ANUNCIO_MS)

  function conteudoDaTabela() {
    if (itens && resultado) {
      if (itens.length === 0) {
        return (
          <Entrada key="vazio">
            <PainelVazio />
          </Entrada>
        )
      }
      if (resultado.itens.length === 0) {
        return (
          <Entrada key="vazio-filtro">
            <PainelVazioFiltro
              descricao={descreverFiltros(filtros)}
              ativos={resumo?.ativos ?? 0}
              aoLimpar={limparFiltros}
            />
          </Entrada>
        )
      }
      return (
        <Entrada key="lista">
          <TabelaIncidentes
            itens={resultado.itens}
            porPlaca={porPlaca}
            aoVerIncidente={mostrarNaLista}
            ehSupervisor={analista.papel === 'supervisor'}
            idAnalista={analista.id}
            agora={agora}
            acoes={acoes}
            semConexao={estado !== 'ao_vivo'}
            aoEditar={(incidente) => setPainel({ tipo: 'editar', id: incidente.id })}
            aoRemover={setRemovendo}
            destaques={altaNova.destaques}
          />
        </Entrada>
      )
    }
    if (estado === 'sem_conexao') {
      return (
        <Entrada key="erro">
          <PainelErro
            mensagem={mensagemFalhaLista(ultimoErro)}
            tentando={consulta.isFetching}
            aoTentar={() => void consulta.refetch()}
          />
        </Entrada>
      )
    }
    return acordando ? (
      <Entrada key="acordando">
        <PainelAcordando segundos={segundosAguardando} />
      </Entrada>
    ) : (
      <TabelaCarregando />
    )
  }

  return (
    <div className="flex min-h-svh flex-col lg:h-svh">
      <CabecalhoTriagem
        analista={analista}
        estado={estado}
        atualizadoEm={consulta.dataUpdatedAt}
        aoSair={aoSair}
        aoAbrirAjuda={guia.abrir}
        busca={
          <CampoBusca
            valor={filtros.busca}
            aoMudar={(busca) => definirFiltros((atuais) => ({ ...atuais, busca }))}
          />
        }
      />
      {reconectou && <AvisoReconectado />}
      {estado === 'reconectando' && (
        <BannerReconexao
          tentativas={consulta.failureCount}
          atualizadoEm={consulta.dataUpdatedAt}
          aoTentarAgora={() => void consulta.refetch()}
        />
      )}

      {/* Primeira pintura em camadas: título → barra → cartões → filtros → tabela (50 ms). */}
      <main className="flex min-h-0 flex-1 cascata flex-col gap-3.5 px-3 pt-5 pb-4 [--cascata-passo:50ms] sm:px-4">
        {guia.mostrarDica && (
          <DicaPrimeiroAcesso aoAbrir={guia.abrir} aoDispensar={guia.dispensarDica} />
        )}
        {/* Título e ações à esquerda; a barra de status à direita (protótipo de 20/10). */}
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 px-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* Focável por código: depois de remover, o foco vem para cá (a linha sumiu). */}
            <h1
              id={ID_TITULO}
              tabIndex={-1}
              className="text-2xl font-semibold tracking-[-0.01em] outline-none"
            >
              Triagem
            </h1>
            {resumo && (
              <span className="text-[13px] text-texto-2">
                {resumo.ativos} incidentes ativos · {resumo.fechados} fechados
              </span>
            )}
            <span className="flex gap-2">
              <Button type="button" size="sm" onClick={() => setPainel({ tipo: 'criar' })}>
                <Plus aria-hidden />
                Novo incidente
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setRelatorioAberto(true)}
                className="bg-pilula"
              >
                <ChartNoAxesColumn aria-hidden />
                Relatório
              </Button>
            </span>
          </div>
          <div className="w-full lg:w-[min(560px,45%)]">
            <BarraStatus porStatus={resumo?.porStatus ?? null} />
          </div>
        </div>
        <CartoesCriticidade
          porCriticidade={porCriticidade}
          selecionadas={filtros.criticidades}
          aoAlternar={(c) =>
            definirFiltros((atuais) => ({
              ...atuais,
              criticidades: alternar(atuais.criticidades, c),
            }))
          }
        />
        <FiltroCategorias
          contagem={resultado?.porCategoria ?? null}
          situacao={filtros.situacao}
          selecionadas={filtros.categorias}
          aoAlternar={(c) =>
            definirFiltros((atuais) => ({ ...atuais, categorias: alternar(atuais.categorias, c) }))
          }
          minhaFila={{
            marcada: filtros.minhaFila,
            contagem: resultado?.naMinhaFila ?? null,
            aoAlternar: () =>
              definirFiltros((atuais) => ({ ...atuais, minhaFila: !atuais.minhaFila })),
          }}
          atrasados={{
            marcada: filtros.atrasados,
            contagem: resultado?.atrasados ?? null,
            aoAlternar: () =>
              definirFiltros((atuais) => ({ ...atuais, atrasados: !atuais.atrasados })),
          }}
          aoLimpar={filtrando ? limparFiltros : undefined}
        />

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[13px]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <SeletorSituacao
              situacao={filtros.situacao}
              contagem={resultado?.porSituacao ?? null}
              aoEscolher={(situacao) => definirFiltros((atuais) => ({ ...atuais, situacao }))}
            />
            <p className="text-texto-2">{linhaEstado}</p>
          </div>
          {/* O leitor de tela ouve a contagem só quando a digitação para: sem isto, cada
              letra da busca geraria um anúncio. */}
          <p role="status" className="sr-only">
            {linhaAnunciada}
          </p>
          <p className="text-texto-3">
            {filtros.situacao === 'fechados'
              ? 'Ordem: fechado mais recente primeiro'
              : filtros.situacao === 'todos'
                ? 'Ordem: criticidade alta primeiro e, dentro dela, o mais antigo · fechados ao fim'
                : 'Ordem: criticidade alta primeiro e, dentro dela, o mais antigo'}
          </p>
        </div>

        {/* No celular, os cartões (bg-card) ficam sobre o fundo da página e ela rola inteira. */}
        <div className="min-h-[360px] flex-1 overflow-auto rounded-[22px] bg-card p-1.5 shadow-cartao max-lg:bg-transparent max-lg:p-0 max-lg:shadow-none">
          {conteudoDaTabela()}
        </div>
      </main>

      {/* Região única para início, fim e conflito das ações. */}
      <p role="status" className="sr-only">
        {acoes.anuncio}
      </p>
      <p role="status" className="sr-only">
        {sucesso?.texto}
      </p>
      <p role="status" className="sr-only">
        {altaNova.anuncio}
      </p>
      {/* A faixa visível de reconexão entra já com texto: o anúncio sai desta região fixa. */}
      <p role="status" className="sr-only">
        {reconectou ? 'Conexão restabelecida. A lista está ao vivo de novo.' : ''}
      </p>
      <GuiaTriagem aberto={guia.aberto} aoMudar={guia.setAberto} />
      <PainelRelatorio
        aberto={relatorioAberto}
        aoMudar={setRelatorioAberto}
        analista={{ id: analista.id, nome: analista.nome }}
      />
      <PainelIncidente
        modo={painel}
        itens={itens}
        analista={analista}
        aoFechar={() => setPainel(null)}
        aoConcluir={concluir}
        aoFocarDepois={focarTitulo}
      />
      <ConfirmarRemocao
        incidente={removendo}
        itens={itens}
        analista={analista}
        aoFechar={() => setRemovendo(null)}
        aoConcluir={concluir}
        aoFocarDepois={focarTitulo}
      />
      <PilhaAvisos
        outros={
          <>
            {altaNova.aviso && (
              <AvisoAltaNova
                aviso={altaNova.aviso}
                aoVer={irPara}
                aoFechar={() => {
                  altaNova.dispensar()
                  focarTitulo()
                }}
              />
            )}
            {desfazivel && (
              <AvisoDesfazer
                key={desfazivel.ultima.chave}
                texto={desfazivel.ultima.texto}
                aoDesfazer={desfazerAgora}
                aoFechar={() => {
                  acoes.dispensarUltima()
                  focarLinhaOuTitulo(desfazivel.incidente.id)
                }}
                aoExpirar={acoes.dispensarUltima}
              />
            )}
            {sucesso && (
              <div
                key={sucesso.chave}
                onMouseEnter={() => setSucessoParado(true)}
                onMouseLeave={() => setSucessoParado(false)}
                onFocus={() => setSucessoParado(true)}
                onBlur={() => setSucessoParado(false)}
              >
                <AvisoSucesso
                  texto={sucesso.texto}
                  acao={
                    sucesso.criado
                      ? {
                          rotulo: 'Mostrar na lista',
                          aoClicar: () => mostrarNaLista(sucesso.id),
                        }
                      : undefined
                  }
                  aoFechar={() => setSucesso(null)}
                />
              </div>
            )}
          </>
        }
        // Aviso de uma versão que já mudou (outro analista agiu, ou a linha sumiu) não vale mais.
        avisos={acoes.avisos.filter(
          (aviso) =>
            aviso.removido ||
            itens?.find((item) => item.id === aviso.id)?.versao === aviso.versao,
        )}
        aoFechar={acoes.fecharAviso}
        aoTentar={(aviso) => {
          const atual = itens?.find((item) => item.id === aviso.id)
          if (atual) acoes.executar(atual, aviso.acao)
        }}
      />
    </div>
  )
}
