# Pepilene — Continuação do Roadmap

## Próximo passo: Fases 1 a 4 do motor de projeto

A partir daqui, o desenvolvimento deve começar sem Google Maps, Solar API ou inteligência artificial. O primeiro objetivo é construir um núcleo determinístico que receba uma imagem, uma escala, os limites úteis do telhado e os obstáculos, e devolva uma projeção verificável dos módulos fotovoltaicos.

A regra central é simples:

> **O sistema não deve “adivinhar” o projeto. Ele deve calcular o projeto a partir de geometria explícita, parâmetros configuráveis e regras que possam ser auditadas pelo projetista.**

## FASE 1 — Importação e calibração da imagem

O usuário fará o upload da imagem do telhado ou da planta utilizada na demonstração comercial. A imagem deverá permanecer como camada de fundo, sem ser alterada, e o sistema criará sobre ela as camadas vetoriais do projeto.

O primeiro dado obrigatório será a escala. O usuário poderá informar a escala por uma distância conhecida — por exemplo, a largura real de uma parede — marcando dois pontos na imagem e digitando a medida em metros. O sistema calculará então a relação entre pixels e metros:

```text
metros_por_pixel = distancia_real_em_metros / distancia_marcada_em_pixels
pixels_por_metro = 1 / metros_por_pixel
```

Também deve ser possível cadastrar a escala diretamente quando a imagem já possuir uma referência conhecida. A calibração não deve depender de OCR nem de visão computacional na primeira versão.

O resultado da Fase 1 será um objeto semelhante a este:

```json
{
  "image": {
    "file": "telhado-original.png",
    "width_px": 2400,
    "height_px": 1600
  },
  "scale": {
    "meters_per_pixel": 0.025,
    "pixels_per_meter": 40.0,
    "reference": {
      "point_a": [320, 540],
      "point_b": [1120, 540],
      "real_distance_m": 20.0
    }
  }
}
```

O sistema deverá exibir uma régua de conferência. Se o projetista desenhar uma linha de 20 metros e a régua visual não corresponder à referência informada, o projeto deverá ser marcado como não calibrado.

## FASE 2 — Desenho das áreas úteis do telhado

Depois da calibração, o projetista desenhará cada área onde os módulos podem ser instalados. A geometria deve ser armazenada como um polígono, e não apenas como um retângulo, porque telhados do tipo caixote podem conter recuos, quinas, corredores e áreas irregulares.

Cada área útil deverá ter os seguintes atributos:

| Campo | Descrição |
|---|---|
| `id` | Identificador único da área |
| `name` | Nome visível, como `Telhado frontal` ou `Telhado fundos` |
| `polygon_px` | Vértices em coordenadas de imagem |
| `polygon_m` | Vértices convertidos para metros |
| `azimuth_deg` | Orientação da área, quando conhecida |
| `tilt_deg` | Inclinação da área, quando conhecida |
| `allowed_orientations` | Orientações permitidas dos módulos |
| `margin_m` | Afastamento mínimo das bordas |
| `active` | Indica se a área participa do cálculo |

A conversão para metros deverá usar a mesma origem e o mesmo eixo de coordenadas da imagem. Como a imagem possui o eixo Y crescente para baixo, o sistema deve manter essa convenção internamente ou convertê-la de maneira consistente; o importante é não misturar os dois sistemas em etapas diferentes.

Antes de calcular o encaixe, o programa aplicará um recuo de segurança nas bordas. Esse recuo deverá ser configurável por área. Não se deve alterar permanentemente o polígono desenhado pelo usuário: o sistema deve conservar o polígono original e criar uma segunda geometria chamada `usable_polygon`.

```text
usable_polygon = shrink(original_polygon, margin_m)
```

Se o recuo eliminar completamente a área, o sistema deverá exibir um erro claro, informando que a área útil ficou menor que o afastamento mínimo configurado.

## FASE 3 — Cadastro do módulo RENEPV de 680 W

O módulo de 680 W deve ser tratado como um item de catálogo, com dimensões confirmadas pelo usuário ou pela ficha técnica do modelo exato. Como diferentes módulos de mesma potência podem ter dimensões distintas, o sistema não deve fixar uma medida definitiva no código.

O cadastro mínimo será:

```json
{
  "module": {
    "brand": "RENEPV",
    "model": "680W",
    "power_w": 680,
    "width_m": 2.384,
    "height_m": 1.303,
    "thickness_m": 0.035,
    "gap_m": 0.020,
    "quantity_target": 18,
    "rotation_allowed": true
  }
}
```

Os valores de `width_m` e `height_m` acima são apenas exemplos de estrutura e não devem ser considerados a dimensão oficial do módulo sem confirmação da ficha técnica. O sistema deverá permitir editar esses campos antes do primeiro cálculo.

O vão entre módulos também precisa ser parametrizado. A largura efetiva ocupada pelo conjunto será calculada assim:

```text
largura_do_conjunto = colunas * largura_do_modulo
                    + (colunas - 1) * gap_m

altura_do_conjunto = linhas * altura_do_modulo
                    + (linhas - 1) * gap_m
```

Quando a rotação de 90 graus estiver habilitada, o motor deverá testar as duas possibilidades e comparar os resultados.

## FASE 4 — Cadastro dos obstáculos e áreas proibidas

Obstáculos são todos os elementos que impedem ou desaconselham a instalação, incluindo caixa d’água, chaminé, antena, claraboia, acesso de manutenção, borda técnica e áreas sombreadas definidas manualmente.

Cada obstáculo deverá ser desenhado como polígono e possuir uma margem própria. A geometria final de exclusão será:

```text
forbidden_polygon = union(
    obstacle_polygon_1_with_margin,
    obstacle_polygon_2_with_margin,
    ...
)
```

O motor não poderá aceitar um módulo se qualquer parte do retângulo do módulo tocar uma área proibida. O critério deve ser geométrico, e não baseado somente no ponto central do módulo.

Um exemplo de obstáculo:

```json
{
  "id": "obstaculo-01",
  "type": "caixa_dagua",
  "name": "Caixa d'água",
  "polygon_px": [[1450, 420], [1630, 420], [1630, 610], [1450, 610]],
  "safety_margin_m": 0.80,
  "excluded": true
}
```

## Primeiro motor de encaixe

A primeira versão deverá usar uma busca determinística por grade. O motor percorrerá a área útil em posições sucessivas, testando cada módulo contra as bordas e os obstáculos. Essa abordagem é simples, previsível e suficiente para validar o conceito com os 18 módulos.

O fluxo recomendado é:

```text
1. Carregar a imagem e a escala.
2. Converter a área útil de pixels para metros.
3. Aplicar o recuo de borda.
4. Expandir os obstáculos com suas margens.
5. Escolher a orientação do módulo.
6. Percorrer a área em uma grade com passo configurável.
7. Testar se o retângulo do módulo está totalmente dentro da área útil.
8. Testar se o retângulo não intercepta obstáculos.
9. Aceitar o módulo quando os dois testes forem verdadeiros.
10. Repetir até atingir a quantidade solicitada ou esgotar a área.
11. Testar a orientação alternativa.
12. Comparar as soluções e apresentar a melhor.
```

O critério de escolha inicial pode ser:

```text
pontuação = módulos_instalados * 100000
          - área_ociosa_em_m²
          - deslocamento_total_da_grade
```

A prioridade absoluta será instalar a quantidade desejada sem violar a geometria. Portanto, uma solução com 18 módulos sempre será superior a uma solução com 17, mesmo que a segunda ocupe uma área visualmente mais compacta.

## Pseudocódigo do núcleo

```python
def gerar_layout(area, obstaculos, modulo, quantidade_alvo, margem_borda):
    area_util = reduzir_poligono(area, margem_borda)
    obstaculos_expandidos = [
        expandir_poligono(o.polygon, o.safety_margin)
        for o in obstaculos
    ]

    candidatos = []

    for orientacao in orientacoes_permitidas(modulo):
        retangulo = dimensoes_orientadas(modulo, orientacao)

        for y in varrer_y(area_util, passo=0.05):
            for x in varrer_x(area_util, passo=0.05):
                painel = criar_retangulo(x, y, retangulo)

                dentro_da_area = contem(area_util, painel)
                colide_com_obstaculo = any(
                    intercepta(painel, obstaculo)
                    for obstaculo in obstaculos_expandidos
                )

                if dentro_da_area and not colide_com_obstaculo:
                    candidatos.append(painel)

        layout = selecionar_sem_sobreposicao(
            candidatos,
            quantidade_alvo
        )
        registrar_solucao(orientacao, layout)

    return escolher_melhor_solucao()
```

Na implementação real, recomenda-se utilizar uma biblioteca geométrica robusta para operações de polígono, interseção, união e redução. O motor deve retornar não apenas a lista de módulos, mas também os motivos de rejeição dos candidatos, para que o projetista consiga entender por que determinada região não foi utilizada.

## Resultado esperado da primeira entrega

A primeira entrega do Pepilene deverá permitir que o usuário carregue uma imagem, calibre uma distância, desenhe uma área útil, desenhe obstáculos, informe as dimensões do módulo RENEPV de 680 W e solicite 18 unidades. Ao pressionar **Calcular layout**, o sistema deverá desenhar os módulos sobre a imagem, exibir a potência total de 12,24 kWp e informar quantos módulos foram encaixados.

| Indicador | Cálculo inicial |
|---|---:|
| Potência unitária | 680 W |
| Quantidade solicitada | 18 módulos |
| Potência total | 12.240 Wp / 12,24 kWp |
| Área ocupada | Calculada pelas dimensões e pelo espaçamento |
| Módulos encaixados | Resultado do motor |
| Módulos não encaixados | Quantidade solicitada menos quantidade instalada |
| Status | `Aprovado`, `Parcial` ou `Impossível` |

## Critérios de aceitação

O protótipo será considerado correto quando nenhum módulo ultrapassar a área útil, nenhum módulo interceptar um obstáculo e o sistema reproduzir a mesma solução ao receber exatamente os mesmos dados. O resultado também deverá continuar correto quando a área for desenhada como um polígono irregular, quando a rotação for alterada e quando a quantidade solicitada for maior que a capacidade do telhado.

A interface deve permitir mover, editar e excluir áreas, obstáculos e módulos antes da confirmação. O projetista deve poder substituir o resultado automático por um arranjo manual, mas o sistema deverá informar visualmente quando uma alteração manual violar uma regra geométrica.

## O que não deve ser feito ainda

Nesta primeira etapa, não devemos chamar a Google Solar API, não devemos tentar reconhecer automaticamente o telhado pela imagem e não devemos deixar uma IA decidir a posição final dos módulos. Essas funções entram depois que o núcleo determinístico estiver testado.

A sequência correta é:

```text
geometria confiável
    ↓
layout reproduzível
    ↓
integração geográfica
    ↓
sombreamento e dados solares
    ↓
IA para acelerar o desenho e sugerir alternativas
```

A IA poderá sugerir uma área ou detectar uma caixa d’água no futuro, mas a decisão final continuará passando pelo mesmo motor geométrico. Assim, o Pepilene terá uma camada inteligente sem perder rastreabilidade técnica.

## Próxima etapa imediata

Com as Fases 1 a 4 definidas, a próxima tarefa prática é criar um protótipo visual mínimo com quatro telas: **Importar imagem**, **Calibrar escala**, **Desenhar áreas e obstáculos** e **Calcular layout**. Depois que esse fluxo funcionar com a imagem real da casa, serão realizados testes com diferentes margens, rotações e posições dos 18 módulos.

Somente após esses testes o projeto deverá avançar para o catálogo completo, a distribuição otimizada e a integração com Google Maps e Google Solar API.
