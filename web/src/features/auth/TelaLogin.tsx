import { useMutation, useQuery } from '@tanstack/react-query'
import { CircleAlert } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { entrar } from '@/api/auth'
import { verificarSaude } from '@/api/saude'
import type { AnalistaLogado } from '@/api/tipos'
import { BotaoTema } from '@/components/BotaoTema'
import { FundoPontos } from '@/components/FundoPontos'
import { LogosLoader } from '@/components/LogosLoader'
import { cn } from '@/lib/utils'
import { MarcaLogos } from '@/components/MarcaLogos'
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
    // Entrada suave ao abrir o app e ao voltar para cá depois de sair. O fundo de pontos surge
    // primeiro; o cartão vem 200 ms depois, em cascata (título → campos → botão → demonstração).
    <div className="relative flex min-h-svh flex-col animate-in duration-300 fade-in-0">
      <FundoPontos />

      <header className="relative flex flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
        <MarcaLogos />
        <BotaoTema />
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 pt-4 pb-12">
        {/* A tremida do erro fica nesta coluna, que não é filha de uma cascata: se ficasse no
            cartão, o fim da tremida devolveria a animação de entrada e o cartão sumiria. */}
        <div
          onAnimationEnd={(evento) => {
            if (evento.target === evento.currentTarget) setTremer(false)
          }}
          className={cn(
            'flex w-full max-w-[420px] cascata flex-col gap-4 [--cascata-inicio:200ms]',
            tremer && 'animate-tremer',
          )}
        >
          <div className="flex cascata flex-col gap-6 rounded-lg border bg-card p-6 shadow-[0_10px_40px_-12px_rgb(0_0_0/0.25)] [--cascata-inicio:260ms] sm:p-8">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-semibold tracking-[-0.01em]">Entrar na central</h1>
              <p className="text-sm leading-normal text-texto-2">
                Triagem de incidentes da frota de 5.000 caminhões.
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
                  className="h-11 rounded-md bg-card px-3 text-[15px] md:text-[15px] dark:bg-card"
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
                  className="h-11 rounded-md bg-card px-3 text-[15px] md:text-[15px] dark:bg-card"
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
                className="mt-2 h-11 gap-2 rounded-md text-[15px] font-semibold"
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
                  <span>Entrar</span>
                )}
              </Button>
            </form>

            <section
              aria-labelledby="login-demo"
              className="flex flex-col gap-3 rounded-md border border-dashed border-borda-forte bg-superficie-2 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2
                  id="login-demo"
                  className="text-[13px] font-semibold tracking-[0.04em] text-texto-2 uppercase"
                >
                  Credenciais de demonstração
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={preencherDemo}
                  className="h-9 rounded-md border-borda-forte bg-card px-3 text-sm dark:border-borda-forte dark:bg-card"
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
                (mesma senha) em outra janela.
              </p>
            </section>
          </div>
          <p className="text-center text-[13px] text-texto-3">
            Ambiente de demonstração · dados fictícios
          </p>
        </div>
      </main>
    </div>
  )
}
