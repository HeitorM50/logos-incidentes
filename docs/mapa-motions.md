# Mapa de motions — front-end Logos

Mapeamento de onde movimento pode melhorar a leitura e a sensação de qualidade do front-end.
É um cardápio: cada item diz onde fica, o que acontece, por que vale a pena e como se comporta
com `prefers-reduced-motion`.

> **Situação (20/10/2026):** os grupos 1 a 4 da seção 8 foram implementados na issue
> [#26](https://github.com/HeitorM50/logos-incidentes/issues/26), só com CSS, `tw-animate-css`
> e FLIP manual (sem biblioteca nova). Ficaram de fora, por contrariar os princípios da seção 0
> ou criar função nova: 1.3 (digitação simulada), 3.8 (ações só no hover), 4.8 (campo de motivo
> inexistente), a marca "respirando", a densidade animada, o *hold-to-confirm* e o *swipe* dos
> avisos. Os itens ⛔ continuam fora do escopo.

---

## 0. Princípios (antes de qualquer item)

O Logos é uma central de incidentes: o analista fica horas olhando para a mesma tela e precisa
notar o que mudou. Por isso o movimento tem uma função só, **apontar mudança de estado**.
Movimento decorativo, que se repete sem motivo, compete com um incidente ALTA novo.

| Regra | Valor sugerido |
|---|---|
| Micro (hover, press, chevron, check) | 120–180 ms |
| Componentes (painel, dropdown, linha expandindo) | 200–280 ms |
| Entrada de tela / coreografia | 400–700 ms no total, com stagger de 30–40 ms |
| Curva de entrada | `cubic-bezier(0.16, 1, 0.3, 1)` (sai rápido, assenta devagar) |
| Curva de saída | `cubic-bezier(0.7, 0, 0.84, 0)`, ~70% da duração da entrada |
| Distância de deslocamento | 4–12 px, nunca mais que isso dentro da triagem |
| Loop infinito | só no `LogosLoader`, no `FundoPontos` e em indicador "ao vivo" |
| Reduced motion | troca deslocamento/escala por fade curto ou por nada; o `index.css` já zera durações globalmente |

**Stack:** hoje o projeto usa Tailwind 4 + `tw-animate-css` + transições CSS + SMIL no loader.
Quase tudo abaixo cabe nisso. Os poucos itens marcados com **[lib]** ficam bem mais simples
com `motion` (Framer Motion), principalmente layout animation e contagem numérica. Adicionar uma biblioteca é
uma decisão nova: precisa da aprovação do Heitor, e o custo de bundle precisa ser avaliado.

Legenda de prioridade: 🟢 alto impacto e barato · 🟡 vale a pena · 🔵 ideia mais ousada · ⛔ conflita com decisão já tomada.

---

## 1. Entrada na plataforma

### 1.1 Login: coreografia de chegada 🟢
`features/auth/TelaLogin.tsx` (hoje: `animate-in fade-in-0` no container inteiro)
- Em vez de fade em bloco, entrar em cascata: marca do header → título "Entrar na central" →
  campos → botão → bloco de credenciais de demonstração (stagger de 40 ms, `translateY(8px)` → 0).
- O `FundoPontos` já surge do centro. Começar o card ~200 ms depois, para o fundo "abrir
  caminho" para o formulário.
- Reduced: só fade de 150 ms.

### 1.2 Marca do header desenhando uma vez 🟡
`components/MarcaLogos.tsx`
- No primeiro carregamento, a marca faz **um único ciclo** do mesmo desenho do loader
  (contorno → preenchimento → L) e para. Funciona como assinatura e liga a marca ao loader.
- Letreiro "LOGOS" com o tracking abrindo de `0.04em` a `0.12em` em 500 ms.

### 1.3 Botão "Preencher" das credenciais 🟡
- Ao clicar, os valores entram nos campos como se fossem digitados (typewriter rápido,
  ~25 ms por caractere). A senha mostra os bullets surgindo um a um.
- Os campos piscam a borda (`border-color` → `foreground` → normal) para mostrar onde mudou.

### 1.4 Erro de login 🟢
- *Shake* horizontal curto no card (3 oscilações, 6 px, 300 ms) e a mensagem de erro
  entrando com `height: 0 → auto` + fade, sem empurrar o layout de uma vez.
- Reduced: sem shake, só a borda vermelha e o fade.

### 1.5 Botão "Entrar" → "Entrando…" 🟢
- A largura do botão se mantém e o texto troca por *crossfade* vertical (texto antigo sobe e
  some, o novo sobe de baixo).
- No lugar do spinner genérico, usar o `LogosLoader` a 16 px.

### 1.6 Transição login → triagem (hand-off) 🔵
`components/TelaAbertura.tsx`
- Hoje é um fade de 300 ms sobre o loader de 88 px. Ideia: quando os dados chegam, o loader
  **encolhe e voa** até a posição da marca no header da triagem (shared element / FLIP). A
  tela de abertura dissolve por trás. Fica a sensação de "a central abriu".
- **[lib]** com `layoutId` do Motion, ou FLIP manual com `getBoundingClientRect`.
- Reduced: fade simples (o que já existe).

### 1.7 Triagem: primeira pintura em camadas 🟢
`features/incidents/TelaTriagem.tsx` (hoje: `fade-in-0` de 200 ms)
- Ordem: header → barra de status → cartões de criticidade → filtros → tabela.
  Cada bloco com `translateY(6px)` + fade, stagger de 50 ms.
- As linhas da tabela entram em cascata **só nas primeiras ~12 visíveis** (20 ms cada). Animar
  as 100 seria lento e caro.

---

## 2. Números, gráficos e indicadores

### 2.1 Contadores dos cartões de criticidade 🟢 [lib opcional]
`features/incidents/CartoesCriticidade.tsx`
- Na primeira carga, o número conta de `–` até o valor (400 ms, ease-out, `tabular-nums` já
  está lá, então não há *layout shift*).
- Quando o número muda depois disso: animação de "odômetro", com o dígito antigo saindo para
  cima e o novo entrando de baixo. Para cima quando aumenta, para baixo quando diminui. A
  direção já diz se piorou ou melhorou.
- **ALTA aumentou:** além do odômetro, um *pulse* de anel no ícone do triângulo
  (`box-shadow` expandindo e sumindo, 600 ms, uma vez só).

### 2.2 Barra "Ativos por status" 🟢
`features/incidents/BarraStatus.tsx` (hoje: `transition-[flex-grow] duration-500`)
- Primeira carga: os segmentos crescem da esquerda, em sequência (Aberto → Investigação →
  Inconclusivo), em vez de aparecer prontos.
- As listras do Inconclusivo podem deslizar devagar (`background-position`) **só no hover**,
  como dica de que aquele segmento é diferente. Nunca em loop parado.
- Hover em um segmento: os outros dois descem para 40% de opacidade e aparece um tooltip
  com a contagem e o %.

### 2.3 Sparklines nos KPIs (do protótipo) ⛔ fora do escopo atual
> Mini gráficos nos cartões foram descartados nas decisões de 19/10 (issue #25, "Descartadas de propósito"). Fica registrado só para o caso de essa decisão mudar.

- Draw-on do traço com `stroke-dashoffset` (o mesmo truque do loader), 600 ms.
- O ponto final fica com um halo que respira **só se o último bucket subiu**.
- Hover no sparkline: uma linha vertical segue o cursor e mostra o valor do bucket.

### 2.4 Indicador de conexão "ao vivo" 🟢
`features/incidents/IndicadorConexao.tsx`
- **Ao vivo:** ponto verde com um anel que expande e some a cada ~3 s, bem discreto. É o
  único loop permitido na triagem, e dá para saber que está vivo sem ler o texto.
- **Ao vivo → sincronizando:** o ponto vira o `LogosLoader` de 14 px com *crossfade*.
- **Sem conexão:** o ponto desbota até virar um círculo vazado e balança uma vez.
- O texto "atualizado há X s" troca por crossfade a cada tick, sem pulo.

### 2.5 "Mais antigo há X min" envelhecendo 🔵
- Quando o incidente mais antigo de ALTA passa de um limite (ex.: 30 min), o texto ganha uma
  transição de cor para o tom de alerta (2 s, uma vez). A urgência aparece aos poucos, sem
  piscar.

---

## 3. Tabela e linhas de incidente

### 3.1 Incidente novo chegando via polling 🟢
`features/incidents/TabelaIncidentes.tsx` / `LinhaIncidente.tsx`
- A linha nova entra com altura `0 → auto` (as de baixo descem suavemente, não pulam) e fica
  com um fundo de destaque (`bg-info-fundo`) que desbota em 2–3 s. É o padrão "*yellow
  fade*" clássico.
- Se for ALTA: uma barra de 3 px à esquerda da linha "acende" e permanece até a primeira
  interação.
- Reduced: sem altura animada, só o fundo que desbota.

### 3.2 Linha saindo (resolvido / removido / filtrado) 🟢 [lib opcional]
- Fade + colapso da altura (200 ms). As linhas restantes **deslizam para o lugar** em vez de
  saltar. Com o Motion, `layout` + `AnimatePresence` faz isso de graça; à mão, use FLIP.

### 3.3 Reordenação 🟡 [lib]
- Quando a ordenação muda (status alterado, nova criticidade), as linhas trocam de posição
  com FLIP (250 ms). O analista acompanha **para onde foi** o incidente que acabou de mexer.

### 3.4 Expandir linha (detalhes / linha do tempo) 🟢
`LinhaIncidente.tsx` (hoje o chevron já gira em 150 ms)
- O painel de detalhes abre com `grid-template-rows: 0fr → 1fr`, que anima altura sem JS.
- Os itens da linha do tempo entram em cascata (30 ms), e a linha vertical que liga os pontos
  se "desenha" de cima para baixo (`scaleY` 0 → 1, `transform-origin: top`).

### 3.5 Linha pendente (ação otimista em voo) 🟢
- Hoje: `bg-linha-pendente` + loader. Acrescentar um *shimmer* diagonal muito sutil
  atravessando a linha (gradiente com `background-position` animado), que diz "estou falando
  com o servidor" sem precisar ler.
- Quando confirma: o shimmer para e um ✓ aparece por 800 ms ao lado do status.
- Quando falha: a linha **volta** ao estado anterior com um leve *rewind* (desliza 4 px para
  a direita e retorna) junto com o aviso.

### 3.6 Conflito 409 (outro analista mexeu antes) 🟡
`Avisos.tsx → AvisoConflito`
- O aviso desliza para dentro da linha a partir de cima, e os campos que mudaram (status,
  responsável) piscam uma vez com o valor novo. Fica claro **o que** o outro analista mudou.

### 3.7 Skeleton → conteúdo 🟢
- Hoje: `animate-pulse` no esqueleto. Trocar por *shimmer* direcional (esquerda → direita)
  com o mesmo ritmo do loader (2 s), para os dois "respirarem" juntos.
- Quando os dados chegam: cada barra de esqueleto faz *crossfade* com o conteúdo da sua
  posição, em vez de a tabela inteira trocar de uma vez.

### 3.8 Hover de linha 🟡
- O fundo entra em 120 ms. As ações da linha (`AcoesLinha`) aparecem com fade e
  `translateX(4px → 0)`, o que deixa a linha em repouso mais limpa. Cuidado: no teclado e no
  touch, as ações precisam continuar sempre visíveis.

---

## 4. Botões, setas e micro-interações

### 4.1 Botões em geral 🟢
`components/ui/button.tsx`
- Press: `scale(0.97)` em 80 ms e volta com uma pequena mola. Dá "peso" ao clique.
- Botões primários: no hover, um brilho diagonal atravessa uma vez (*sheen*, 500 ms).
- Foco: o `ring` cresce de 0 a 3 px em vez de aparecer pronto.

### 4.2 Setas e chevrons 🟢
- **Chevron de expandir** (já gira): adicionar um leve *overshoot* (gira até 100° e assenta
  em 90°).
- **Setas de "ver mais" / links com →:** no hover, a seta anda 3 px para a direita e volta
  em loop curto enquanto o hover durar (*nudge*).
- **Seta de ordenação na coluna:** ao inverter, gira 180° em vez de trocar o ícone.
- **Voltar / fechar painel:** a seta ← faz um *nudge* para a esquerda no hover.

### 4.3 Toggle de tema 🟡
`components/BotaoTema.tsx` (a transição de cores já existe em `tema-em-transicao`)
- Ícone lua ↔ sol: a lua gira e encolhe enquanto o sol cresce girando, e os raios do sol
  "nascem" em stagger.
- 🔵 Mais ousado: a troca de tema se espalha como um **círculo crescendo a partir do botão**
  (View Transitions API + `clip-path: circle()`). Reduced: troca instantânea.

### 4.4 Filtros de categoria (chips) 🟢
`features/incidents/FiltroCategorias.tsx`
- Ao marcar: o ✓ se desenha (`stroke-dashoffset`) e o chip faz um *pop* (scale 1 → 1.04 → 1).
- Contador de resultados ao lado dos filtros com odômetro (igual ao 2.1).
- "Limpar filtros": os chips desmarcam em cascata, da direita para a esquerda.

### 4.5 Cartão de criticidade como filtro 🟡
- Ao marcar, a borda interna (`inset shadow`) entra crescendo, e o selo "Filtrando" desliza
  da esquerda com fade.
- As linhas que somem da tabela usam o mesmo colapso do 3.2, o que liga a causa ao efeito.

### 4.6 Campo de busca 🟡
`features/incidents/CampoBusca.tsx`
- No foco, o campo expande alguns px de largura e a lupa desliza para dentro.
- Enquanto digita (debounce), a lupa faz uma rotação pequena, como se procurasse.
- Sem resultados: a ilustração / texto do estado vazio entra com fade + 6 px.
- Destaque do termo encontrado: o fundo `mark` entra varrendo da esquerda.

### 4.7 Dropdown "mais ações" 🟢
`AcoesLinha.tsx` + `components/ui/dropdown-menu.tsx`
- O menu nasce da origem do gatilho (o Radix já expõe `transform-origin`): `scale(0.96) → 1`
  + fade, e os itens em stagger de 20 ms.
- Item destrutivo (remover): no hover, o ícone de lixeira levanta a tampa (2 paths, 150 ms).

### 4.8 Botão com motivo 🟡
`features/incidents/BotaoComMotivo.tsx`
- Quando o motivo é obrigatório e está vazio: o botão faz shake curto e o campo de motivo
  ganha foco com destaque.

---

## 5. Painéis, diálogos e avisos

### 5.1 Painel lateral do incidente (Sheet) 🟢
`features/incidents/PainelIncidente.tsx`
- Já desliza. Melhorias:
  - O conteúdo interno entra em cascata depois do painel (título → descrição → campos).
  - A tabela atrás recua levemente (`scale(0.99)` + escurecer), dando profundidade.
  - **Salvar:** o botão vira `LogosLoader` 16 px → ✓ desenhado → o painel fecha.
- Formulário com erro de validação: o campo inválido treme e a mensagem entra por altura.

### 5.2 Confirmar remoção (AlertDialog) 🟡
`features/incidents/ConfirmarRemocao.tsx`
- O diálogo entra com escala e uma mola mais "firme", diferente dos outros, para sinalizar
  uma ação destrutiva.
- 🔵 Botão "Remover" com *hold-to-confirm* opcional: uma barra enche dentro do botão enquanto
  o usuário segura (800 ms). Precisa ter alternativa por clique e teclado.
- Após confirmar: a linha some com um colapso mais marcado que o normal (com leve
  `translateX` para a direita), como se fosse arquivada.

### 5.3 Pilha de avisos / Undo Pill 🟢
`features/incidents/Avisos.tsx → PilhaAvisos, AvisoSucesso`
- Os avisos entram de baixo com mola e **empilham** (os anteriores encolhem 4% e sobem, no
  estilo Sonner).
- Undo: o anel de contagem regressiva (já existe no protótipo) esvazia de forma contínua e
  **pausa no hover**, e a pausa é visível porque o anel muda de cor.
- "Desfazer" clicado: a pill encolhe até o ponto e a linha volta com o *rewind* do 3.5.
- Swipe para dispensar (touch): o aviso segue o dedo e some quando passa do limite.

### 5.4 Banner de reconexão 🟢
`features/incidents/BannerReconexao.tsx`
- Desce do topo empurrando o conteúdo (altura animada, não sobreposição brusca).
- Quando reconecta: o banner fica verde por 1 s com ✓ ("Conectado") e então recolhe.
  Fechar o ciclo com um estado positivo dá tranquilidade.

### 5.5 Painel "acordando o servidor" (cold start) 🟡
`features/incidents/PainelEstado.tsx → PainelAcordando`
- O contador "Aguardando há X s" com odômetro.
- 🔵 Microcopy rotativo a cada ~5 s com crossfade ("Ligando o servidor…", "Conectando ao
  banco…", "Quase lá…"). Isso transforma a espera de cold start do Render em parte da
  experiência.

### 5.6 Command Menu (Ctrl+K, do protótipo) ⛔ fora do escopo atual
> A paleta de comandos foi descartada nas decisões de 19/10 (a busca é simples; issue #25, "Descartadas de propósito"). Fica registrado só para o caso de essa decisão mudar.

- Abre com `scale(0.98) + translateY(-8px)` e o scrim faz fade com blur.
- O item selecionado tem um "realce" que **desliza** entre os itens (um único elemento de
  fundo que se move), em vez de cada item acender sozinho.
- Ao escolher um incidente, a linha correspondente pisca (o *yellow fade* do 3.1) depois do
  scroll.

---

## 6. Estados vazios e erro

### 6.1 "Nenhum incidente" 🟡
- Ilustração mínima com a marca Logos e um ✓ que se desenha, mais o texto "Tudo sob controle"
  entrando com fade. É o momento de recompensa do analista.
- 🔵 Quando a fila de ALTA zera, uma celebração bem discreta: o cartão ALTA faz um *pulse*
  verde uma vez. Nada de confete, porque é uma central de incidentes.

### 6.2 Erro de carregamento 🟢
- Ícone de alerta com balanço único, e o botão "Tentar de novo" vira loader ao clicar.
- Se a tentativa falhar de novo: shake curto no cartão, para mostrar que o clique foi recebido.

---

## 7. Ideias mais ousadas 🔵

| Ideia | Onde | Observação |
|---|---|---|
| **View Transitions** entre login → triagem e abrir/fechar painel | global | API nativa, tem fallback automático em navegadores sem suporte |
| **Marca reativa** | header | a marca "respira" (opacidade 0.9 ↔ 1, ciclo lento) só enquanto há ALTA aberto, como um sinal ambiente |
| **Radar de chegada** | header | quando um incidente chega com a aba em segundo plano, o título da aba alterna "(1) Logos" e o favicon ganha um ponto |
| **Cursor de foco por teclado** | tabela | um anel único que desliza entre linhas ao navegar com ↑↓, em vez de cada linha ganhar o próprio outline |
| **FundoPontos na triagem** | estado vazio | reaproveitar a grade de pontos do login, bem mais fraca, só no estado "Nenhum incidente" |
| **Densidade animada** | tabela | alternar compacto ↔ confortável com a altura das linhas interpolando |

---

## 8. Ordem sugerida

> Prazo de entrega: 21/10/2026. Antes do prazo, só vale o grupo 1, e só se os três entregáveis já estiverem fechados.

1. **Base barata e de alto impacto:** 1.4, 1.5, 2.1, 2.4, 3.1, 3.4, 3.5, 4.1, 4.2, 4.7, 5.3, 5.4.
   Tudo cabe em CSS e `tw-animate-css`.
2. **Coreografias:** 1.1, 1.7, 3.7, 5.1.
3. **Precisam de layout animation (avaliar o Motion):** 3.2, 3.3, 1.6.
4. **Experimentos:** seção 7.

Para cada item implementado, vale ter um teste que confirme que, com `prefers-reduced-motion`,
o estado final aparece direto e nenhum `animationend` deixa a UI travada. O `index.css` já
cuida disso globalmente; o risco está em animações feitas em JS.
