🏹 AGE Resource Tracker
Módulo para Foundry VTT + AGE System (VkDolea) — rastreamento automático de
munição, comida, água e recursos consumíveis.
Funcionalidades
🏹 Munição
Vincule flechas, balas ou qualquer item a uma arma
1 unidade subtraída automaticamente a cada ataque
Notificação no chat opcional (desligada por padrão)
Avisos de munição baixa e sem munição
🔄 Recuperação Pós-Combate
Ao encerrar combate, parte da munição gasta é recuperada
Percentual configurável (padrão: 50%)
🏕️ Descanso Longo
Botão no cabeçalho da ficha do personagem
Cura 10 + Constituição + Nível
Consome 1 comida + 1 água
☕ Breather
Consome 1 bebida alcoólica ou 1 uso de healing kit automaticamente
Detecta o Breather do AGE System
🍖 Provisões
Botão no cabeçalho da ficha para vincular comida, água e suprimento de breather
Relatório via `/provisoes`
⚡ Power Points
Funcionalidade nativa do AGE System — ative em:
Configurações do Sistema → "Auto Consume Power Points"
Instalação
No Foundry: Add-on Modules → Install Module → Manifest URL:
```
https://raw.githubusercontent.com/H4yn3x/age-ammo-tracker/main/module.json
```
Como Usar
Ação	Como fazer
Vincular munição	Ficha da arma → botão 🏹 Munição
Vincular provisões	Ficha do personagem → botão 🍖 Provisões
Descanso longo	Ficha do personagem → botão 🏕️ Descanso
Verificar munição	Chat: `/municao` ou `/ammo`
Verificar provisões	Chat: `/provisoes` ou `/provisions`
Descanso via chat	Chat: `/descanso` ou `/longrest`
Compatibilidade
Foundry VTT: v12 e v13
Sistema: AGE System (unofficial) por VkDolea
