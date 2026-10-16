# 🧠 Protocolo Mestre de Auditoria, Verificação Empírica e Engenharia Centrada no Usuário (Guia para IAs)

> **Propósito deste Documento:**
> Este arquivo foi escrito especificamente para **Agentes de IA e Engenheiros de Software** que trabalham no **Motor-Calc (`Motorzaoo`)**. Seu objetivo é eliminar o "teatro de código" (correções superficiais que passam em testes isolados mas quebram na mão do usuário) e ensinar o método exato de **auditoria forense, verificação empírica de ponta a ponta e programação centrada no usuário (Padrão Desmos)**.
>
> **REGRA OBRIGATÓRIA PARA QUALQUER IA:** Antes de declarar qualquer tarefa, refatoração ou correção de bug como "concluída", você **DEVE** executar todos os protocolos descritos neste documento.

---

## 🔍 Parte 1: Protocolo de Auditoria Forense de Código ("Anti-Ilusão")

Muitas IAs cometem o erro clássico de criar uma função nova, escrever um teste unitário que chama apenas aquela função isolada, ver o sinal verde (`PASS`) e declarar vitória — sem perceber que a função nunca foi conectada ao fluxo real ou que uma etapa anterior corrompe os dados antes de chegar nela.

Para auditar o código no nível mais alto de rigor, aplique sempre o **Checklist das 6 Armadilhas Mortais**:

### 1. A Armadilha do "Código Fantasma" (Dead Wiring Check)
Sempre que criar ou revisar uma classe, método ou função utilitária (ex.: `LatexNormalizer`, `PrattParser.parse()`, `CommandsGuideModal`), faça uma busca global (`grep`) por todas as chamadas no projeto:
* **Pergunta:** O método novo está sendo chamado em `src/main.ts` e `src/ui/expressionManager.ts`, ou apenas no arquivo de teste `scripts/verify-defensive.ts`?
* **Exemplo Real Ocorrido:** Foi criado o método `PrattParser.parse()` que valida tokens órfãos no final da expressão (`if (this.lookahead !== null) throw ...`). O teste unitário chamava `new PrattParser(t).parse()` e passava. Porém, **todos os 20+ pontos de chamada em `src/main.ts` e `src/ui/expressionManager.ts` continuavam chamando `.parseExpression()`**, tornando a correção 100% inativa em produção!

### 2. A Armadilha da Cascata de Regex (Order-of-Execution Audit)
Em qualquer pipeline de transformação de strings (`LatexNormalizer.normalize`, `formatForGiac`, `cleanStr`), **a ordem das expressões regulares é crítica**:
* **Nunca** avalie uma regex isoladamente. Trace o que acontece com uma string desde a linha 1 até o `return` final da função principal.
* **Pergunta:** Uma regra genérica (ex.: converter `X^{-1}` em `inv(X)` para matrizes) está rodando **antes** de uma regra específica (ex.: converter `\sin^{-1}(x)` em `asin(x)`)?
* **Exemplo Real Ocorrido:** `normalizeTrigPowers('\\sin^{-1}(x)')` funcionava quando chamado sozinho no teste. Mas dentro de `LatexNormalizer.normalize()`, uma regex anterior na linha 169 interceptava `([A-Za-z_]+)\^-1` e transformava `\sin^{-1}(x)` em `\inv(sin)(x)` antes de chegar na linha 195!

### 3. A Armadilha do Escopo Global vs. Contextual (Context-Free Regex Pollution)
* **Nunca** aplique transformações de Álgebra Linear (matrizes) ou comandos especiais a identificadores genéricos sem checar o contexto (`definedMatrixNames` ou case-sensitivity).
* **Exemplos Reais Ocorridos:**
  1. Usar regex case-insensitive (`/gi`) para transposta de matriz (`^T` $\to$ `tran(...)`) fez com que **qualquer potência com a variável escalar minúscula `t`** (como $e^t$ ou $x^t$) virasse `tran(e)` ou `tran(x)`!
  2. Converter qualquer `([A-Za-z_]+)\^-1` em `inv($1)` sem verificar se `$1` pertence a `definedMatrixNames` fez com que $y = x^{-1}$ ou $(x+1)^{-1}$ virasse `inv(x)` e falhasse com `"Erro: Matriz 'x' não definida"`, destruindo potências negativas escalares!

### 4. A Armadilha da Corrupção de Precedência Matemática
Quando reescrever funções sem parênteses via texto (ex.: `sin x` $\to$ `sin(x)`), verifique a **precedência de operadores da matemática padrão**:
* $\sin x^2 = \sin(x^2) \neq (\sin x)^2$
* $\sin^2 x = (\sin x)^2$
* $\cos 2x^2 = \cos(2x^2) \neq (\cos 2x)^2$
* $\sin x + 1 = (\sin x) + 1 \neq \sin(x + 1)$
* **Regra:** Se o `PrattParser` já possui suporte nativo a funções unárias com *binding power* calibrado (ex.: `parseExpression(19)`, abaixo de `^` que é `20` e acima de `*` que é `15`), **não deixe uma regex ingênua fechar parênteses antes do operador `^`** (transformando `cos x^2` em `cos(x)^2`).

### 5. A Armadilha da Conversão de Tipo Silenciosa (JS vs. GLSL / WebGL1)
* No JavaScript (CPU), `1 + 2` é `3.0`. No GLSL (WebGL1), `1` é `int` e `1.0` é `float`, e **não existe conversão implícita de `int` para `float`** nem operador `%` bitwise em floats.
* Toda geração de código em `GLRenderer.astToGLSL` e `Renderer3D` deve garantir que literais numéricos tenham ponto decimal (`1.0`), que comparações de inteiros em floats usem tolerância e `floor(mod(abs(x) + 0.5, 2.0))`, e que todos os *uniforms* dinâmicos (`u_var_<nome>`) sejam registrados no `usedUniforms` e enviados via `gl.uniform1f` a cada frame tanto no 2D quanto no Raymarching 3D.

### 6. A Armadilha de Perda de Estado em Re-Renders de DOM (`innerHTML`)
* Sempre que um componente de UI reconstrói seu HTML interno (em buscas, filtros de categoria, redimensionamento de matrizes ou atualização de lista de expressões), verifique:
  1. Os callbacks passados na inicialização (ex.: `onInsert` em `CommandsGuideModal`) foram salvos em estado persistente da classe?
  2. Os event listeners de filhos foram reatribuídos ou usam delegação de eventos?
  3. O foco do cursor do usuário foi preservado?

---

## 🧪 Parte 2: Protocolo de Testes Empíricos de Ponta a Ponta (End-to-End Pipeline)

**PROIBIÇÃO:** É estritamente proibido testar apenas funções auxiliares isoladas (`LatexNormalizer.normalizeTrigPowers` ou `LatexNormalizer.normalizeUnparenthesized`) e achar que o sistema funciona.

### Como Executar um Teste Empírico Real via CLI (`npx tsx`)
Sempre teste o **pipeline completo integrado**, exatamente na ordem em que `src/main.ts` e `src/ui/expressionManager.ts` executam quando o usuário digita:

```text
[1. String Bruta LaTeX / ASCII do MathLive]
       │
       ▼
[2. FaultTolerantParser.checkIncompleteStatus(raw)]  ──► Verifica avisos falsos ou faltantes
       │
       ▼
[3. FaultTolerantParser.detectFreeVariables(raw)]    ──► Verifica se cria sliders fantasmas (d, x, A)
       │
       ▼
[4. LatexNormalizer.normalize(ascii, latex, definedMatrices)] ──► String normalizada final
       │
       ▼
[5. new Tokenizer(normalized) ──► new PrattParser(t).parse()] ──► Árvore Sintática (AST)
       │
       ▼
[6A. MathEngine.compile(ast)(x, y, vars)]            ──► Avaliação numérica em pontos reais (ex: x=1.5)
[6B. GLRenderer.astToGLSL(ast, vars, uniforms)]      ──► Código GLSL válido para GPU 2D/3D
[6C. formatForGiac(normalized)]                      ──► Comando exato enviado ao motor CAS (Giac)
```

### Script de Diagnóstico Rápido (Execute sempre antes de commitar)
Sempre que alterar qualquer arquivo em `src/core/`, execute um comando `npx tsx -e` que passe uma bateria de entradas pela função principal `LatexNormalizer.normalize` seguida de `PrattParser` e `MathEngine.compile`, e **compare o valor numérico calculado com o valor matemático exato esperado**:

```bash
npx tsx -e "
import { LatexNormalizer } from './src/core/latexNormalizer';
import { Tokenizer } from './src/core/tokenizer';
import { PrattParser } from './src/core/prattParser';
import { MathEngine } from './src/core/mathEngine';

const engine = new MathEngine();
const cases = [
  { latex: '\\\\sin(x)', x: Math.PI/2, expected: 1 },
  { latex: '\\\\sin x', x: Math.PI/2, expected: 1 },
  { latex: '\\\\sin^2(x)', x: Math.PI/4, expected: 0.5 },
  { latex: '\\\\sin^2 x', x: Math.PI/4, expected: 0.5 },
  { latex: '\\\\cos x^2', x: 1.2, expected: Math.cos(1.44) },
  { latex: '\\\\sin^{-1}(0.5)', x: 0, expected: Math.asin(0.5) },
  { latex: 'x^{-1}', x: 2, expected: 0.5 },
  { latex: '(x+1)^{-1}', x: 1, expected: 0.5 },
  { latex: 'e^t', x: 1, vars: { t: 2 }, expected: Math.exp(2) },
];

for (const c of cases) {
  const norm = LatexNormalizer.normalize(c.latex, c.latex, new Set(['A', 'B']));
  const ast = new PrattParser(new Tokenizer(norm)).parse();
  const fn = engine.compile(ast);
  const actual = fn(c.x, 0, c.vars || {});
  const ok = Math.abs(actual - c.expected) < 1e-6;
  console.log(ok ? 'PASS' : 'FAIL', c.latex, '->', norm, 'val:', actual, 'exp:', c.expected);
}
"
```

---

## 🌪️ Parte 3: Protocolo de Testes Adversariais ("Chaos User Testing")

O usuário real **não é um programador**. Ele não sabe como o seu parser funciona por dentro. Ele digita rápido, omite parênteses, mistura maiúsculas e minúsculas, apaga metade da conta e espera que a calculadora entenda a matemática padrão como o Desmos.

Toda modificação no motor deve ser testada contra a **Matriz de Entradas Adversariais Obrigatórias**:

| Categoria | Entradas que o Usuário Vai Digitar | Armadilha Comum (O que NÃO pode acontecer) | Comportamento Esperado (Padrão Desmos) |
| :--- | :--- | :--- | :--- |
| **1. Funções sem parênteses** | `sin x`, `cos 2x`, `ln x`, `tan 3x + 1`, `sqrt x` | Dar `SyntaxError` exigindo `sin(x)` ou engolir o `+ 1` dentro do `tan(3x+1)`. | Avaliar $\sin(x)$, $\cos(2x)$, $\ln(x)$, $\tan(3x) + 1$, $\sqrt{x}$. |
| **2. Precedência Função vs. Potência** | `cos x^2`, `sin 2x^3`, `ln x^2` | Converter `cos x^2` em `cos(x)^2` (que vale $(\cos x)^2$). | Avaliar $\cos(x^2)$, $\sin(2x^3)$, $\ln(x^2)$ (potência liga mais forte que função prefixa). |
| **3. Potência no Nome da Função** | `\sin^2(x)`, `\sin^2 x`, `\cos^3 2x` | Inserir multiplicação implícita `sin * ^2(x)` ou falhar no parser. | Avaliar $(\sin(x))^2$, $(\cos(2x))^3$. |
| **4. Trigonométricas Inversas** | `\sin^{-1}(x)`, `\cos^{-1} x`, `\tan^{-1}(1)` | Converter `\sin^{-1}` em inversa de matriz `inv(sin)` ou $1/\sin(x)$. | Converter exclusivamente para `asin(x)`, `acos(x)`, `atan(1)`. |
| **5. Potências Negativas Escalares vs. Matrizes** | `x^{-1}`, `(x+1)^{-1}`, `2^{-1}` vs. `A^{-1}` (onde $A$ é matriz) | Transformar `x^{-1}` em `inv(x)` e exibir `"Matriz 'x' não definida"`. | Se a base está em `definedMatrixNames`, usar `inv(A)`. Caso contrário, manter potência escalar $x^{-1} = 1/x$. |
| **6. Expoente `t` vs. Transposta `^T`** | `e^t`, `x^t`, `2^t` vs. `A^T` (onde $A$ é matriz) | Converter `e^t` em `tran(e)` por causa de regex case-insensitive `/i`. | `^t` minúsculo é sempre potência na variável $t$. Apenas `A^T` (maiúsculo em matriz definida) é transposta `tran(A)`. |
| **7. Integrais e Diferenciais Colados** | `\int xdx`, `\int_0^1 x^2dx`, `\int \sin x dx`, `f(x) = \int_0^x t dt` | Reclamar que falta `dx` quando está colado (`xdx`), ou sugerir slider para `d` ou `t`. | Reconhecer `dx`/`dt` com ou sem espaço, bloquear sliders para variáveis mudas de integração, plotar $f(x)$ suavemente. |
| **8. Derivadas de Múltiplas Formas** | `\frac{d}{dx} x^2`, `\frac{d}{dx}(x^2)`, `f'(x)` | Sugerir slider para a letra `d` de `d/dx`, ou enviar string incompleta `x^` para o Giac gerando lixo `pnt[...]`. | Calcular derivada limpa ($2x$), nunca vazar a letra `d` como variável livre, filtrar estados de digitação incompletos. |
| **9. Case-Sensitivity Estrita** | Definir matriz $A$ e digitar `det(a)` ou `a + 1` | Fazer `det(a)` calcular o determinante da matriz $A$ maiúscula. | Diferenciar estritamente maiúsculas de minúsculas: `A` é a matriz, `a` é um escalar independente. |
| **10. Entradas Inválidas / Tokens Órfãos** | `1 2`, `x y` (com espaço sem operador onde ambíguo), `sin()`, `5 +` | Ignorar o `2` em `1 2` e retornar `= 1`, ou travar o app com exceção não tratada. | Em `5 +` ou `sin()`, exibir ícone de aviso amigável (`Expressão incompleta`) sem quebrar os demais gráficos da tela. |

---

## 🎨 Parte 4: Protocolo de Programação Centrada no Usuário (UX, HUD, PC & Mobile)

Quando programar qualquer interação visual ou comportamento de interface no Motor-Calc, siga estas leis inegociáveis:

### 1. Leis de Digitação e Foco (MathLive & Teclado)
* **Navegação 2D vs. Troca de Bloco (`ArrowUp` / `ArrowDown`):**
  * Expressões matemáticas são **bidimensionais** (frações têm numerador em cima e denominador embaixo; integrais têm limites em cima e embaixo; matrizes têm linhas; potências ficam no alto).
  * **Nunca** sequestre `ArrowUp` ou `ArrowDown` de forma cega no evento `keydown` para pular para o bloco de expressão anterior/seguinte se o cursor do MathLive ainda puder se mover verticalmente dentro da própria fração, potência ou matriz! Só mude de bloco quando o cursor já estiver na borda da expressão ou quando o MathLive não tiver para onde mover internamente.
* **Proibição de Duplo Disparo de Teclas (`^`, `_`, `/`, `(`):**
  * Nunca adicione listeners manuais de `keydown` que insiram `^` ou mudem o foco se o MathLive já faz isso nativamente. Isso causa o bug de "potência da potência" ($x^{\square^\square}$).
* **Seleção de Texto Legível:**
  * O fundo de seleção dentro do `<math-field>` deve ser sempre translúcido (`rgba(59, 130, 246, 0.25)`), nunca branco opaco que esconda os caracteres selecionados.

### 2. Leis de Exibição de Resultados (Padrão Desmos)
* **Alternância Fração / Decimal (`[a/b]`):**
  * Todo resultado numérico escalar (integrais definidas, determinantes, aritmética, funções avaliadas num ponto) deve exibir um único valor limpo acompanhado do botão interativo `[a/b]`.
  * Nunca mostre strings poluídas misturando os dois formatos ao mesmo tempo (como `= 3/2 ≈ 1.5`). Se o botão `[a/b]` estiver ativo, mostre $\frac{3}{2}$ renderizado em LaTeX; se inativo, mostre `= 1.5`.
* **Blindagem contra Lixo Simbólico do CAS:**
  * O Giac/Xcas ocasionalmente retorna representações internas (`pnt[...]`, ponteiros de memória, `undef`, mensagens de erro em C++). **Nenhum texto bruto do Giac pode chegar direto aos olhos do usuário** sem passar pelo filtro de sanitização e conversão para LaTeX limpo.

### 3. Leis de Ergonomia Mobile vs. Desktop (HUD & Touch)
* **Orçamento de Tela no Celular (Viewport Budget):**
  * Em telas `< 768px`, quando o teclado matemático virtual abre (~260px), a gaveta de expressões não pode ocupar 45% da tela ao mesmo tempo, senão o gráfico sobra com menos de 100px de altura. Garanta que o gráfico mantenha espaço útil e que a linha sendo editada faça `scrollIntoView` suave.
* **Áreas de Toque Mínimas (Hit Targets):**
  * Botões de cabeçalho (Desfazer, Refazer, Guia `?`, Engrenagem, Fechar) e botões de aviso (`.block-warning-trigger`) devem ter área clicável confortável e `stopPropagation()` no `touchstart` para que tentar tocar num botão não dispare o arraste (drag) da gaveta mobile.
* **Tooltips Acessíveis por Toque:**
  * No celular **não existe `:hover`**. Qualquer aviso de erro ou informação em ícone (`.block-warning-tooltip`) deve abrir ao clicar/tocar (`.force-visible`) e ter `white-space: normal` e `max-width` contido para nunca vazar para fora da borda esquerda/direita da tela.
* **Inspeção de Pontos Notáveis no Toque:**
  * Raízes, extremos locais e interceptos não podem depender apenas de `mousemove`. Um toque (`touchend` sem arraste) próximo à curva no celular deve fixar (*pin*) e exibir as coordenadas do ponto notável com raio de tolerância tátil adequado (`>= 24px`).

---

## ✅ Parte 5: O Ritual Final de Validação (Definition of Done)

Nenhuma IA pode encerrar sua resposta após alterar código sem ter executado e comprovado estas **4 etapas em sequência**:

1. **Auditoria de Conexão (`grep`):** Confirmar que todas as funções criadas/alteradas estão sendo chamadas pelos fluxos reais em `src/main.ts` e `src/ui/expressionManager.ts`.
2. **Teste Empírico do Pipeline Completo:** Rodar `npm test` (`npx tsx scripts/verify-defensive.ts`) **E** incluir no teste chamadas que passem por `LatexNormalizer.normalize` $\to$ `PrattParser.parse` $\to$ `MathEngine.compile` (nunca apenas helpers isolados).
3. **Verificação de Compilação Estrita:** Executar `npm run build` (`tsc && vite build`) e garantir **0 erros de TypeScript** e bundle limpo.
4. **Sincronização com Produção (Quando autorizado a alterar código):** Executar `git status`, `git diff` (revisando cada linha alterada para garantir que nada foi quebrado acidentalmente), `git commit` descritivo e `git push origin main`.
