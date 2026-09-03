# Walkthrough: Motor Gráfico 3D (WebGL2 & Raymarching GPU) com Alternador 2D / 3D

O **Motor-Calc** agora conta com um motor gráfico tridimensional de alta performance com alternador de modo **[ 2D | 3D ]**, iluminação Phong bilateral, colormaps dinâmicos e **Raymarching volumétrico na GPU** para equações implícitas 3D sem triangulação na CPU.

O novo build (`index-CBmFge-h.js`, commit `08f82bc`) já se encontra **100% ativo em produção** na Vercel: [https://motorzaoo.vercel.app/](https://motorzaoo.vercel.app/).

---

## 🚀 O que foi Implementado

### 1. Alternador de Modo `[ 2D | 3D ]`
- Posicionado no canto superior esquerdo da tela do gráfico (visível em computadores e celulares).
- **Modo 2D:** Exibe o Canvas 2D + WebGL 2D com pan, zoom independente por eixo e todas as ferramentas cartesianas clássicas.
- **Modo 3D:** Oculta a camada 2D e ativa o `<canvas id="canvas3d">`, inicializando o espaço tridimensional com caixa delimitadora e eixos RGB.
- **Transição Transparente:** Todas as expressões escritas na barra lateral continuam salvas e ativas, adaptando-se ao modo selecionado.

### 2. Câmera Orbital Arcball 3D (`src/graphics/camera3d.ts`)
- **Rotação Suave:** Arrastar com um dedo (no celular) ou com o botão esquerdo (no mouse) gira a cena em coordenadas esféricas (azimute $\theta$, elevação $\phi$). A elevação é travada entre $-85^\circ$ e $+85^\circ$ para evitar o clássico *Gimbal Lock*.
- **Translação (Pan Espacial):** Dois dedos (no celular) ou botão direito / `Shift` + clique (no mouse) movem o centro da cena pelo espaço.
- **Zoom Fluido:** Gesto de pinça no celular ou roda de rolagem (*wheel*) no mouse.
- **Orientação com Z para Cima:** Alinhado com a convenção de cálculo e engenharia ($Z$ é a altura).
- **Matrizes $4 \times 4$:** Cálculo interno de `viewMatrix`, `projMatrix`, `viewProjMatrix` e a inversa `invViewProjMatrix` para cálculo de raios nos shaders.

### 3. Caixa Delimitadora & Eixos RGB
- Cubo de referência delimitado $[-5, 5]^3$ com linhas finas e discretas.
- Linhas de grade no plano de solo ($z = -5$).
- **Eixos clássicos coloridos em RGB:**
  - **Eixo X:** Vermelho (`#ef4444`)
  - **Eixo Y:** Verde (`#22c55e`)
  - **Eixo Z:** Azul (`#3b82f6`)

### 4. Superfícies Explícitas $z = f(x, y)$
- Malha indexada ($64 \times 64$ quads, $8320$ triângulos) atualizada em tempo real a 60 FPS conectada a sliders.
- **Iluminação Phong Bilateral:** Brilho especular e luz difusa visíveis em ambos os lados da superfície (`gl_FrontFacing`).
- **Colormap Dinâmico:** Gradiente de cores vibrantes com base na coordenada $z$ (azul frio nas depressões $\to$ turquesa $\to$ amarelo dourado $\to$ vermelho nos picos).
- **Exemplos suportados:**
  - $z = x^2 - y^2$ (Paraboloide hiperbólico / Sela)
  - $z = \sin(x) \cos(y)$
  - $z = \cos(\sqrt{x^2 + y^2})$ (Ondas concêntricas)
  - Funções multivariáveis declaradas como $f(x, y) = \dots$

### 5. Equações Implícitas 3D $F(x, y, z) = 0$ via Raymarching
- Executado **100% na GPU** através de Fragment Shaders analíticos (zero triangulação e zero sobrecarga na CPU).
- Marcha raios da câmera reconstruídos via `invViewProjMatrix` através da caixa delimitadora e refina o ponto de contato por bissecção binária.
- Cálculo de normais na GPU via gradiente numérico (diferenças centrais $\nabla F = (\partial_x F, \partial_y F, \partial_z F)$) para sombreamento realista.
- **Exemplos suportados:**
  - $x^2 + y^2 + z^2 = 9$ (Esfera 3D perfeita)
  - $x^2 + y^2 - z^2 = 1$ (Hiperboloide de 1 folha)
  - $z^2 = x^2 + y^2$ (Cone duplo)
  - $x^4 + y^4 + z^4 = 16$ (Superfície quártica)

### 6. Curvas Paramétricas Espaciais 3D
- Suporte a pares ordenados tridimensionais $(x(t), y(t), z(t))$.
- **Exemplos suportados:**
  - $(\cos(t), \sin(t), t)$ (Hélice cilíndrica espacial)
  - $(t \cos(t), t \sin(t), t)$ (Hélice cônica)

---

## 🧪 Como Testar no Site ao Vivo

1. Acesse **[https://motorzaoo.vercel.app/](https://motorzaoo.vercel.app/)**;
2. No topo esquerdo do gráfico, clique no botão **`3D`**;
3. Digite qualquer uma das seguintes equações para ver a mágica da GPU:
   - Superfície explícita: `z = x^2 - y^2`
   - Superfície ondulada: `z = sin(x) * cos(y)`
   - Esfera implícita: `x^2 + y^2 + z^2 = 9`
   - Hiperboloide implícito: `x^2 + y^2 - z^2 = 1`
   - Curva no espaço: `(cos(t), sin(t), t)`
4. Gire a cena arrastando com o dedo ou mouse, use o scroll/pinça para dar zoom e aperte o botão de casinha (Home) para repor a vista!
