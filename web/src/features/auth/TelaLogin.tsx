import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowRight, CircleAlert } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { entrar } from '@/api/auth'
import { verificarSaude } from '@/api/saude'
import type { AnalistaLogado } from '@/api/tipos'
import { BotaoTema } from '@/components/BotaoTema'
import { FundoPontos } from '@/components/FundoPontos'
import { LogosLoader } from '@/components/LogosLoader'
import { cn } from '@/lib/utils'
import { MarcaLogos } from '@/components/MarcaLogos'
import { PainelRotas } from '@/components/PainelRotas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSegundosAguardando } from '@/lib/useSegundosAguardando'
import { mensagemDeErroLogin } from './mensagemDeErroLogin'

// Credenciais do seed da API (api/app/seed). Ficam na tela porque o avaliador precisa
// entrar sem ler o README.
const DEMO = { usuario: 'ana', senha: 'logos2026' }

// Uma resposta normal da API leva menos de 1 s. Acima disto, o servidor está acordando.
const ESPERA_NORMAL_S = 3

interface Props {
  aoEntrar: (analista: AnalistaLogado) => void
}

export function TelaLogin({ aoEntrar }: Props) {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [faltaPreencher, setFaltaPreencher] = useState(false)
  const idErro = useId()

  // Chamada antecipada: o servidor do Render dorme sem uso, e esta chamada começa a
  // acordá-lo enquanto o analista ainda digita.
  const saude = useQuery({
    queryKey: ['saude'],
    queryFn: ({ signal }) => verificarSaude(signal),
  })

  // Erro: o cartão treme uma vez (o texto do erro continua sendo a informação principal).
  const [tremer, setTremer] = useState(false)
  const login = useMutation({
    mutationFn: (credenciais: { usuario: string; senha: string }) =>
      entrar(credenciais.usuario, credenciais.senha),
    onSuccess: aoEntrar,
    onError: () => setTremer(true),
  })

  const segundosAguardando = useSegundosAguardando(saude.isPending || login.isPending)
  const acordando = segundosAguardando >= ESPERA_NORMAL_S

  const mensagemErro = faltaPreencher
    ? 'Preencha o usuário e a senha.'
    : login.isError
      ? mensagemDeErroLogin(login.error)
      : null

  function limparErro() {
    setFaltaPreencher(false)
    if (login.isError) login.reset()
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    // Guarda contra clique duplo: uma tentativa por vez.
    if (login.isPending) return
    if (!usuario.trim() || !senha) {
      setFaltaPreencher(true)
      setTremer(true)
      return
    }
    login.mutate({ usuario: usuario.trim(), senha })
  }

  function preencherDemo() {
    setUsuario(DEMO.usuario)
    setSenha(DEMO.senha)
    limparErro()
  }

  return (
    // Entrada suave ao abrir o app e ao voltar para cá depois de sair. O painel surge primeiro;
    // o cartão vem 200 ms depois, em cascata (título → campos → botão → demonstração).
    // Duas colunas (protótipo de 20/10): à esquerda, o painel da marca com o campo de pontos e
    // as rotas da frota; à direita, o formulário. No celular, o painel vira uma faixa no topo.
    <div className="flex min-h-svh flex-col gap-3 p-3 animate-in duration-300 fade-in-0 sm:p-4 lg:flex-row lg:gap-4">
      <section
        aria-label="Logos"
        // --pontos claro: o campo de pontos aparece em branco sobre o painel escuro.
        className="relative flex min-h-[200px] flex-col justify-between gap-8 overflow-hidden rounded-[28px] bg-painel-login p-6 text-white [--pontos:#ffffff] sm:p-9 lg:min-h-0 lg:flex-[1_1_520px] lg:rounded-[32px]"
      >
        <FundoPontos vinheta="var(--painel-login)" />
        <PainelRotas />
        <div className="relative">
          <MarcaLogos inversa />
        </div>
        <div className="relative flex max-w-[460px] flex-col gap-3">
          <p className="max-w-[420px] text-[28px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[40px]">
            Central de Resposta <span className="sm:block">a Incidentes</span>
          </p>
          <p className="text-[15px] leading-normal text-white/75 max-sm:hidden">
            5.000 caminhões monitorados. O incidente mais urgente sempre no topo da fila.
          </p>
        </div>
      </section>

      <div className="flex flex-1 flex-col lg:flex-[1_1_560px]">
      <header className="flex justify-end px-1 pt-1 sm:pt-[110px] lg:pt-[110px]">
        <BotaoTema />
      </header>

      <main className="flex flex-1 items-start justify-center px-1 pt-4 pb-10 lg:pt-4">
        {/* A tremida do erro fica nesta coluna, que não é filha de uma cascata: se ficasse no
            cartão, o fim da tremida devolveria a animação de entrada e o cartão sumiria. */}
        <div
          onAnimationEnd={(evento) => {
            if (evento.target === evento.currentTarget) setTremer(false)
          }}
          className={cn(
            'flex w-full max-w-[440px] cascata flex-col gap-4 [--cascata-inicio:200ms]',
            tremer && 'animate-tremer',
          )}
        >
          <div className="flex cascata flex-col gap-6 rounded-[28px] bg-card p-6 shadow-cartao [--cascata-inicio:260ms] sm:p-9">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-semibold tracking-[-0.01em]">Entrar na central</h1>
              <p className="text-sm leading-normal text-texto-2">
                Use sua conta de analista para abrir a triagem.
              </p>
            </div>

            <form
              noValidate
              onSubmit={enviar}
              className="flex cascata flex-col gap-4 [--cascata-inicio:340ms] [--cascata-passo:50ms]"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-usuario">Usuário</Label>
                <Input
                  id="login-usuario"
                  name="usuario"
                  autoComplete="username"
                  value={usuario}
                  onChange={(e) => {
                    setUsuario(e.target.value)
                    limparErro()
                  }}
                  aria-invalid={mensagemErro ? true : undefined}
                  aria-describedby={mensagemErro ? idErro : undefined}
                  className="h-12 rounded-xl bg-card px-3.5 text-[15px] md:text-[15px] dark:bg-card"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-senha">Senha</Label>
                <Input
                  id="login-senha"
                  name="senha"
                  type="password"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => {
                    setSenha(e.target.value)
                    limparErro()
                  }}
                  aria-invalid={mensagemErro ? true : undefined}
                  aria-describedby={mensagemErro ? idErro : undefined}
                  className="h-12 rounded-xl bg-card px-3.5 text-[15px] md:text-[15px] dark:bg-card"
                />
              </div>

              {mensagemErro && (
                <div
                  id={idErro}
                  role="alert"
                  className="flex items-start gap-2.5 rounded-md border border-erro-borda bg-erro-fundo px-3 py-2.5 text-sm leading-snug text-erro-texto"
                >
                  <CircleAlert aria-hidden className="mt-px size-[18px] flex-none" />
                  <span>{mensagemErro}</span>
                </div>
              )}

              {/* Região viva sempre montada: o leitor de tela anuncia quando o aviso aparece. */}
              <div role="status">
                {acordando && (
                  <div className="flex items-start gap-2.5 rounded-md border border-info-borda bg-info-fundo px-3 py-2.5 text-sm leading-snug text-info-texto">
                    <LogosLoader
                      tamanho={18}
                      decorativo
                      cor="var(--info-texto)"
                      fundo="var(--info-fundo)"
                      className="mt-px flex-none"
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">Acordando o servidor…</span>
                      <span>
                        O servidor estava em repouso e está iniciando. Isso costuma levar até 1
                        minuto.
                      </span>
                      {/* Fora da região viva: anunciar a cada segundo seria ruído. */}
                      <span aria-hidden className="font-mono text-xs">
                        Aguardando há {segundosAguardando} s
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={login.isPending}
                className="mt-2 h-12 gap-2 rounded-full text-[15px] font-semibold"
              >
                {login.isPending ? (
                  <>
                    <LogosLoader
                      tamanho={16}
                      decorativo
                      cor="var(--primary-foreground)"
                      fundo="var(--primary)"
                    />
                    <span>Entrando…</span>
                  </>
                ) : (
                  <>
                    <span>Entrar</span>
                    <ArrowRight aria-hidden className="size-4" />
                  </>
                )}
              </Button>
            </form>

            <section
              aria-labelledby="login-demo"
              className="flex flex-col gap-3 rounded-[18px] bg-superficie-2 p-[18px]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2
                  id="login-demo"
                  className="text-xs font-semibold tracking-[0.04em] text-texto-2 uppercase"
                >
                  Credenciais de demonstração
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={preencherDemo}
                  className="h-9 rounded-full border-transparent bg-card px-4 text-sm font-semibold shadow-cartao dark:border-transparent dark:bg-background"
                >
                  Preencher
                </Button>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[15px]">
                <dt className="text-texto-2">Usuário</dt>
                <dd className="font-mono font-semibold">{DEMO.usuario}</dd>
                <dt className="text-texto-2">Senha</dt>
                <dd className="font-mono font-semibold">{DEMO.senha}</dd>
              </dl>
              <p className="text-[13px] leading-snug text-texto-3">
                Para testar a edição simultânea, entre como <span className="font-mono">bruno</span>{' '}
                (mesma senha) em outra janela. Para transferir incidentes entre analistas, entre
                como a supervisora <span className="font-mono">carla</span> (mesma senha).
              </p>
            </section>
          </div>
          <p className="text-center text-[13px] text-texto-3">
            Ambiente de demonstração · dados fictícios
          </p>
        </div>
      </main>
      </div>
    </div>
  )
}
