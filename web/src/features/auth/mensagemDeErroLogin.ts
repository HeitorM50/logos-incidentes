import { ehErroApi } from '@/api/erros'

/** Traduz a falha do login para uma frase que diz ao analista o que fazer. */
export function mensagemDeErroLogin(erro: unknown): string {
  if (!ehErroApi(erro)) return 'Não foi possível entrar. Tente de novo.'
  if (erro.codigo === 'credenciais_invalidas') {
    return 'Usuário ou senha incorretos. Confira as credenciais de demonstração abaixo.'
  }
  if (erro.codigo === 'muitas_tentativas') {
    return 'Muitas tentativas seguidas. Aguarde 1 minuto e tente de novo.'
  }
  if (erro.codigo === 'validacao') return 'Preencha o usuário e a senha.'
  if (erro.ehTransitorio) return 'O servidor não respondeu. Tente de novo em alguns segundos.'
  return 'Não foi possível entrar. Tente de novo.'
}
