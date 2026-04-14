/**
 * AGE Ammo & Resource Tracker v1.2
 * Módulo para Foundry VTT + AGE System (VkDolea)
 */

const MODULE_ID = "age-ammo-tracker";
const FLAG_AMMO_ID = "linkedAmmoId";
const FLAG_AMMO_NAME = "linkedAmmoName";
const ATTACK_ROLL_TYPES = ["attack", "meleeAttack", "rangedAttack", "stuntAttack"];

// ════════════════════════════════════════
// MODO DEBUG VISUAL
// Mude para true para ver notificações na tela do Foundry a cada passo.
// Isso ajuda a identificar onde o fluxo está quebrando.
// LEMBRE DE VOLTAR PARA false DEPOIS DE TESTAR!
// ════════════════════════════════════════
const DEBUG = true;

function log(...args) {
  console.log(`[${MODULE_ID}]`, ...args);
}
function debugNotify(msg) {
  if (DEBUG) {
    ui.notifications?.info(`[Ammo Debug] ${msg}`, { permanent: false });
    console.log(`[${MODULE_ID}] DEBUG:`, msg);
  }
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Inicializando AGE Ammo & Resource Tracker v1.2`);

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
  console.log(`${MODULE_ID} | AGE Ammo & Resource Tracker v1.2 pronto!`);
  if (DEBUG) ui.notifications.info("🏹 AGE Ammo Tracker: modo DEBUG ativo — notificações visíveis a cada passo.", { permanent: true });
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
// DIÁLOGO DE VINCULAÇÃO
// ============================================================

async function openAmmoLinkDialog(weapon) {
  const actor = weapon.actor;
  if (!actor) {
    ui.notifications.warn("Esta arma precisa estar no inventário de um personagem.");
    return;
  }

  const candidateItems = actor.items.filter((i) => {
    return (i.type === "equipment" || i.type === "weapon") && i.id !== weapon.id;
  });

  if (candidateItems.length === 0) {
    ui.notifications.warn("Nenhum item para vincular. Adicione 'General Equipment' ao personagem.");
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

  new Dialog({
    title: `🏹 Vincular Munição — ${weapon.name}`,
    content: `
      <form>
        ${currentInfo}
        <div class="form-group">
          <label>Selecione o item de munição:</label>
          <select id="ammo-select" style="width:100%; margin-top:4px; padding:4px;">
            ${optionsHtml}
          </select>
        </div>
        <p style="font-size:11px; color:#888; margin-top:8px;">
          A cada ataque com <strong>${weapon.name}</strong>, 1 unidade será subtraída.
        </p>
      </form>
    `,
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
              ui.notifications.info(`✅ ${weapon.name} → ${selectedItem.name}`);
            }
          } else {
            await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_ID);
            await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_NAME);
            ui.notifications.info(`❌ Vínculo removido de ${weapon.name}`);
          }
        },
      },
      cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancelar" },
    },
    default: "save",
  }).render(true);
}

// ============================================================
// DETECÇÃO DE ATAQUES — HOOK PRINCIPAL
// ============================================================

Hooks.on("createChatMessage", async (message, options, userId) => {
  try {
    // Passo 0: Módulo ativo?
    if (!game.settings.get(MODULE_ID, "enabled")) return;

    // Passo 1: Só processar no client de quem criou a mensagem
    if (game.userId !== userId) return;

    debugNotify(`Passo 1: Mensagem detectada (id: ${message.id})`);

    // Passo 2: Verificar se tem flags do AGE System
    const allFlags = message.flags;
    const ageFlags = allFlags?.["age-system"];

    if (!ageFlags) {
      debugNotify("Passo 2: Sem flags 'age-system'. Não é rolagem do AGE.");
      return;
    }

    debugNotify(`Passo 2: Flags AGE encontradas. Chaves: ${Object.keys(ageFlags).join(", ")}`);

    // Passo 3: Verificar se tem ageroll
    const ageRoll = ageFlags.ageroll;

    if (!ageRoll) {
      debugNotify(`Passo 3: Sem 'ageroll' nas flags. Chaves disponíveis: ${Object.keys(ageFlags).join(", ")}`);
      return;
    }

    const rollType = ageRoll.rollType;
    const rollData = ageRoll.rollData;

    debugNotify(`Passo 3: rollType="${rollType}"`);

    // Passo 4: Verificar se é ataque
    if (!ATTACK_ROLL_TYPES.includes(rollType)) {
      debugNotify(`Passo 4: Não é ataque (${rollType}). Ignorando.`);
      return;
    }

    debugNotify("Passo 4: É um ataque!");

    // Passo 5: Obter item ID
    const weaponId = rollData?.itemId;
    if (!weaponId) {
      debugNotify(`Passo 5: Sem itemId no rollData. Chaves: ${rollData ? Object.keys(rollData).join(", ") : "rollData é null/undefined"}`);
      return;
    }

    debugNotify(`Passo 5: weaponId="${weaponId}"`);

    // Passo 6: Obter actor
    const actorUuid = rollData?.actorId;
    if (!actorUuid) {
      debugNotify("Passo 6: Sem actorId no rollData.");
      return;
    }

    debugNotify(`Passo 6: actorUuid="${actorUuid}"`);

    let actor = await fromUuid(actorUuid);
    // Padrão do AGE System: se fromUuid retorna TokenDocument, pegar .actor
    actor = actor?.actor ?? actor;

    if (!actor) {
      debugNotify("Passo 6: Ator não encontrado via fromUuid.");
      return;
    }

    debugNotify(`Passo 6: Ator encontrado: "${actor.name}"`);

    // Passo 7: Buscar a arma
    const weapon = actor.items.get(weaponId);
    if (!weapon) {
      debugNotify(`Passo 7: Arma não encontrada no ator. weaponId="${weaponId}"`);
      return;
    }
    if (weapon.type !== "weapon") {
      debugNotify(`Passo 7: Item encontrado mas tipo="${weapon.type}", não é weapon.`);
      return;
    }

    debugNotify(`Passo 7: Arma encontrada: "${weapon.name}"`);

    // Passo 8: Verificar vínculo de munição
    const ammoId = weapon.getFlag(MODULE_ID, FLAG_AMMO_ID);
    if (!ammoId) {
      debugNotify(`Passo 8: "${weapon.name}" não tem munição vinculada.`);
      return;
    }

    const ammoItem = actor.items.get(ammoId);
    if (!ammoItem) {
      ui.notifications.warn(`⚠️ Munição vinculada a ${weapon.name} não encontrada!`);
      await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_ID);
      await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_NAME);
      return;
    }

    debugNotify(`Passo 8: Munição vinculada: "${ammoItem.name}"`);

    // Passo 9: Ler quantidade
    const currentQty = ammoItem.system?.quantity;
    if (currentQty === undefined || currentQty === null) {
      debugNotify(`Passo 9: Campo 'quantity' não encontrado. system keys: ${Object.keys(ammoItem.system || {}).join(", ")}`);
      ui.notifications.warn(`⚠️ Não foi possível ler quantidade de ${ammoItem.name}.`);
      return;
    }

    debugNotify(`Passo 9: Quantidade atual = ${currentQty}`);

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

    // Passo 10: SUBTRAIR!
    const newQty = currentQty - 1;
    await ammoItem.update({ "system.quantity": newQty });

    debugNotify(`Passo 10: ✅ ${ammoItem.name} ${currentQty} → ${newQty}`);

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

  } catch (error) {
    console.error(`[${MODULE_ID}] ERRO no hook createChatMessage:`, error);
    if (DEBUG) ui.notifications.error(`[Ammo Tracker] ERRO: ${error.message}`);
  }
});

// ============================================================
// COMANDO: /municao ou /ammo
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
