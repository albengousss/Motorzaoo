# Motor-Calc (Motor Gráfico Avançado & CAS)

Este documento descreve a arquitetura, a filosofia de design, o fluxo de engenharia rigoroso e o roteiro estratégico do projeto **Motor-Calc** — uma plataforma de computação gráfica matemática e sistema algébrico computacional (CAS) interativo de última geração.

---

## 🧭 1. Nossa Filosofia de Design & Inspiração no Desmos

### O que significa a "Inspiração no Desmos"?
Inspirar-se no Desmos não é apenas copiar cores ou formatos; é adotar uma **filosofia profunda de respeito cognitivo ao usuário e elegância matemática invisível**:

1. **A Interface Deve Ser Invisível:** O usuário deve se concentrar puramente na beleza e na lógica da matemática. Caixas cinzentas rígidas, popups intrusivos e quebras visuais obstruem o pensamento e foram terminantemente abolidos.
2. **Auto-Transformação Instantânea (Zero Burocracia):** Ao digitar termos como `int`, `defint`, `sqrt`, `matrix`, `sum`, `d/dx`, `det`, o editor matemático converte a sequência em símbolos nativos de alta fidelidade no exato instante da última tecla, sem exigir confirmação (`Enter`, `Espaço` ou cliques).
3. **Eliminação do Padrão GeoGebra:** O usuário **nunca** deve ser forçado a digitar comandos em texto de código burocrático (como `Integral(f, x, 0, 2)` ou matrizes em `[[1, 2], [3, 4]]`). No Motor-Calc, tudo é tratado em visual LaTeX contínuo, visualmente arrastável e com tipografia matemática pura.
4. **Tratamento de Falhas com Serenidade (Zero Crashes):** Estados intermediários de digitação (ex: o usuário acabou de digitar `\int` e ainda não colocou o diferencial `dx`) nunca disparam exceções no console (`SyntaxError`) nem travam o canvas. Erros são comunicados com discrição através do ícone sutil de aviso e popover explicativo, exatamente como no Desmos (ex: *"O integrando deve terminar com uma variável de integração, como dx."*).
5. **Reatividade Viva:** Sliders dinâmicos nascem e morrem automaticamente conforme variáveis livres aparecem ou somem das fórmulas. Matrizes abraçam seu conteúdo com colchetes de ajuste perfeito (*hug-fit*) e preenchem automaticamente com `0` células limpas.

---

## 🛠️ 2. Nossa Forma de Trabalho & Protocolo de Engenharia

Para manter a estabilidade de classe mundial em um software com compilador matemático, CAS assíncrono em WebAssembly e shaders em WebGL, seguimos rigorosamente os seguintes protocolos:

### Protocolo 1: Sincronização Contínua com o GitHub e Deploy (Vercel)
* O aplicativo oficial roda em produção no Vercel ([motorzaoo.vercel.app](https://motorzaoo.vercel.app/)), integrado à branch `main` do GitHub.
* **Regra de Ouro:** Toda refatoração, correção ou feature concluída deve ser validada e imediatamente enviada ao repositório via `git commit` e `git push origin main`, garantindo que o ambiente online esteja sempre atualizado e disponível para o usuário.

### Protocolo 2: Testes Exaustivos sob a Ótica do Usuário Real (*User-Centric Adversarial Testing*)
* **A Mente do Usuário é Imprevisível:**
  * O usuário real **não pensa como um programador linear**. Ele digita rápido, erra letras, cola expressões complexas, esquece parênteses, apaga o meio de uma equação, cola termos grudados (`xdx`, `ydy`, `2xsin(x)`), mistura espaços aleatórios (`\int _1 ^2 x dx`), inverte limites (`\int^2_1`), e combina caracteres LaTeX com texto comum.
* **Testar a Cadeia Completa de Tradução:**
  Não basta testar se o cálculo numérico isolado funciona. É obrigatório testar **o programa pelo programa** em sua cadeia completa de 6 etapas:
  $$\text{Input do Usuário} \longrightarrow \text{MathLive} \longrightarrow \text{Sanitização } (cleanStr) \longrightarrow \text{Parser / AST} \longrightarrow \text{Motor / Giac CAS} \longrightarrow \text{Tradução Visual para o Usuário}$$
  Se o Giac calcular a integral corretamente, mas o resultado for exibido como texto feio ou incompleto, **o sistema falhou**. A tradução de ida e de volta deve ser 100% perfeita.

### Protocolo 3: Ciclo Fechado de Correção até Zero Erros (*Defensive Loop*)
* Praticamos **programação defensiva extrema**.
* Todo bug reportado ou identificado deve ser isolado, adicionado como teste automatizado na suíte de testes defensivos (`scripts/verify-defensive.ts`) e o motor deve ser testado repetidamente até que **todas as asserções passem com 100% de sucesso e zero regressões**.
* Antes de dar qualquer tarefa como concluída, o build de produção (`npm run build`) deve rodar com **0 erros de TypeScript e 0 avisos impeditivos de bundling**.

### Protocolo 4: Verificação Estrita de Duplicidade (*Single Source of Truth*)
* Antes de implementar qualquer cálculo, regex ou handler de UI, examine rigorosamente o repositório para verificar se a funcionalidade já existe em outro formato.
* Elimine códigos mortos, caminhos legados do GeoGebra e implementações redundantes. Deve existir **apenas uma única implementação canônica limpa** (`LatexNormalizer`), padronizada e otimizada.

### Protocolo 5: Resiliência de Entrada e Padrão Desmos em Funções e Potências
* **Funções Unárias sem Parênteses:** O usuário nunca é forçado a colocar parênteses em expressões como `sin x`, `cos 2x`, `ln x`, `e^x`, `sqrt x`. O parser e o normalizador tratam isso com precedência correta.
* **Potências Trigonométricas:** Suporte nativo a $\sin^2(x)$, $\cos^2(x)$, $\sin^2 x$ sem que multiplicação implícita insira `*` indevido, e conversão automática de inversas $\sin^{-1}(x)$ para `asin(x)`.
* **Centralização no LatexNormalizer:** Todo tratamento textual de LaTeX e MathLive passa por uma única via (`LatexNormalizer.normalize`), evitando proliferação de regexes espalhadas.
* **Ergonomia Multiplataforma (PC & Mobile):** Prevenção de sobreposição de elementos na tela do celular (teclado virtual não comprime o canvas além do limite utilizável), toque preciso para fixar raízes/extremos/condições iniciais de EDO e botões táteis e visíveis no HUD (zoom in/out e repor vista).

---

## 🎯 3. Momento Atual vs. Nosso Grande Objetivo Central

### Fase Atual: Refinamento, Ergonomia e Robustez da Base
No momento presente, estamos **lapidando e blindando os fundamentos do sistema**:
* Normalização matemática impecável (`int` vs `defint`, diferenciais obrigatórios, matrizes arrastáveis vivas, sliders automáticos, remoção de menus legados).
* Garantir que a usabilidade seja suave, elegante e visualmente impecável.

### O Ponto Principal: A Máquina Matemática Superior
Este refinamento é a **fundação estrutural sólida** para a verdadeira meta do Motor-Calc. Em breve, voltaremos com força total ao nosso objetivo principal:
1. **Computação Avançada de Equações Diferenciais (EDOs e EDPs):**
   * Resoluções analíticas simbólicas e numéricas de alta ordem.
   * Campos vetoriais direcionais 2D e 3D em tempo real com controle de densidade e cores.
   * Traçado de retratos de fase, bacias de atração e sistemas de equações diferenciais acopladas.
   * Integradores numéricos adaptativos de alta precisão (Runge-Kutta Dormand-Prince RK45 e métodos para sistemas rígidos / *stiff*).
2. **Cálculo Avançado Multivariável & Vetorial:**
   * Integrais duplas e triplas com limites de integração funcionais e projeção de regiões de integração volumétricas.
   * Gradientes, divergentes, rotacionais e campos de fluxo.
   * Visualização gráfica de teoremas fundamentais do cálculo (Green, Stokes e Gauss-Divergência).
3. **Motor Gráfico e CAS de Alta Performance:**
   * Unificação perfeita entre CPU simbólica (Giac WebAssembly) e GPU paralela (WebGL raymarching e fragment shaders a 60 FPS ininterruptos).

---

## 📖 4. Guia e Central de Ajuda de Comandos

O Motor-Calc possui uma **Central Interativa de Comandos e Ajuda** integrada nativamente na interface:

* **Como Acessar:** Clique no ícone de ajuda **`?`** no cabeçalho da barra lateral de expressões (ao lado dos botões Desfazer/Refazer) ou pressione a tecla `Esc` para fechar a qualquer momento.
* **O que o Guia Contém:**
  * **Cálculo & Derivadas:** `d/dx(f(x))`, linha de plica `f'(x)`, limites `lim(f(x), x, a)`, campos de direção `campo(y')`, resolução analítica de EDOs `edo(y' = f(x, y))` e séries de Taylor.
  * **Integrais & Séries:**
    * `int`: Integral indefinida simbólica $\int f(x) \, dx$ com constante $+ C$ e curva primitiva automática.
    * `defint`: Integral definida $\int_a^b f(x) \, dx$ com cálculo instantâneo da área sob a curva.
    * Somatórios $\sum_{n=a}^b$ e Produtórios $\prod_{n=a}^b$.
  * **Álgebra Linear & Matrizes:**
    * Criação visual interativa (`matrix` ou atalhos `#22`, `#33`, `#24`).
    * Determinantes `det(A)`, escalonamento reduzido `rref(A)`, traço `trace(A)`, posto `rank(A)`, transposta $A^T$ / $A'$, inversa $A^{-1}$ / `inv(A)`, autovalores e autovetores.
  * **Trigonometria & Funções:** Funções trigonométricas, hiperbólicas e inversas, raízes $n$-ésimas `nthroot`, logaritmos `log`, `ln`.
  * **Estatística & Listas:** Média `mean(L)`, mediana `median(L)`, desvio padrão `stdev(L)` e vetores/listas entre colchetes `L = [1, 2, 3]`.

---

## 🛠️ 5. Tecnologias Utilizadas na Stack

* **TypeScript & Vite:** Tipagem estática rigorosa e pipeline de bundling ultra-rápido (< 1s).
* **MathLive:** Campo de entrada matemática `<math-field>` sem latência, configurado para conversão instantânea de operadores e visual LaTeX puro.
* **Giac (WebAssembly via Web Worker):** Motor simbólico rodando isolado em segundo plano (`public/giacWorker.js`), garantindo que cálculos pesados nunca congelem a UI.
* **WebGL / Shaders GLSL:** Renderização acelerada por GPU para superfícies 3D, equações implícitas via Raymarching e inequações com anti-aliasing subpixel a 60 FPS.
* **Canvas 2D API Adaptativa:** Renderização adaptativa de alta densidade para funções explícitas, curvas paramétricas e polares.

---
*Documentação de engenharia e diretrizes de desenvolvimento do Motor-Calc.*
