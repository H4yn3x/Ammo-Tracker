# 🏹 AGE Ammo & Resource Tracker

Módulo para **Foundry VTT** + **AGE System (VkDolea)** que subtrai automaticamente
munição e recursos consumíveis ao usar armas.

## Como Instalar

### Método 1 — Copiando a pasta (mais fácil)

1. Localize a pasta de dados do Foundry VTT no servidor.
   - No **Linux**, geralmente fica em: `~/.local/share/FoundryVTT/Data/modules/`
   - No **Windows**, geralmente fica em: `%localappdata%/FoundryVTT/Data/modules/`
   - Se não tiver certeza, abra o Foundry → **Configuration** → procure o campo **User Data Path**.
     A pasta de módulos fica em: `[User Data Path]/Data/modules/`

2. Copie a pasta `age-ammo-tracker` inteira para dentro de `modules/`.
   O resultado deve ficar assim:
   ```
   modules/
     age-ammo-tracker/
       module.json
       scripts/
         age-ammo-tracker.js
   ```

3. Reinicie o Foundry VTT.

4. No Foundry, vá em **Gerenciar Módulos** (Manage Modules) e ative o
   **"AGE Ammo & Resource Tracker"**.

## Como Usar

### Vincular munição a uma arma

1. Abra a ficha de um **personagem** (character).
2. Certifique-se de que o personagem tem a **arma** e o **item de munição**
   (por exemplo, "Flechas" como equipamento geral com quantidade 20).
3. Clique na arma para abrir a ficha dela.
4. No **cabeçalho da ficha da arma**, clique no botão **"🏹 Munição"**.
5. Na janela que abrir, selecione qual item do inventário é a munição.
6. Clique em **Salvar**.

### O que acontece automaticamente

- Toda vez que um jogador fizer uma **rolagem de ataque** com aquela arma,
  **1 unidade** do item vinculado será subtraída automaticamente.
- Uma mensagem aparecerá no **chat** informando o consumo e quantas unidades restam.
- Quando a munição estiver **baixa** (padrão: 5 ou menos), um aviso amarelo aparece.
- Quando a munição **acabar**, um aviso vermelho aparece.

### Verificar munição

Digite no chat: `/municao` ou `/ammo`

Isso mostra um relatório de todas as armas do personagem que têm munição vinculada,
com as quantidades atuais.

## Configurações

No Foundry, vá em **Configurações** → **Configurar Módulos** → **AGE Ammo & Resource Tracker**:

- **Ativar Rastreamento**: Liga/desliga o módulo.
- **Aviso de Munição Baixa**: Número mínimo para exibir aviso amarelo (padrão: 5).
- **Bloquear Ataque sem Munição**: Exibe aviso quando tenta atacar com 0 munição.

## Solução de Problemas

### A munição não está sendo subtraída

O módulo detecta rolagens de armas analisando as mensagens de chat. Se não estiver
funcionando, pode ser que o AGE System armazene os dados de rolagem de uma forma
diferente do esperado.

Para diagnosticar:

1. Abra o arquivo `scripts/age-ammo-tracker.js` em um editor de texto.
2. Na linha que diz `const DEBUG = false;`, mude para `const DEBUG = true;`
3. Salve o arquivo e recarregue o Foundry (F5).
4. Faça uma rolagem de ataque com a arma.
5. Abra o console do navegador (F12 → aba Console).
6. Procure as mensagens que começam com `[age-ammo-tracker]`.
7. Ali você verá exatamente quais dados o Foundry está enviando,
   o que ajuda a ajustar o código.

### O campo de quantidade não é encontrado

Se o módulo não conseguir ler/alterar a quantidade do item, é possível que o
caminho do dado esteja diferente. No modo DEBUG, o módulo mostra o `item.system`
no console, para que você possa verificar qual é o nome correto do campo.

## Compatibilidade

- **Foundry VTT**: v12 e v13
- **Sistema**: AGE System (unofficial) por VkDolea

## Licença

Este módulo é software livre. Use, modifique e distribua como quiser.
