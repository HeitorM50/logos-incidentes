// Aplica o tema antes do primeiro desenho da tela (mesma regra de src/theme/tema.ts).
// Arquivo separado, e não <script> embutido no index.html: assim a política de segurança
// (Content-Security-Policy em vercel.json) aceita só scripts do próprio site.
try {
  var salvo = localStorage.getItem('logos.tema')
  var escuro = salvo ? salvo === 'escuro' : matchMedia('(prefers-color-scheme: dark)').matches
  if (escuro) document.documentElement.classList.add('dark')
} catch {}
