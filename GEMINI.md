# Motor-Calc (Motor Gráfico Avançado & CAS)

Este documento descreve a arquitetura, as funcionalidades implementadas e o funcionamento geral do projeto **Motor-Calc**, uma calculadora gráfica e sistema de computação algébrica (CAS) na web, inspirada no Desmos e GeoGebra.

---

## 🛠️ Tecnologias Utilizadas
- **TypeScript & Vite:** Base do projeto para tipagem estática rigorosa e bundling ultra-rápido.
- **MathLive:** Biblioteca responsável pelo teclado matemático virtual e pelo campo de input (`<math-field>`), gerando LaTeX e ASCII-Math limpos e formatados.
- **Giac (WebAssembly via Web Worker):** O "cérebro" matemático do projeto. O Giac roda 100% isolado em segundo plano (`public/giacWorker.js`) através de mensagens tipadas via `postMessage`. A thread principal da UI e do canvas nunca sofre congelamentos, mesmo durante cálculos de integrais complexas, determinantes ou expansões simbólicas.
- **WebGL / Fragment Shaders (GPU):** Motor de renderização (`src/graphics/glRenderer.ts`) em camada acelerada por hardware para equações implícitas e inequações, utilizando derivadas parciais de tela (`dFdx`, `dFdy`) para anti-aliasing subpixel de alta fidelidade a 60 FPS.
- **Canvas 2D API Adaptativa:** Renderizador de alta performance (`src/graphics/renderer.ts`) com algoritmo de amostragem adaptativa (`generatePointsAdaptive`) para curvas explícitas, paramétricas e polares.

---

## ✨ Funcionalidades Implementadas

### 1. Sistema de Input e UI (Estilo Desmos)
- **Interface Limpa e Responsiva:** Sidebar expansível, fundo branco, botões de ação com cantos arredondados e suporte a toque móvel.
- **Digitação Matemática Fluida (Estilo Desmos):**
  - **Expoentes Imediatos (`smartSuperscript`):** Pressionar `^` pula instantaneamente para a caixa de expoente sem exibir o caractere circunflexo `^`.
  - **Parênteses Automáticos (`smartFence`):** Digitar `(` fecha o parêntese correspondente automaticamente.
  - **Frações Inteligentes com `/`:** A tecla `/` encapsula o termo anterior no numerador e posiciona o cursor diretamente no denominador, sem comandos invasivos.
- **Toggles Dinâmicos de Visibilidade:** Círculos coloridos com o índice da expressão. Clicar no círculo oculta ou exibe a curva instantaneamente.
- **Badges de Resultado:** Exibição clara e contextual de resultados escalares, expressões simbólicas simplificadas, campos vetoriais e avisos de variáveis livres.

### 2. Funções Multivariáveis e Alta Dimensão
- **Declaração com Múltiplas Variáveis:**
  - $f(x, y) = x^2 y + \frac{y^2}{x}$
  - $f_1(x, y) = 2x - 3y$
  - $f_{jose}(x, y) = x^2 + y^2$
  - Funções de alta dimensão: $f(x, y, z, a, b) = x + y + z + a + b$
- **Multiplicação Implícita Universal:** Suporte a produtos de variáveis sem operador explícito ou com espaços: `xy`, `xz`, `yz`, `x z`, `y z`, `2xz`, `3yz`, `xyz`, etc., resolvendo equações implícitas multivariáveis e superfícies analiticamente.
- **Avaliação Numérica Multivariável:** Chamadas como $f(2, 3, 1, 0, 2)$ avaliam todos os argumentos em cascata e exibem o resultado numérico exato no badge.
- **Curvas de Nível e Equações Implícitas com Funções:** Escrever $f(x, y) = 0$, $f(x, y) = 4$ ou $f(x, y) \le 0$ expande a definição da função e plota a curva ou região diretamente na GPU via WebGL.
- **Cálculo Simbólico Multivariável via Giac:** Consultas como `int(f(x, y), y)` ou `diff(f(x, y, z), x)` são enviadas ao Giac com o namespace do usuário (`usr_f`), resolvendo integrais e derivadas parciais simbolicamente.

### 3. Plotagem e Gráficos
- **Gráficos Explícitos:** Funções $f(x) = \dots$ ou $y = \dots$.
- **Curvas Paramétricas:** Pares ordenados $(x(t), y(t))$, como $(\cos(t), \sin(t))$ ou $(t^2, t^3 - t)$.
- **Curvas Polares:** Equações $r = f(\theta)$ ou $r = f(t)$, como $r = 1 + \cos(\theta)$, convertidas internamente para coordenadas cartesianas no intervalo $[0, 2\pi]$.
- **Restrições de Domínio `{condição}`:** Suporte à sintaxe clássica do Desmos com condições simples e duplas (ex: `y = x^2 {x >= 0}`, `y = sin(x) {0 <= x <= pi}`, `(cos(t), sin(t)) {0 <= t <= pi}`).
- **Equações Implícitas & Inequações em WebGL:** Resolução analítica por pixel no fragment shader sem o custo de triangulação pesada na CPU.

### 4. Sliders Dinâmicos e Animados (60 FPS)
- Declaração de variáveis dinâmicas (ex: $a = 5$ ou $k = 2$).
- Botão de **Play/Pause** animado em cada slider com loop ping-pong entre os valores mínimo e máximo a 60 FPS ininterruptos.

### 5. Computação Algébrica Simbólica (CAS & Giac Worker)
- **Integrais com Qualquer Variável:**
  - Formato funcional: `int(x, x)`, `int(t, x)`, `int(t, t)`
  - Formato LaTeX: `\int x dx`, `\int t dt`, `\int_0^2 x dx`
  - Auto-plotagem: Integrais indefinidas em $x$ geram o resultado simbólico e plotam imediatamente a curva primitiva no gráfico.
- **Derivadas e Limites:** $\frac{d}{dx} f(x)$, `diff(expr, x)`, `limit(expr, x, 0)`.
- **Matrizes e Álgebra Linear:** Operações de matrizes $M \times N$, determinantes, inversas e resolução simbólica de equações matriciais $M \times N = 0$.

### 6. Equações Diferenciais Ordinárias (EDOs) e Campos Vetoriais
- **Notações Universais:**
  - Plicas: $y' = x + y$, $y'(t) = -2y$, $x'(t) = -x$
  - Leibniz: $\frac{dy}{dx} = \dots$, $\frac{dy}{dt} = -k \cdot y$
  - Comando explícito: `campo(y' = x)`
- **Parâmetros Dinâmicos:** Variáveis livres em EDOs (como $k$ em $dy/dt = -k \cdot y$) conectam-se aos sliders em tempo real.
- **Problema de Valor Inicial (IVP):** Traçado automático da solução a partir de condições iniciais como $y(0) = 1$ via integrador Dormand-Prince (RK45).

### 7. Motor Gráfico 3D (Estilo Desmos 3D & WebGL Híbrido)
- **Alternador de Modo 2D / 3D:** Seletor moderno no topo da tela para transitar suavemente entre o plano cartesiano 2D e o espaço tridimensional.
- **Câmera Orbital Arcball 3D (`src/graphics/camera3d.ts`):** Rotação com um dedo/mouse, translação (pan) com dois dedos/botão direito, zoom por pinça/scroll com Z apontando para cima e inversão matricial para raios de câmera.
- **Visual Inspirado no Desmos 3D:**
  - **Grade no Plano Principal $XY$ ($z = 0$):** Grade translúcida suave na altura zero de referência.
  - **Eixos RGB com Orientação Clara:** Vermelho (+X), Verde (+Y), Azul (+Z) com diferenciação visual entre o semieixo positivo (brilhante/sólido) e negativo (translúcido/discreto).
  - **Caixa Cúbica Delimitadora:** Delimitação $[-5, 5]^3$ para enquadramento perfeito de superfícies.
- **Superfícies Explícitas $z = f(x, y)$ com Shading Dual-Tone:** Malha indexada com iluminação bilateral Phong e diferenciação entre a face externa (cor vibrante da expressão) e a face interna (tom contrastante mais escuro), conferindo volume real e eliminação do efeito casca oca.
- **Equações Implícitas 3D $F(x, y, z) = 0$ via Raymarching:** Shader volumétrico analítico na GPU que acha a superfície por bissecção binária com cálculo de normais por diferenças centrais $\nabla F = (\partial_x F, \partial_y F, \partial_z F)$. Plota esferas ($x^2 + y^2 + z^2 = 9$), hiperboloides ($x^2 + y^2 - z^2 = 1$), toros, superfícies de sela ($xy = z$), paraboloides e equações de produtos múltiplos ($xz = y$, $y^2 = xz$, $x^2 = \frac{yz}{2}$).
- **Curvas Espaciais Paramétricas 3D:** Traçado contínuo no espaço para $(x(t), y(t), z(t))$ (como hélices cônicas ou atratores).

---

## 🧠 Fluxo de Execução do Sistema

1. **Entrada do Usuário:** O componente `<math-field>` capta as edições e gera o código ASCII-Math/LaTeX com atalhos inteligentes (sem circunflexo visível, parênteses e frações automáticas).
2. **Higienização (`cleanStr`):** Corrige operadores, converte frações LaTeX/AsciiMath para notação funcional, normaliza plicas e subscritos de funções (`f_1`, `f_{jose}`), e extrai condições de domínio `{condição}`.
3. **Classificação e Árvore Sintática (`PrattParser` & `Tokenizer`):**
   - Expande multiplicações implícitas universais entre letras e variáveis (`xz`, `yz`, `xy`, `2xz`).
   - Se for definição de variável escalar $\implies$ cria slider dinâmico.
   - Se for definição de função mono ou multivariável ($f(x)$, $f(x, y)$, $f(x, y, z, \dots)$) $\implies$ registra em `compiledFuncs`, mapeia para o Giac e plota se aplicável.
   - Se for EDO $\implies$ compila o campo vetorial conectando variáveis livres ao escopo de sliders.
   - Se for comando CAS puro $\implies$ envia ao Giac Worker assíncrono.
   - Se for equação implícita $\implies$ envia para o pipeline GLSL do WebGL (2D ou 3D raymarching).
4. **Render Loop (`drawFrame`):** A 60 FPS, o WebGL rasteriza as superfícies e equações implícitas na camada 3D/2D com shading Phong bilateral e controle de profundidade, desenhando eixos e grades nítidos no topo.

---
*Este ficheiro serve como documentação de referência central da arquitetura e das capacidades do Motor-Calc.*
