# Motor-Calc (Motor Gráfico Avançado)

Este documento descreve a arquitetura, as funcionalidades implementadas e o funcionamento geral do projeto **Motor-Calc**, uma calculadora gráfica e sistema de computação algébrica (CAS) na web, inspirada no Desmos e GeoGebra.

## 🛠️ Tecnologias Utilizadas
- **TypeScript & Vite:** Base do projeto para tipagem estática e bundling ultra-rápido.
- **MathLive:** Biblioteca responsável por providenciar o teclado matemático virtual e o campo de input (math-field), gerando o código LaTeX e ascii-math lindamente formatado.
- **Giac (WebAssembly):** O "cérebro" matemático do projeto. O Giac é um sistema de álgebra computacional poderoso (o mesmo motor usado em calculadoras HP Prime e no GeoGebra). Ele resolve equações, derivadas, integrais, matrizes e EDOs.
- **WebGL / Canvas API:** Motor de renderização (`renderer.ts`) construído do zero para plotar gráficos de forma performática utilizando a GPU (shaders) para equações implícitas e um avaliador adaptativo para curvas paramétricas e explícitas.

---

## ✨ Funcionalidades Já Implementadas

### 1. Sistema de Input e UI
- **Design Clean e Moderno:** Interface de utilizador refinada, inspirada no Desmos. Fundo branco, botões de exclusão e edição suaves.
- **Toggles Dinâmicos de Visibilidade:** Os números das equações ficam dentro de círculos cujas bordas adotam exatamente a mesma cor do gráfico correspondente. Clicar no círculo oculta a função (ficando tracejado).
- **Gestão de Múltiplas Expressões:** O utilizador pode adicionar múltiplas linhas de expressão com o botão `+ Adicionar Expressão`.

### 2. Plotagem e Gráficos (`MathEngine` e `Renderer`)
- **Gráficos Explícitos:** Suporte para funções da forma `f(x) = ...` ou `y = ...`.
- **Equações Implícitas:** O motor deteta equações como `x^2 + y^2 = 1` e compila-as diretamente para um shader GLSL no WebGL para uma visualização instantânea.
- **Inequações:** Sombreamento de áreas no gráfico quando se usam sinais como `<`, `>`, `<=`, `>=`.
- **Plotagem Adaptativa:** A amostragem de pontos aumenta em zonas de alta curvatura para garantir traços curvos suaves sem sacrificar desempenho (`generatePointsAdaptive`).

### 3. Computação Algébrica (Integração com Giac)
- **Cálculo Simbólico (CAS):** Deteta comandos como `Derivative`, `Integral`, `Simplify`, `Solve`, `Limit`, `Factor`, e passa-os perfeitamente para o motor WebAssembly do Giac.
- **Gráficos de Constantes e Derivadas:** Ao escrever `g(x) = Derivative(x,x)`, o sistema simplifica no Giac (resultando em `1`) e força o desenho do gráfico correspondente à solução.
- **Matrizes e Álgebra Linear:**
  - Definição de matrizes do tipo `M = {{1, 2}, {3, 4}}`.
  - Cálculos avançados entre matrizes (ex: `M * N`).
  - Equações envolvendo matrizes geram gráficos perfeitamente. Expressões como `M * N = 0` (quando contêm incógnitas como `x` e `y`) são enviadas primeiro ao Giac para obter a equação escalar reduzida e só depois plotadas no GPU.
  - Acesso direto aos índices de matrizes utilizando subscripts clássicos do LaTeX (ex: `M_{1,2}`). O sistema traduz de indexação matemática (1-indexed) para computacional interna (0-indexed) dinamicamente.
- **Sistema de Caching Avançado:** Impede que o Giac trave ou execute cálculos complexos todos os frames (60fps), armazenando o resultado de `M*N` em cache. Se a expressão não mudar, lê da memória.

### 4. Equações Diferenciais (EDOs) e Campos Vetoriais
- **Slope Fields (Campos de Direções):** Se escrevermos `campo(y') = x`, o sistema desenha as pequenas setas vetoriais na grelha demonstrando o comportamento do campo.
- **Resolução de EDOs Simbólicas:** Comandos para procurar a solução fechada de equações diferenciais enviando a configuração `desolve` ao Giac.

### 5. Variáveis Dinâmicas e Sliders
- Declaração de variáveis dinâmicas (ex: `a = 5`). O sistema atualiza em tempo real qualquer função dependente de `a` a 60 fps, sem precisar reconsultar a string original, injetando o novo valor diretamente na memória via `StateManager`.

---

## 🧠 Como o Código Funciona (Fluxo de Execução)

1. **Leitura (Input):** O `ExpressionManager` capta as alterações no componente `<math-field>` gerado pelo MathLive e extrai o `ascii-math` bruto.
2. **Limpeza e Tradução (`cleanStr`):** No `main.ts`, o `ascii` é limpo e higienizado. Símbolos malformados são corrigidos (ex: caracteres unicode invisíveis), plicas de derivadas são normalizadas, e a notação de índices matriciais `M_(1,2)` é convertida para notação do Giac `M[0,1]`.
3. **Parseamento (AST):** Se não for um comando 100% dependente do Giac, a string é lida pela classe `PrattParser` (uma árvore sintática abstrata).
4. **Decisão Gráfico vs Calculadora:** 
   - Se a string tiver `x` e `y` (ou se foi atribuída a uma função `f(x)`), entra em **Modo Gráfico**.
   - Se tiver referências a matrizes ou variáveis exclusivas do Giac, chama a função de simplificação assíncrona do Giac.
5. **Compilação GPU/CPU:** As árvores matemáticas são transformadas via `MathEngine.compile` numa função ultra-otimizada JavaScript ou num String Shader em GLSL para enviar para a placa gráfica.
6. **Render loop (`drawFrame`):** A função `requestAnimationFrame` corre constantemente, limpando o Canvas e pedindo ao `Renderer` para desenhar as grelhas, eixos, curvas e áreas implícitas usando as equações válidas do frame atual.

---
*Este ficheiro destina-se a servir como documentação "viva" de bordo e pode ser atualizado à medida que novas regras e capacidades sejam adicionadas.*
