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

const MODULE_ID = "age-ammo-tracker";
const FLAG_AMMO_ID = "linkedAmmoId";
const FLAG_AMMO_NAME = "linkedAmmoName";

// Tipos de rolagem que consomem munição (do config.js do AGE System)
const ATTACK_ROLL_TYPES = ["attack", "meleeAttack", "rangedAttack", "stuntAttack"];

// Mude para true para ver logs no console do navegador (F12)
const DEBUG = false;

function log(...args) {
  if (DEBUG) console.log(`[${MODULE_ID}]`, ...args);
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Inicializando AGE Ammo & Resource Tracker v1.1`);

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
    name: "Aviso ao Atacar sem Munição",
    hint: "Exibe um aviso no chat quando o jogador tenta atacar sem munição restante.",
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

Hooks.on("getItemSheetHeaderButtons", (sheet, buttons) => {
  const item = sheet.item || sheet.object;
  if (!item) return;
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

  // Buscar itens candidatos a munição (equipamentos e outras armas)
  const candidateItems = actor.items.filter((i) => {
    return (i.type === "equipment" || i.type === "weapon") && i.id !== weapon.id;
  });

  if (candidateItems.length === 0) {
    ui.notifications.warn(
      "Este personagem não tem itens no inventário para vincular como munição. " +
      "Adicione itens do tipo 'General Equipment' primeiro."
    );
    return;
  }

  const currentAmmoId = weapon.getFlag(MODULE_ID, FLAG_AMMO_ID) || "";
  const currentAmmoName = weapon.getFlag(MODULE_ID, FLAG_AMMO_NAME) || "";

  let optionsHtml = `<option value="">-- Nenhuma munição --</option>`;
  for (const item of candidateItems) {
    const qty = item.system?.quantity ?? "?";
    const selected = item.id === currentAmmoId ? "selected" : "";
    optionsHtml += `<option value="${item.id}" ${selected}>${item.name} [${qty}]</option>`;
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
        1 unidade do item selecionado será subtraída.
      </p>
    </form>
  `;

  new Dialog({
    title: `🏹 Vincular Munição — ${weapon.name}`,
    content,
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
              ui.notifications.info(`✅ ${weapon.name} agora consome: ${selectedItem.name}`);
            }
          } else {
            await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_ID);
            await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_NAME);
            ui.notifications.info(`❌ Vínculo de munição removido de ${weapon.name}`);
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
// DETECÇÃO DE ATAQUES E SUBTRAÇÃO DE MUNIÇÃO
// ============================================================

Hooks.on("createChatMessage", async (message, options, userId) => {
  if (!game.settings.get(MODULE_ID, "enabled")) return;
  if (game.userId !== userId) return;

  // ── Extrair dados do AGE System ──
  // Estrutura real: message.flags["age-system"].ageroll.rollType
  //                 message.flags["age-system"].ageroll.rollData.itemId
  //                 message.flags["age-system"].ageroll.rollData.actorId (UUID)
  const ageRoll = message.flags?.["age-system"]?.ageroll;
  if (!ageRoll) {
    log("Mensagem sem flags do AGE System, ignorando.");
    return;
  }

  const rollType = ageRoll.rollType;
  const rollData = ageRoll.rollData;

  log("AGE Roll detectada:", { rollType, itemId: rollData?.itemId, actorId: rollData?.actorId });

  // Verificar se é uma rolagem de ataque
  if (!ATTACK_ROLL_TYPES.includes(rollType)) {
    log("Tipo de rolagem não é ataque:", rollType);
    return;
  }

  // Obter o item ID da arma
  const weaponId = rollData?.itemId;
  if (!weaponId) {
    log("Rolagem de ataque sem itemId, ignorando.");
    return;
  }

  // Obter o ator via UUID (o AGE System usa actor.uuid, não actor.id)
  const actorUuid = rollData?.actorId;
  if (!actorUuid) {
    log("Rolagem sem actorId, ignorando.");
    return;
  }

  let actor;
  try {
    actor = await fromUuid(actorUuid);
  } catch (e) {
    log("Erro ao buscar ator por UUID:", actorUuid, e);
    return;
  }

  if (!actor) {
    log("Ator não encontrado para UUID:", actorUuid);
    return;
  }

  // Buscar a arma no inventário do ator
  const weapon = actor.items.get(weaponId);
  if (!weapon || weapon.type !== "weapon") {
    log("Arma não encontrada no ator:", weaponId);
    return;
  }

  log(`Ataque detectado: ${actor.name} → ${weapon.name}`);

  // Verificar se tem munição vinculada
  const ammoId = weapon.getFlag(MODULE_ID, FLAG_AMMO_ID);
  if (!ammoId) {
    log("Nenhuma munição vinculada a", weapon.name);
    return;
  }

  // Buscar o item de munição
  const ammoItem = actor.items.get(ammoId);
  if (!ammoItem) {
    ui.notifications.warn(`⚠️ Munição vinculada a ${weapon.name} não encontrada no inventário!`);
    await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_ID);
    await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_NAME);
    return;
  }

  // Ler a quantidade atual (campo: system.quantity, do template "hardItem")
  const currentQty = ammoItem.system?.quantity;
  if (currentQty === undefined || currentQty === null) {
    ui.notifications.warn(`⚠️ Não foi possível ler a quantidade de ${ammoItem.name}.`);
    log("item.system:", ammoItem.system);
    return;
  }

  // Sem munição
  if (currentQty <= 0) {
    if (game.settings.get(MODULE_ID, "preventAttackNoAmmo")) {
      ChatMessage.create({
        content: `<div style="border:2px solid #c33; border-radius:6px; padding:8px; background:#2a1111;">
          <strong style="color:#f66;">⚠️ SEM MUNIÇÃO!</strong><br>
          <em>${actor.name}</em> atacou com <strong>${weapon.name}</strong>, 
          mas não tem mais <strong>${ammoItem.name}</strong>!
        </div>`,
        speaker: { alias: actor.name },
      });
    }
    return;
  }

  // SUBTRAIR 1
  const newQty = currentQty - 1;
  await ammoItem.update({ "system.quantity": newQty });

  log(`Munição consumida: ${ammoItem.name} ${currentQty} → ${newQty}`);

  // Mensagem no chat
  const lowAmmoThreshold = game.settings.get(MODULE_ID, "warnLowAmmo");
  let ammoMessage;

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
    speaker: { alias: actor.name },
  });
});

// ============================================================
// COMANDO DE CHAT: /municao ou /ammo
// ============================================================

Hooks.on("chatMessage", (chatLog, messageText, chatData) => {
  const cmd = messageText.trim().toLowerCase();
  if (cmd !== "/municao" && cmd !== "/ammo") return;

  const speaker = ChatMessage.getSpeaker();
  const actor = game.actors.get(speaker.actor);

  if (!actor) {
    ui.notifications.warn("Selecione um token ou tenha um personagem vinculado.");
    return false;
  }

  const weapons = actor.items.filter(
    (i) => i.type === "weapon" && i.getFlag(MODULE_ID, FLAG_AMMO_ID)
  );

  if (weapons.length === 0) {
    ChatMessage.create({
      content: `<div style="border:1px solid #666; border-radius:6px; padding:8px;">
        🏹 <strong>${actor.name}</strong> não tem armas com munição vinculada.
      </div>`,
      speaker: { alias: actor.name },
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
      const qty = ammoItem.system?.quantity ?? "?";
      const color = qty <= 0 ? "#f66" : qty <= 5 ? "#fc6" : "#6f6";
      report += `<p><strong>${weapon.name}</strong> → ${ammoName}: 
        <span style="color:${color}; font-weight:bold;">${qty}</span></p>`;
    } else {
      report += `<p><strong>${weapon.name}</strong> → 
        <span style="color:#f66;">⚠️ Item não encontrado!</span></p>`;
    }
  }

  report += `</div>`;
  ChatMessage.create({ content: report, speaker: { alias: actor.name } });
  return false;
});

// ============================================================
// DEBUG
// ============================================================

if (DEBUG) {
  Hooks.on("createChatMessage", (message) => {
    console.log(`[${MODULE_ID}] === NOVA MENSAGEM ===`);
    console.log(`[${MODULE_ID}] Speaker:`, message.speaker);
    console.log(`[${MODULE_ID}] Flags:`, JSON.stringify(message.flags, null, 2));
    console.log(`[${MODULE_ID}] AGE ageroll:`, message.flags?.["age-system"]?.ageroll);
    console.log(`[${MODULE_ID}] É rolagem:`, message.isRoll);
    console.log(`[${MODULE_ID}] ========================`);
  });
}
