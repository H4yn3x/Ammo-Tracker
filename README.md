# AGE Provisions Tracker

Modulo para **Foundry VTT** + **AGE System (VkDolea)**.

Sistema de acampamento e gerenciamento de provisoes para campanhas de Fantasy AGE. Transforma o descanso em um momento de roleplay coletivo, com niveis de conforto que impactam mecanicamente a recuperacao do grupo.

---

## Indice

1. [Instalacao](#instalacao)
2. [Visao Geral](#visao-geral)
3. [Provisoes](#provisoes)
4. [Painel de Acampamento](#painel-de-acampamento)
5. [Niveis de Conforto](#niveis-de-conforto)
6. [Contribuicoes](#contribuicoes)
7. [Efeitos Mecanicos](#efeitos-mecanicos)
8. [Breather](#breather)
9. [Comandos de Chat](#comandos-de-chat)
10. [Configuracoes](#configuracoes)

---

## Instalacao

No Foundry VTT, va em **Add-on Modules**, clique em **Install Module** e cole a seguinte URL no campo Manifest URL:

```
https://raw.githubusercontent.com/H4yn3x/age-ammo-tracker/main/module.json
```

Apos instalar, ative o modulo em **Manage Modules** dentro do seu World.

---

## Visao Geral

O modulo adiciona duas funcionalidades principais:

1. **Painel de Acampamento** -- Um painel que o Mestre abre quando o grupo decide descansar. Nele, o Mestre define o nivel de conforto do local, marca quais jogadores contribuiram para melhorar o descanso (com historias, cancoes, comida, oracoes, etc.), e finaliza o descanso aplicando todos os efeitos automaticamente.

2. **Consumo de Breather** -- Quando um personagem usa a mecanica de Breather do AGE System, o modulo consome automaticamente 1 unidade do item vinculado (bebida alcoolica, kit de cura, etc.).

---

## Provisoes

Antes de usar o sistema de acampamento, cada jogador deve vincular seus itens de provisao.

### Como vincular

1. Abra a ficha do personagem.
2. Clique no botao **Provisoes** (icone de talheres) no cabecalho da ficha.
3. Na janela que abrir, selecione:
   - **Racoes de Viagem** -- O item de comida que sera consumido durante o descanso longo.
   - **Suprimento de Breather** -- O item que sera consumido ao usar Breather (bebida alcoolica, kit de cura, ervas, etc.).
4. Clique em Salvar.

### Requisitos dos itens

Os itens vinculados devem ser do tipo **General Equipment** no AGE System e devem ter um campo de quantidade (o campo padrao do sistema). O modulo subtrai 1 da quantidade a cada consumo.

### Verificando provisoes

Use o comando `/provisoes` no chat para ver o estado atual das provisoes do personagem selecionado.

---

## Painel de Acampamento

O painel de acampamento e o centro do sistema de descanso. Apenas o Mestre pode abri-lo e opera-lo.

### Como abrir

- Clique no icone de acampamento na **barra de ferramentas de cena** (a barra lateral esquerda, na secao de tokens).
- Ou use o comando `/acampar` no chat.

### Elementos do painel

O painel exibe:

1. **Seletor de Conforto** -- Quatro botoes representando os patamares de conforto. O Mestre clica para selecionar o nivel atual. O patamar selecionado fica destacado com cor e borda.

2. **Resumo de Efeitos** -- Uma caixa mostrando os efeitos mecanicos do patamar selecionado: formula de cura, regras de fadiga e recuperacao de mana.

3. **Lista de Personagens** -- Todos os personagens de jogadores aparecem listados. Cada um mostra:
   - Um botao de estrela para marcar contribuicao (ver secao Contribuicoes).
   - O nome do personagem.
   - O estado das racoes vinculadas (nome do item e quantidade).

4. **Botao Finalizar Descanso** -- Aplica todos os efeitos e posta o relatorio no chat.

### Fluxo de uso

1. O grupo decide acampar. O Mestre abre o painel.
2. Os jogadores descrevem verbalmente o que fazem para contribuir: cozinhar, tocar musica, contar historias, rezar, etc.
3. O Mestre ajusta o nivel de conforto conforme as circunstancias e marca as contribuicoes.
4. O Mestre clica em **Finalizar Descanso**.
5. O modulo aplica cura, recupera mana, consome racoes, e posta um card detalhado no chat.

---

## Niveis de Conforto

O conforto determina o valor base da cura e afeta fadiga e mana. A formula de cura e:

**Cura = Base do Conforto + Constituicao + Nivel**

| Patamar | Base | Descricao |
|---|---|---|
| **Terrivel** | 0 | O pior cenario. Sem abrigo, perigo iminente, condicoes hostis. Masmorra, pantano, tempestade. Nenhuma cura ocorre. |
| **Rudimentar** | 5 | Descanso precario. Acampamento improvisado, chao duro, sem conforto. Ermos, caverna umida, floresta densa. |
| **Modesto** | 10 | O padrao do FAGE. Acampamento decente com tendas, fogueira, abrigo razoavel. Regras normais de Total Rest. |
| **Confortavel** | 15 | Condicoes excepcionais. Taverna acolhedora, mansao, banquete, cama macia. Cura acima do padrao. |

### Criterios sugeridos para o Mestre

O nivel de conforto nao e determinado apenas pelo local. E uma combinacao de ambiente, provisoes, clima e o esforco do grupo:

- **Ambiente hostil** tende a Terrivel ou Rudimentar, mas contribuicoes dos jogadores podem eleva-lo.
- **Taverna comum** tende a Modesto, mas comida especial e boa companhia podem eleva-lo a Confortavel.
- **Chuva sem abrigo** pode reduzir Modesto para Rudimentar.

O Mestre tem total liberdade para ajustar conforme a narrativa.

---

## Contribuicoes

O botao de estrela ao lado de cada personagem indica que aquele jogador contribuiu com algo para melhorar o descanso do grupo. Isso e puramente narrativo e fica a criterio do Mestre.

### Exemplos de contribuicoes

- Cozinhar uma refeicao saborosa
- Tocar uma cancao ou contar uma historia
- Fazer uma oracao ou ritual de protecao
- Abrir uma garrafa de vinho ou hidromel
- Montar um abrigo melhor
- Fazer a guarda para que os outros durmam tranquilos
- Cuidar dos ferimentos do grupo com ervas

### Efeito mecanico

As contribuicoes nao tem efeito mecanico automatico. Elas servem como indicador visual e narrativo. O Mestre deve leva-las em conta ao definir o nivel de conforto.

No card de chat final, os nomes dos personagens que contribuiram aparecem destacados.

---

## Efeitos Mecanicos

O descanso longo aplica tres categorias de efeitos, baseados no patamar de conforto:

### Cura (Health)

| Patamar | Formula |
|---|---|
| Terrivel | Sem cura (base 0) |
| Rudimentar | 5 + Constituicao + Nivel |
| Modesto | 10 + Constituicao + Nivel |
| Confortavel | 15 + Constituicao + Nivel |

A cura nunca ultrapassa o Health maximo do personagem.

### Fadiga

As regras seguem e expandem o Total Rest do FAGE 2e:

| Patamar | Efeito |
|---|---|
| Terrivel | Nao remove nenhuma condicao de Fadiga. |
| Rudimentar | Remove apenas Winded. |
| Modesto | Regra padrao do FAGE: remove Fadiga ate Tired. Exhausted cai para Tired. |
| Confortavel | Remove todas as condicoes de Fadiga, incluindo Exhausted. |

**Nota:** A remocao de condicoes de Fadiga nao e aplicada automaticamente pelo modulo, pois o AGE System no Foundry gerencia condicoes de forma variada. O card de chat informa qual e a regra, e o Mestre ou jogador deve aplicar manualmente.

### Magic Points

| Patamar | Efeito |
|---|---|
| Terrivel | Recupera apenas metade dos Magic Points (arredondando para baixo). |
| Rudimentar | Recupera apenas metade dos Magic Points (arredondando para baixo). |
| Modesto | Recupera todos os Magic Points (regra padrao do FAGE). |
| Confortavel | Recupera todos os Magic Points. |

A recuperacao de MP e aplicada automaticamente pelo modulo.

### Provisoes

Ao finalizar o descanso, o modulo consome automaticamente 1 unidade da racao vinculada de cada personagem que tiver provisoes configuradas. O card de chat mostra o consumo e a quantidade restante.

---

## Breather

O Breather e uma mecanica do FAGE que permite recuperar 5 + Constituicao + Nivel de Health apos um encontro. O modulo nao interfere na mecanica de cura do Breather, que e gerenciada pelo proprio AGE System.

O que o modulo faz e **consumir automaticamente 1 unidade do suprimento de Breather** vinculado ao personagem (bebida alcoolica, kit de cura, etc.) sempre que um Breather e detectado no chat.

### Deteccao

O modulo detecta o Breather pela mensagem que o AGE System posta no chat ao usar a funcao de Breather (que contem a palavra "Breather" ou sua traducao).

### Configuracao

O consumo automatico de Breather pode ser desativado nas configuracoes do modulo.

---

## Comandos de Chat

| Comando | Descricao |
|---|---|
| `/acampar` ou `/camp` | Abre o painel de acampamento (apenas Mestre). |
| `/provisoes` ou `/provisions` | Exibe o relatorio de provisoes do personagem selecionado. |

---

## Configuracoes

Acessiveis em **Configuracoes do Jogo** (icone de engrenagem), na secao do modulo:

| Configuracao | Padrao | Descricao |
|---|---|---|
| Curar no Descanso Longo | Ativado | Aplica cura automatica baseada no patamar de conforto. |
| Consumir Suprimento no Breather | Ativado | Consome 1 unidade do item vinculado ao usar Breather. |

---

## Compatibilidade

- **Foundry VTT**: v12 e v13
- **Sistema**: AGE System (unofficial) por VkDolea
- **Regras**: Fantasy AGE 2nd Edition (Green Ronin)

---

## Licenca

Software livre. Use, modifique e distribua como desejar.
