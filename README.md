# 🍖 AGE Provisions Tracker

Módulo para **Foundry VTT** + **AGE System (VkDolea)** — rastreamento de provisões com automação de descanso e breather.

## Funcionalidades

### 🏕️ Descanso Longo
- Botão no cabeçalho da ficha do personagem
- Pergunta se o jogador quer consumir 1 ração
- Cura **10 + Constituição + Nível**
- Relatório no chat

### ☕ Breather
- Consome 1 **bebida alcoólica** ou **healing kit** automaticamente
- Detecta o Breather do AGE System

## Instalação

No Foundry: **Add-on Modules** → **Install Module** → Manifest URL:
```
https://raw.githubusercontent.com/H4yn3x/age-ammo-tracker/main/module.json
```

## Como Usar

| Ação | Como fazer |
|---|---|
| Vincular provisões | Ficha do personagem → botão **🍖 Provisões** |
| Descanso longo | Ficha do personagem → botão **🏕️ Descanso Longo** |
| Descanso via chat | `/descanso` ou `/longrest` |
| Ver provisões | `/provisoes` ou `/provisions` |

## Compatibilidade

- **Foundry VTT**: v12 e v13
- **Sistema**: AGE System (unofficial) por VkDolea
