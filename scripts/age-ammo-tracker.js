/**
 * AGE Ammo & Resource Tracker
 * Módulo para Foundry VTT + AGE System (VkDolea)
 * 
 * Permite vincular itens consumíveis (flechas, balas, etc.) a armas.
 * Quando o jogador faz uma rolagem de ataque com a arma, o módulo
 * automaticamente subtrai 1 da quantidade do item vinculado.
 * 
 * COMO USAR:
 * 1. Abra a ficha de uma arma (weapon) de um personagem
 * 2. Clique no botão "🏹 Munição" no cabeçalho da ficha
 * 3. Selecione qual item do inventário é a munição dessa arma
 * 4. Pronto! A cada ataque com essa arma, 1 unidade será subtraída
 */

// ============================================================
// CONFIGURAÇÕES DO MÓDULO
// ============================================================

const MODULE_ID = "age-ammo-tracker";
const FLAG_AMMO_ID = "linkedAmmoId";
const FLAG_AMMO_NAME = "linkedAmmoName";

// Mude para true se quiser ver logs de debug no console (F12)
const DEBUG = false;

function log(...args) {
  if (DEBUG) console.log(`[${MODULE_ID}]`, ...args);
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Inicializando AGE Ammo & Resource Tracker`);

  // Registrar configurações do módulo
  game.settings.register(MODULE_ID, "enabled", {
    name: "Ativar Rastreamento de Munição",
    hint: "Quando ativo, subtrai automaticamente a munição vinculada ao fazer ataques.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "warnLowAmmo", {
    name: "Aviso de Munição Baixa",
    hint: "Quantidade mínima para exibir um aviso no chat.",
    scope: "world",
    config: true,
    type: Number,
    default: 5,
  });

  game.settings.register(MODULE_ID, "preventAttackNoAmmo", {
    name: "Bloquear Ataque sem Munição",
    hint: "Se ativo, exibe um aviso quando o jogador tenta atacar sem munição (mas NÃO impede a rolagem).",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | AGE Ammo & Resource Tracker pronto!`);
});

// ============================================================
// BOTÃO NO CABEÇALHO DA FICHA DE ARMA
// ============================================================

// Hook para adicionar botão na ficha do item (v12/v13 compatível)
Hooks.on("getItemSheetHeaderButtons", (sheet, buttons) => {
  const item = sheet.item || sheet.object;
  if (!item) return;

  // Só adiciona o botão em armas que pertencem a um ator
  if (item.type !== "weapon") return;
  if (!item.actor) return;

  buttons.unshift({
    label: "🏹 Munição",
    class: "age-ammo-link",
    icon: "",
    onclick: () => openAmmoLinkDialog(item),
  });
});

// ============================================================
// DIÁLOGO DE VINCULAÇÃO DE MUNIÇÃO
// ============================================================

async function openAmmoLinkDialog(weapon) {
  const actor = weapon.actor;
  if (!actor) {
    ui.notifications.warn("Esta arma precisa estar no inventário de um personagem.");
    return;
  }

  // Buscar todos os itens do ator que podem ser munição
  // No AGE System, itens consumíveis são do tipo "equipment" ou "weapon" (para armas arremessáveis)
  const candidateItems = actor.items.filter((i) => {
    // Equipamentos gerais e armas (para armas de arremesso como adagas)
    return (i.type === "equipment" || i.type === "weapon") && i.id !== weapon.id;
  });

  if (candidateItems.length === 0) {
    ui.notifications.warn(
      "Este personagem não tem itens no inventário para vincular como munição. " +
      "Adicione itens do tipo 'General Equipment' (Equipamento Geral) primeiro."
    );
    return;
  }

  // Verificar se já tem um vínculo
  const currentAmmoId = weapon.getFlag(MODULE_ID, FLAG_AMMO_ID) || "";
  const currentAmmoName = weapon.getFlag(MODULE_ID, FLAG_AMMO_NAME) || "";

  // Montar as opções do dropdown
  let optionsHtml = `<option value="">-- Nenhuma munição --</option>`;
  for (const item of candidateItems) {
    const qty = _getQuantity(item);
    const qtyText = qty !== null ? ` [${qty}]` : "";
    const selected = item.id === currentAmmoId ? "selected" : "";
    optionsHtml += `<option value="${item.id}" ${selected}>${item.name}${qtyText}</option>`;
  }

  const currentInfo = currentAmmoId
    ? `<p style="margin-bottom:8px; color:#4a7; font-weight:bold;">Munição atual: ${currentAmmoName}</p>`
    : `<p style="margin-bottom:8px; color:#888;">Nenhuma munição vinculada.</p>`;

  const content = `
    <form>
      ${currentInfo}
      <div class="form-group">
        <label>Selecione o item de munição:</label>
        <select id="ammo-select" style="width:100%; margin-top:4px; padding:4px;">
          ${optionsHtml}
        </select>
      </div>
      <p style="font-size:11px; color:#888; margin-top:8px;">
        A cada rolagem de ataque com <strong>${weapon.name}</strong>, 
        1 unidade do item selecionado será subtraída automaticamente.
      </p>
    </form>
  `;

  new Dialog({
    title: `Vincular Munição — ${weapon.name}`,
    content: content,
    buttons: {
      save: {
        icon: '<i class="fas fa-check"></i>',
        label: "Salvar",
        callback: async (html) => {
          const selectedId = html.find("#ammo-select").val();
          if (selectedId) {
            const selectedItem = actor.items.get(selectedId);
            if (selectedItem) {
              await weapon.setFlag(MODULE_ID, FLAG_AMMO_ID, selectedId);
              await weapon.setFlag(MODULE_ID, FLAG_AMMO_NAME, selectedItem.name);
              ui.notifications.info(
                `${weapon.name} agora consome: ${selectedItem.name}`
              );
            }
          } else {
            // Remover vínculo
            await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_ID);
            await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_NAME);
            ui.notifications.info(
              `Vínculo de munição removido de ${weapon.name}`
            );
          }
        },
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancelar",
      },
    },
    default: "save",
  }).render(true);
}

// ============================================================
// DETECÇÃO DE ROLAGEM DE ATAQUE E SUBTRAÇÃO DE MUNIÇÃO
// ============================================================

Hooks.on("createChatMessage", async (message, options, userId) => {
  // Só processar se o módulo estiver ativo
  if (!game.settings.get(MODULE_ID, "enabled")) return;

  // Só processar no lado do usuário que criou a mensagem
  if (game.userId !== userId) return;

  // Tentar detectar se é uma rolagem de arma do AGE System
  const weaponData = _extractWeaponFromMessage(message);
  if (!weaponData) return;

  const { actor, weapon } = weaponData;
  log("Rolagem de arma detectada:", weapon.name, "por", actor.name);

  // Verificar se tem munição vinculada
  const ammoId = weapon.getFlag(MODULE_ID, FLAG_AMMO_ID);
  if (!ammoId) {
    log("Nenhuma munição vinculada a", weapon.name);
    return;
  }

  // Buscar o item de munição no inventário do ator
  const ammoItem = actor.items.get(ammoId);
  if (!ammoItem) {
    ui.notifications.warn(
      `Item de munição vinculado a ${weapon.name} não encontrado no inventário!`
    );
    // Limpar o vínculo quebrado
    await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_ID);
    await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_NAME);
    return;
  }

  // Obter quantidade atual
  const currentQty = _getQuantity(ammoItem);
  if (currentQty === null) {
    ui.notifications.warn(
      `Não foi possível ler a quantidade de ${ammoItem.name}.`
    );
    return;
  }

  // Verificar se tem munição suficiente
  if (currentQty <= 0) {
    if (game.settings.get(MODULE_ID, "preventAttackNoAmmo")) {
      // Criar mensagem de aviso no chat
      ChatMessage.create({
        content: `<div style="border:2px solid #c33; border-radius:6px; padding:8px; background:#2a1111;">
          <strong style="color:#f66;">SEM MUNIÇÃO!</strong><br>
          <em>${actor.name}</em> tentou atacar com <strong>${weapon.name}</strong>, 
          mas não tem mais <strong>${ammoItem.name}</strong>!
        </div>`,
        speaker: ChatMessage.getSpeaker({ actor }),
        whisper: [], // Visível para todos
      });
    }
    return;
  }

  // SUBTRAIR 1 DA MUNIÇÃO
  const newQty = currentQty - 1;
  await _setQuantity(ammoItem, newQty);

  log(`Munição consumida: ${ammoItem.name} ${currentQty} → ${newQty}`);

  // Notificação no chat
  const lowAmmoThreshold = game.settings.get(MODULE_ID, "warnLowAmmo");
  let ammoMessage = "";

  if (newQty <= 0) {
    ammoMessage = `<div style="border:2px solid #c33; border-radius:6px; padding:8px; background:#2a1111;">
      <strong style="color:#f66;">🏹 ÚLTIMA MUNIÇÃO!</strong><br>
      <em>${actor.name}</em> usou a última <strong>${ammoItem.name}</strong> com <strong>${weapon.name}</strong>!<br>
      <span style="color:#f99;">Restam: 0</span>
    </div>`;
  } else if (newQty <= lowAmmoThreshold) {
    ammoMessage = `<div style="border:1px solid #c93; border-radius:6px; padding:8px; background:#2a2211;">
      <strong style="color:#fc6;">🏹 Munição baixa!</strong><br>
      <em>${actor.name}</em> usou 1× <strong>${ammoItem.name}</strong> com <strong>${weapon.name}</strong>.<br>
      <span style="color:#fc6;">Restam: ${newQty}</span>
    </div>`;
  } else {
    ammoMessage = `<div style="border:1px solid #396; border-radius:6px; padding:6px; background:#112211;">
      🏹 <em>${actor.name}</em> usou 1× <strong>${ammoItem.name}</strong>. Restam: <strong>${newQty}</strong>
    </div>`;
  }

  ChatMessage.create({
    content: ammoMessage,
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: [], // Visível para todos
  });
});

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

/**
 * Tenta extrair informações da arma usada a partir de uma mensagem de chat.
 * Usa múltiplas estratégias para compatibilidade.
 */
function _extractWeaponFromMessage(message) {
  // Só processar se tiver um ator válido
  const speaker = message.speaker;
  if (!speaker?.actor) return null;

  const actor = game.actors.get(speaker.actor);
  if (!actor) return null;

  // --- ESTRATÉGIA 1: Flags do AGE System ---
  // O AGE System pode armazenar o itemId nas flags da mensagem
  const ageFlags = message.flags?.["age-system"];
  if (ageFlags) {
    log("Flags do AGE System encontradas:", ageFlags);

    // Tentar encontrar o item ID nas flags
    const itemId = ageFlags.itemId || ageFlags.item?.id || ageFlags.item?._id;
    if (itemId) {
      const weapon = actor.items.get(itemId);
      if (weapon && weapon.type === "weapon") {
        return { actor, weapon };
      }
    }

    // Tentar pelo itemUuid
    if (ageFlags.itemUuid) {
      const parts = ageFlags.itemUuid.split(".");
      const id = parts[parts.length - 1];
      const weapon = actor.items.get(id);
      if (weapon && weapon.type === "weapon") {
        return { actor, weapon };
      }
    }
  }

  // --- ESTRATÉGIA 2: Flags genéricas do Foundry ---
  // Alguns sistemas armazenam em message.flags.core ou no próprio message
  const coreFlags = message.flags?.core;
  if (coreFlags?.itemId) {
    const weapon = actor.items.get(coreFlags.itemId);
    if (weapon && weapon.type === "weapon") {
      return { actor, weapon };
    }
  }

  // --- ESTRATÉGIA 3: Analisar o conteúdo HTML da mensagem ---
  // O AGE System coloca o nome da arma no chat card
  const content = message.content || "";

  // Procurar por data-item-id no HTML
  const itemIdMatch = content.match(/data-item-id=["']([^"']+)["']/);
  if (itemIdMatch) {
    const weapon = actor.items.get(itemIdMatch[1]);
    if (weapon && weapon.type === "weapon") {
      return { actor, weapon };
    }
  }

  // Procurar por UUID de item no HTML
  const uuidMatch = content.match(/data-uuid=["']Actor\.[^.]+\.Item\.([^"']+)["']/);
  if (uuidMatch) {
    const weapon = actor.items.get(uuidMatch[1]);
    if (weapon && weapon.type === "weapon") {
      return { actor, weapon };
    }
  }

  // --- ESTRATÉGIA 4: Procurar pelo nome da arma no conteúdo ---
  // Último recurso: verificar se o conteúdo contém o nome de alguma arma do ator
  if (message.isRoll || message.rolls?.length > 0) {
    // Só tentar esta estratégia se for uma rolagem
    const weapons = actor.items.filter((i) => i.type === "weapon");
    for (const weapon of weapons) {
      // Verificar se o nome da arma aparece no conteúdo ou no flavor
      const flavor = message.flavor || "";
      if (
        content.includes(weapon.name) ||
        flavor.includes(weapon.name)
      ) {
        // Verificar se a arma tem munição vinculada (para evitar falsos positivos)
        if (weapon.getFlag(MODULE_ID, FLAG_AMMO_ID)) {
          return { actor, weapon };
        }
      }
    }
  }

  log("Nenhuma arma detectada nesta mensagem de chat.");
  return null;
}

/**
 * Obtém a quantidade de um item, tentando vários caminhos possíveis
 * para compatibilidade com diferentes versões do AGE System.
 */
function _getQuantity(item) {
  // Caminho moderno (Foundry v10+)
  if (item.system?.quantity !== undefined) {
    return Number(item.system.quantity) || 0;
  }
  if (item.system?.qty !== undefined) {
    return Number(item.system.qty) || 0;
  }

  // Caminho legado (Foundry v9 e anteriores)
  if (item.data?.data?.quantity !== undefined) {
    return Number(item.data.data.quantity) || 0;
  }
  if (item.data?.data?.qty !== undefined) {
    return Number(item.data.data.qty) || 0;
  }

  log("Não foi possível encontrar o campo de quantidade para:", item.name);
  log("item.system:", item.system);
  return null;
}

/**
 * Define a quantidade de um item, usando o caminho correto.
 */
async function _setQuantity(item, newQty) {
  // Tentar os caminhos em ordem de preferência
  if (item.system?.quantity !== undefined) {
    return item.update({ "system.quantity": newQty });
  }
  if (item.system?.qty !== undefined) {
    return item.update({ "system.qty": newQty });
  }

  // Caminho legado
  if (item.data?.data?.quantity !== undefined) {
    return item.update({ "data.data.quantity": newQty });
  }
  if (item.data?.data?.qty !== undefined) {
    return item.update({ "data.data.qty": newQty });
  }

  ui.notifications.error(
    `Erro: Não foi possível atualizar a quantidade de ${item.name}.`
  );
}

// ============================================================
// MACRO AUXILIAR: Verificar estoque de munição
// ============================================================

// Registra um comando de chat para verificar munição
Hooks.on("chatMessage", (chatLog, messageText, chatData) => {
  if (messageText.trim().toLowerCase() === "/municao" || 
      messageText.trim().toLowerCase() === "/ammo") {
    // Buscar o personagem do jogador
    const speaker = ChatMessage.getSpeaker();
    const actor = game.actors.get(speaker.actor);

    if (!actor) {
      ui.notifications.warn("Selecione um token ou tenha um personagem vinculado.");
      return false;
    }

    // Encontrar todas as armas com munição vinculada
    const weapons = actor.items.filter(
      (i) => i.type === "weapon" && i.getFlag(MODULE_ID, FLAG_AMMO_ID)
    );

    if (weapons.length === 0) {
      ChatMessage.create({
        content: `<div style="border:1px solid #666; border-radius:6px; padding:8px;">
          🏹 <strong>${actor.name}</strong> não tem armas com munição vinculada.
        </div>`,
        speaker: ChatMessage.getSpeaker({ actor }),
      });
      return false;
    }

    let report = `<div style="border:1px solid #396; border-radius:6px; padding:8px;">
      <strong>🏹 Relatório de Munição — ${actor.name}</strong><hr style="border-color:#396;">`;

    for (const weapon of weapons) {
      const ammoId = weapon.getFlag(MODULE_ID, FLAG_AMMO_ID);
      const ammoName = weapon.getFlag(MODULE_ID, FLAG_AMMO_NAME);
      const ammoItem = actor.items.get(ammoId);

      if (ammoItem) {
        const qty = _getQuantity(ammoItem);
        const color = qty <= 0 ? "#f66" : qty <= 5 ? "#fc6" : "#6f6";
        report += `<p>
          <strong>${weapon.name}</strong> → ${ammoName}: 
          <span style="color:${color}; font-weight:bold;">${qty}</span>
        </p>`;
      } else {
        report += `<p>
          <strong>${weapon.name}</strong> → <span style="color:#f66;">⚠️ Item não encontrado!</span>
        </p>`;
      }
    }

    report += `</div>`;

    ChatMessage.create({
      content: report,
      speaker: ChatMessage.getSpeaker({ actor }),
    });

    return false; // Impede que a mensagem seja enviada como texto normal
  }
});

// ============================================================
// DEBUG: Log de todas as mensagens (desativado por padrão)
// ============================================================

if (DEBUG) {
  Hooks.on("createChatMessage", (message) => {
    console.log(`[${MODULE_ID}] === NOVA MENSAGEM DE CHAT ===`);
    console.log(`[${MODULE_ID}] Tipo:`, message.type);
    console.log(`[${MODULE_ID}] Speaker:`, message.speaker);
    console.log(`[${MODULE_ID}] Flags:`, message.flags);
    console.log(`[${MODULE_ID}] É rolagem:`, message.isRoll);
    console.log(`[${MODULE_ID}] Rolls:`, message.rolls);
    console.log(`[${MODULE_ID}] Flavor:`, message.flavor);
    console.log(`[${MODULE_ID}] Content (100 chars):`, message.content?.substring(0, 100));
    console.log(`[${MODULE_ID}] ===========================`);
  });
}
