# Pepilene — Melhoria Visual do Telhado e Integração ao Programa

## 1. Objetivo

Este documento deve ser entregue à IA responsável pelo desenvolvimento do Pepilene. A missão é incorporar ao programa existente um módulo que melhore a apresentação visual da imagem do telhado, mantendo intactos os dados técnicos, a escala, os obstáculos e o layout calculado dos módulos.

A melhoria tem finalidade comercial e de comunicação com o cliente. Ela deve tornar a imagem mais limpa, legível e profissional, mas não pode transformar uma simulação em um levantamento técnico nem permitir que a IA invente ou desloque elementos do projeto.

> **O motor geométrico decide a posição dos módulos. A camada visual apenas melhora a apresentação e reaplica o layout técnico calculado pelo sistema.**

## 2. Regra de preservação técnica

A imagem original e todos os dados geométricos devem permanecer disponíveis. A versão aprimorada será uma nova camada ou nova versão, nunca uma substituição destrutiva.

| Elemento | Regra obrigatória |
|---|---|
| Imagem original | Deve ser preservada e recuperável a qualquer momento |
| Contorno do telhado | Não pode ser deslocado, redimensionado ou inventado |
| Áreas úteis | Devem continuar coincidentes com os polígonos do projeto |
| Obstáculos | Não podem ser removidos, ocultados ou transformados |
| Escala | Deve permanecer válida na imagem final |
| Módulos | Devem ser renderizados pelo Pepilene a partir do layout calculado |
| Quantidade | Deve ser exatamente a quantidade do layout, sem módulos gerados pela IA |
| Posição e rotação | Devem permanecer iguais antes e depois da melhoria |
| Cotas | Devem usar os valores reais do projeto |
| Aviso comercial | A composição deve indicar que é uma simulação visual |

A IA visual poderá melhorar iluminação, contraste, nitidez, cores, textura aparente e redução de ruído. Ela não poderá redesenhar a cobertura, apagar uma caixa d’água para abrir espaço, alterar uma parede, adicionar módulos ou modificar a perspectiva de forma que o overlay técnico deixe de coincidir.

## 3. Modos de visualização

O módulo deverá oferecer três modos. O modo padrão será `presentation`.

| Modo | Finalidade | Comportamento |
|---|---|---|
| `technical` | Plantas, desenhos e imagens com escala | Limpeza, contraste e nitidez moderados; preserva linhas e marcações |
| `presentation` | Proposta comercial para o cliente | Melhora iluminação, cores, legibilidade e acabamento sem alterar a geometria |
| `photorealistic` | Fotografia aérea ou imagem realista | Corrige aparência e ruído mantendo perspectiva, obstáculos e formas existentes |

Se o usuário não escolher um modo, usar `presentation`. Quando a imagem for uma planta ou captura de tela, o sistema deve sugerir `technical` para evitar que um tratamento fotográfico esconda informações importantes.

## 4. Arquitetura de camadas

O programa deve manter as seguintes camadas separadas:

```text
Imagem original
    ↓
Imagem visualmente aprimorada
    ↓
Máscara do telhado e áreas úteis
    ↓
Obstáculos e áreas proibidas
    ↓
Módulos calculados pelo motor geométrico
    ↓
Cotas, escala e informações técnicas
    ↓
Composição final para apresentação
```

A IA nunca deve desenhar os módulos diretamente na imagem. O Pepilene deve reaplicar os módulos como objetos vetoriais, sprites ou elementos renderizados pelo próprio programa, utilizando as coordenadas que já existem no layout.

Estrutura recomendada para o resultado:

```json
{
  "visualization": {
    "id": "viz-uuid",
    "project_id": "project-uuid",
    "source_image_id": "image-uuid",
    "layout_id": "layout-uuid",
    "mode": "presentation",
    "enhanced_image_url": "...",
    "roof_mask_url": "...",
    "module_overlay_url": "...",
    "technical_overlay_url": "...",
    "composite_preview_url": "...",
    "status": "completed",
    "is_current": true
  }
}
```

## 5. Fluxo de processamento

### 5.1 Validar o projeto

Antes de melhorar a imagem, verificar se existe uma imagem original válida, escala calibrada e áreas úteis. Se houver um layout, carregar também os módulos e obstáculos vinculados a ele.

Se não houver layout, permitir a melhoria preliminar da imagem, mas informar claramente: **“Imagem aprimorada sem layout técnico confirmado.”**

### 5.2 Preparar as máscaras

A máscara do telhado deve ser fornecida pelo projetista ou derivada das áreas desenhadas no Pepilene. A detecção automática por IA poderá apenas sugerir uma máscara, que deverá ser editável e confirmada pelo usuário.

Usar três estados:

```text
telhado_confirmado
área_incerta
fora_do_telhado
```

Não aplicar alterações fortes em áreas classificadas como `área_incerta` sem mostrar um aviso ao usuário.

### 5.3 Aplicar a melhoria visual

Usar a imagem original, as máscaras e o modo selecionado. A instrução interna para o módulo visual deverá seguir este princípio:

```text
Edite a imagem fornecida apenas para melhorar sua apresentação.
Preserve exatamente o contorno do telhado, a perspectiva, as construções,
os obstáculos, as áreas desenhadas, a escala visual e as marcações técnicas.
Melhore somente iluminação, contraste, nitidez, redução de ruído, equilíbrio
de cores e legibilidade da superfície. Não adicione, remova ou mova caixas
d’água, chaminés, antenas, paredes, módulos ou novas áreas de telhado.
O resultado continua sendo uma simulação visual baseada na imagem original.
```

Evitar explicitamente:

```text
Não converter uma planta em uma fotografia quando o modo for technical.
Não remover obstáculos para criar espaço.
Não inserir módulos inexistentes.
Não alterar a quantidade solicitada.
Não modificar a escala ou a perspectiva de forma incompatível.
Não criar árvores, prédios, sombras ou estruturas que não existiam.
Não ocultar cotas, linhas ou avisos obrigatórios.
```

### 5.4 Reaplicar o layout

Após a melhoria, reaplicar os módulos usando o layout do Pepilene. O layout não deve ser recalculado pela IA visual.

Cada módulo deve conservar dados semelhantes a estes:

```json
{
  "id": "module-01",
  "row": 1,
  "column": 1,
  "polygon_m": [[...]],
  "polygon_px": [[...]],
  "rotation_deg": 0,
  "power_w": 680,
  "status": "valid"
}
```

A apresentação pode usar uma aparência realista de painel, mas deve existir uma visualização técnica em que os limites geométricos sejam facilmente conferidos.

## 6. Integração ao programa existente

A IA de desenvolvimento deve primeiro inspecionar o código atual. Não deve criar um segundo aplicativo nem substituir o motor geométrico.

Localizar no projeto:

| Componente | Alteração esperada |
|---|---|
| Importação de imagem | Adicionar ação **Melhorar apresentação** |
| Modelo de projeto | Registrar imagem original e versões aprimoradas |
| Modelo de layout | Reutilizar coordenadas, rotações e quantidade |
| Serviço de renderização | Compor fundo, módulos, obstáculos e cotas |
| API ou serviço de processamento | Executar a melhoria com tratamento de erros |
| Armazenamento | Salvar original, aprimorada, máscaras e prévias |
| Tela de visualização | Adicionar comparação entre versões |
| Exportação | Permitir proposta comercial e vista técnica |

A integração deve ser isolada por uma interface clara, para que o mecanismo visual possa ser trocado no futuro sem alterar o motor geométrico.

## 7. Contrato de integração

Criar uma operação equivalente a:

```text
enhanceRoofImage(projectId, options) -> VisualizationResult
```

Entrada:

```json
{
  "project_id": "project-uuid",
  "source_image_id": "image-uuid",
  "layout_id": "layout-uuid",
  "mode": "presentation",
  "preserve_technical_overlays": true,
  "include_dimensions": true,
  "include_obstacles": true,
  "include_watermark": false
}
```

Saída:

```json
{
  "status": "completed",
  "visualization_id": "viz-uuid",
  "enhanced_image_url": "...",
  "composite_preview_url": "...",
  "technical_preview_url": "...",
  "warnings": [],
  "quality": {
    "geometry_preserved": true,
    "layout_reapplied": true,
    "source_available": true
  }
}
```

Se o processamento visual falhar, o programa deve continuar funcionando com a imagem original e o layout técnico. A falha estética não pode bloquear o cálculo nem apagar dados.

## 8. Interface do usuário

Na tela de visualização do layout, adicionar o botão **Melhorar apresentação**. O usuário deverá selecionar o modo visual e definir quais informações ficarão visíveis.

Controles recomendados:

| Controle | Função |
|---|---|
| Melhorar apresentação | Gera a nova versão visual |
| Modo técnico | Exibe tratamento discreto e preserva marcações |
| Modo apresentação | Exibe acabamento comercial |
| Mostrar módulos | Liga ou desliga a camada dos módulos |
| Mostrar obstáculos | Liga ou desliga obstáculos e afastamentos |
| Mostrar cotas | Liga ou desliga medidas e escala |
| Comparar original | Alterna ou divide a visualização |
| Restaurar original | Exibe a fonte sem apagar versões geradas |
| Exportar apresentação | Gera a composição final para proposta |

Ocultar uma camada altera apenas a visualização. Não altera as regras geométricas nem exclui os dados do projeto.

## 9. Composição final

A exportação deve ser composta nesta ordem:

```text
1. Imagem original ou aprimorada
2. Realce discreto da área do telhado
3. Módulos renderizados pelo Pepilene
4. Obstáculos e afastamentos, quando habilitados
5. Cotas, escala e orientação, quando habilitadas
6. Legenda com quantidade e potência
7. Aviso de simulação visual
```

A quantidade, a potência e as dimensões devem vir dos dados reais do projeto. Para 18 módulos de 680 W, o sistema deve calcular 12,24 kWp; essa informação não deve ser escrita ou calculada pela IA de imagem.

Adicionar uma indicação discreta:

```text
Simulação visual baseada no layout calculado pelo Pepilene.
A instalação definitiva depende de vistoria e validação técnica.
```

## 10. Controle de versões

Cada imagem aprimorada deve estar vinculada à imagem original e ao layout utilizado. Se o usuário alterar escala, área útil, obstáculo ou módulo, a visualização anterior deve ser marcada como `outdated`.

```json
{
  "version": 3,
  "source_image_hash": "...",
  "layout_id": "layout-uuid",
  "mode": "presentation",
  "created_by": "user-or-ai",
  "created_at": "...",
  "is_current": true
}
```

A versão antiga poderá permanecer no histórico, mas nunca deve ser apresentada como a versão atual depois que a geometria mudar.

## 11. Testes obrigatórios

| Teste | Resultado esperado |
|---|---|
| Melhorar sem layout | Retorna imagem e avisa que não há layout confirmado |
| Melhorar com 18 módulos | Reaplica exatamente 18 módulos |
| Imagem com obstáculos | Obstáculos continuam presentes e identificáveis |
| Alternar modos | Coordenadas e quantidade permanecem iguais |
| Falha do processamento | Imagem original e layout técnico continuam disponíveis |
| Reprocessamento | Não duplica módulos nem versões ativas |
| Alteração da área útil | Visualização anterior fica desatualizada |
| Alteração do layout | Preview passa a usar o novo layout |
| Ocultar cotas | Apenas a camada de cotas fica invisível |
| Restaurar original | Fonte é exibida sem perda de dados |

O teste principal deve comparar, antes e depois, `polygon_px`, `polygon_m`, rotação, quantidade, potência e identificadores dos módulos. A imagem de fundo pode mudar visualmente; esses dados não podem mudar.

## 12. Ordem de implementação

A IA deve executar a integração na sequência abaixo:

```text
1. Inspecionar o código existente.
2. Localizar modelos de imagem, projeto e layout.
3. Criar o modelo de visualização e versionamento.
4. Separar original, aprimorada, máscaras e overlays.
5. Criar o serviço visual com fallback para a imagem original.
6. Reaplicar os módulos pelo motor geométrico.
7. Adicionar modos técnico, apresentação e comparação.
8. Criar testes de preservação geométrica.
9. Integrar exportação à proposta existente.
10. Refinar a aparência da interface somente depois dos testes.
```

## 13. Prompt para a IA de desenvolvimento

```text
Incorpore ao Pepilene existente um módulo de melhoria visual para imagens de telhados.
Não crie um aplicativo separado e não substitua o motor geométrico.

Inspecione primeiro o código atual e localize o fluxo de importação, calibração, áreas úteis,
obstáculos, layout, visualização e exportação. Preserve a imagem original e crie versões
separadas para imagem aprimorada, máscaras, overlay técnico e composição final.

A melhoria visual pode corrigir iluminação, contraste, nitidez, cores e ruído. Não pode mover,
remover ou inventar telhados, paredes, obstáculos, cotas ou módulos. A IA de imagem não deve
desenhar módulos. Os módulos devem ser renderizados pelo Pepilene usando as coordenadas e os
dados do layout já calculado.

Adicione os modos technical, presentation e photorealistic, usando presentation como padrão.
Crie comparação entre original e aprimorada, controles para módulos, obstáculos e cotas, e
exportação com aviso de simulação visual.

Implemente fallback para a imagem original caso o processamento visual falhe. Crie testes que
comparem as coordenadas antes e depois da melhoria, garantindo a preservação da quantidade,
posição, rotação, potência e identificação dos módulos.

Não use números, textos ou potência gerados pela IA de imagem. Essas informações devem vir dos
dados reais do projeto. Ao terminar, informe os arquivos alterados, as estruturas adicionadas,
o modo de execução e os testes realizados.
```

## 14. Critérios de conclusão

O trabalho estará concluído quando o Pepilene conseguir importar e calibrar uma imagem, calcular um layout, gerar uma versão visualmente melhorada, reaplicar o layout sem deslocamentos e exportar uma apresentação comercial com comparação à imagem original.

O sistema também deve continuar funcional quando a melhoria visual falhar. O usuário deve conseguir consultar e editar a geometria, visualizar os obstáculos, conferir a escala e exportar uma versão técnica independentemente do serviço de aprimoramento.

A incorporação real ao código depende do projeto atual do Pepilene ou do repositório onde ele está sendo desenvolvido. Este documento define o comportamento, a arquitetura de integração, o contrato de dados e os testes que a IA deverá adaptar aos nomes reais dos arquivos, telas, rotas e componentes existentes.
