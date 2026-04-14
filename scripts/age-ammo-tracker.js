/**
 * AGE Ammo & Resource Tracker v2.0
 * Módulo para Foundry VTT + AGE System (VkDolea)
 * 
 * Features:
 * - Subtração automática de munição ao atacar
 * - Notificação de consumo no chat (opcional, desligada por padrão)
 * - Recuperação de munição ao fim do combate
 * - Consumo de comida/água ao usar Breather ou Descanso Longo
 * 
 * Nota: Power Points já são consumidos automaticamente pelo AGE System.
 *       Basta ativar "Auto Consume Power Points" nas configurações do sistema.
 */

const MODULE_ID = "age-ammo-tracker";
const FLAG_AMMO_ID = "linkedAmmoId";
const FLAG_AMMO_NAME = "linkedAmmoName";
const FLAG_FOOD_ID = "foodItemId";
const FLAG_WATER_ID = "waterItemId";
const FLAG_COMBAT_AMMO_SNAPSHOT = "combatAmmoSnapshot";

const ATTACK_ROLL_TYPES = ["attack", "meleeAttack", "rangedAttack", "stuntAttack"];

const DEBUG = false;
function log(...args) { if (DEBUG) console.log(`[${MODULE_ID}]`, ...args); }
function debugNotify(msg) { if (DEBUG) ui.notifications?.info(`[Debug] ${msg}`); }

// ============================================================
// INICIALIZAÇÃO & CONFIGURAÇÕES
// ============================================================

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Inicializando AGE Resource Tracker v2.0`);

  // ── Munição ──
  game.settings.register(MODULE_ID, "enabled", {
    name: "Ativar Rastreamento de Munição",
    hint: "Subtrai automaticamente a munição vinculada ao fazer ataques.",
    scope: "world", config: true, type: Boolean, default: true,
  });

  game.settings.register(MODULE_ID, "showAmmoChat", {
    name: "Exibir Notificação de Munição no Chat",
    hint: "Mostra uma mensagem no chat a cada consumo de munição.",
    scope: "world", config: true, type: Boolean, default: false,
  });

  game.settings.register(MODULE_ID, "warnLowAmmo", {
    name: "Aviso de Munição Baixa",
    hint: "Quantidade para exibir aviso amarelo (0 para desativar).",
    scope: "world", config: true, type: Number, default: 5,
  });

  game.settings.register(MODULE_ID, "warnNoAmmo", {
    name: "Aviso ao Atacar sem Munição",
    hint: "Exibe aviso no chat ao atacar com 0 munição.",
    scope: "world", config: true, type: Boolean, default: true,
  });

  // ── Recuperação de Munição ──
  game.settings.register(MODULE_ID, "ammoRecovery", {
    name: "Recuperar Munição ao Fim do Combate",
    hint: "Ativa a recuperação automática de parte da munição gasta.",
    scope: "world", config: true, type: Boolean, default: true,
  });

  game.settings.register(MODULE_ID, "ammoRecoveryPercent", {
    name: "Porcentagem de Recuperação de Munição",
    hint: "Percentual de munição gasta que é recuperada (0-100). Padrão: 50%.",
    scope: "world", config: true, type: Number, default: 50,
    range: { min: 0, max: 100, step: 5 },
  });

  // ── Comida & Água ──
  game.settings.register(MODULE_ID, "consumeOnBreather", {
    name: "Consumir Água ao usar Breather",
    hint: "Subtrai 1 de água do personagem ao usar Breather.",
    scope: "world", config: true, type: Boolean, default: true,
  });

  game.settings.register(MODULE_ID, "consumeOnLongRest", {
    name: "Consumir Comida e Água no Descanso Longo",
    hint: "Subtrai 1 de comida e 1 de água ao usar o comando /descanso.",
    scope: "world", config: true, type: Boolean, default: true,
  });
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | AGE Resource Tracker v2.0 pronto!`);
});

// ============================================================
// BOTÕES NAS FICHAS
// ============================================================

// Botão 🏹 Munição na ficha de arma
Hooks.on("getItemSheetHeaderButtons", (sheet, buttons) => {
  const item = sheet.item || sheet.object;
  if (!item || item.type !== "weapon" || !item.actor) return;
  buttons.unshift({
    label: "🏹 Munição",
    class: "age-ammo-link",
    icon: "",
    onclick: () => openAmmoLinkDialog(item),
  });
});

// Botão 🍖 Provisões na ficha de personagem
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  const actor = sheet.actor || sheet.object;
  if (!actor || actor.type !== "char") return;
  buttons.unshift({
    label: "🍖 Provisões",
    class: "age-provisions-link",
    icon: "",
    onclick: () => openProvisionsDialog(actor),
  });
});

// ============================================================
// DIÁLOGO: VINCULAR MUNIÇÃO
// ============================================================

async function openAmmoLinkDialog(weapon) {
  const actor = weapon.actor;
  if (!actor) return ui.notifications.warn("Arma precisa estar no inventário.");

  const candidates = actor.items.filter(i =>
    (i.type === "equipment" || i.type === "weapon") && i.id !== weapon.id
  );

  if (candidates.length === 0) return ui.notifications.warn("Sem itens para vincular.");

  const currentId = weapon.getFlag(MODULE_ID, FLAG_AMMO_ID) || "";
  const currentName = weapon.getFlag(MODULE_ID, FLAG_AMMO_NAME) || "";

  let opts = `<option value="">-- Nenhuma munição --</option>`;
  for (const i of candidates) {
    opts += `<option value="${i.id}" ${i.id === currentId ? "selected" : ""}>${i.name} [${i.system?.quantity ?? "?"}]</option>`;
  }

  new Dialog({
    title: `🏹 Vincular Munição — ${weapon.name}`,
    content: `<form>
      ${currentId ? `<p style="color:#4a7;font-weight:bold;">Atual: ${currentName}</p>` : `<p style="color:#888;">Nenhuma munição vinculada.</p>`}
      <div class="form-group">
        <label>Item de munição:</label>
        <select id="ammo-select" style="width:100%;padding:4px;">${opts}</select>
      </div>
    </form>`,
    buttons: {
      save: {
        icon: '<i class="fas fa-check"></i>', label: "Salvar",
        callback: async (html) => {
          const id = html.find("#ammo-select").val();
          if (id) {
            const item = actor.items.get(id);
            await weapon.setFlag(MODULE_ID, FLAG_AMMO_ID, id);
            await weapon.setFlag(MODULE_ID, FLAG_AMMO_NAME, item.name);
            ui.notifications.info(`✅ ${weapon.name} → ${item.name}`);
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
// DIÁLOGO: VINCULAR COMIDA & ÁGUA
// ============================================================

async function openProvisionsDialog(actor) {
  const candidates = actor.items.filter(i => i.type === "equipment");
  if (candidates.length === 0) return ui.notifications.warn("Sem equipamentos no inventário.");

  const foodId = actor.getFlag(MODULE_ID, FLAG_FOOD_ID) || "";
  const waterId = actor.getFlag(MODULE_ID, FLAG_WATER_ID) || "";

  let foodOpts = `<option value="">-- Nenhum --</option>`;
  let waterOpts = `<option value="">-- Nenhum --</option>`;
  for (const i of candidates) {
    const qty = i.system?.quantity ?? "?";
    foodOpts += `<option value="${i.id}" ${i.id === foodId ? "selected" : ""}>${i.name} [${qty}]</option>`;
    waterOpts += `<option value="${i.id}" ${i.id === waterId ? "selected" : ""}>${i.name} [${qty}]</option>`;
  }

  const foodItem = foodId ? actor.items.get(foodId) : null;
  const waterItem = waterId ? actor.items.get(waterId) : null;

  new Dialog({
    title: `🍖 Provisões — ${actor.name}`,
    content: `<form>
      <p style="font-size:11px;color:#888;margin-bottom:8px;">
        Vincule itens de comida e água. Serão consumidos automaticamente em Breathers e Descanso Longo.
      </p>
      ${foodItem ? `<p style="color:#4a7;">🍞 Comida atual: ${foodItem.name} [${foodItem.system?.quantity}]</p>` : ""}
      ${waterItem ? `<p style="color:#4a7;">💧 Água atual: ${waterItem.name} [${waterItem.system?.quantity}]</p>` : ""}
      <hr>
      <div class="form-group">
        <label>🍞 Comida:</label>
        <select id="food-select" style="width:100%;padding:4px;">${foodOpts}</select>
      </div>
      <div class="form-group" style="margin-top:6px;">
        <label>💧 Água:</label>
        <select id="water-select" style="width:100%;padding:4px;">${waterOpts}</select>
      </div>
    </form>`,
    buttons: {
      save: {
        icon: '<i class="fas fa-check"></i>', label: "Salvar",
        callback: async (html) => {
          const fId = html.find("#food-select").val();
          const wId = html.find("#water-select").val();
          if (fId) await actor.setFlag(MODULE_ID, FLAG_FOOD_ID, fId);
          else await actor.unsetFlag(MODULE_ID, FLAG_FOOD_ID);
          if (wId) await actor.setFlag(MODULE_ID, FLAG_WATER_ID, wId);
          else await actor.unsetFlag(MODULE_ID, FLAG_WATER_ID);
          ui.notifications.info(`✅ Provisões de ${actor.name} atualizadas.`);
        },
      },
      cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancelar" },
    },
    default: "save",
  }).render(true);
}

// ============================================================
// HOOK: SUBTRAÇÃO DE MUNIÇÃO AO ATACAR
// ============================================================

Hooks.on("createChatMessage", async (message, options, userId) => {
  try {
    if (!game.settings.get(MODULE_ID, "enabled")) return;
    if (game.userId !== userId) return;

    const ageRoll = message.flags?.["age-system"]?.ageroll;
    if (!ageRoll) return;

    const rollType = ageRoll.rollType;
    const rollData = ageRoll.rollData;

    if (!ATTACK_ROLL_TYPES.includes(rollType)) return;

    const weaponId = rollData?.itemId;
    const actorUuid = rollData?.actorId;
    if (!weaponId || !actorUuid) return;

    let actor = await fromUuid(actorUuid);
    actor = actor?.actor ?? actor;
    if (!actor) return;

    const weapon = actor.items.get(weaponId);
    if (!weapon || weapon.type !== "weapon") return;

    const ammoId = weapon.getFlag(MODULE_ID, FLAG_AMMO_ID);
    if (!ammoId) return;

    const ammoItem = actor.items.get(ammoId);
    if (!ammoItem) {
      ui.notifications.warn(`⚠️ Munição de ${weapon.name} não encontrada!`);
      await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_ID);
      await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_NAME);
      return;
    }

    const currentQty = ammoItem.system?.quantity;
    if (currentQty === undefined || currentQty === null) return;

    // Sem munição
    if (currentQty <= 0) {
      if (game.settings.get(MODULE_ID, "warnNoAmmo")) {
        ChatMessage.create({
          content: `<div style="border:2px solid #c33;border-radius:6px;padding:8px;background:#2a1111;">
            <strong style="color:#f66;">⚠️ SEM MUNIÇÃO!</strong><br>
            <em>${actor.name}</em> atacou com <strong>${weapon.name}</strong>, 
            mas não tem mais <strong>${ammoItem.name}</strong>!
          </div>`,
          speaker: { alias: actor.name },
        });
      }
      return;
    }

    // Subtrair
    const newQty = currentQty - 1;
    await ammoItem.update({ "system.quantity": newQty });

    // Notificação no chat (opcional)
    if (game.settings.get(MODULE_ID, "showAmmoChat")) {
      const lowThreshold = game.settings.get(MODULE_ID, "warnLowAmmo");
      let msg;
      if (newQty <= 0) {
        msg = `<div style="border:2px solid #c33;border-radius:6px;padding:8px;background:#2a1111;">
          <strong style="color:#f66;">🏹 ÚLTIMA MUNIÇÃO!</strong><br>
          <em>${actor.name}</em> usou a última <strong>${ammoItem.name}</strong> com <strong>${weapon.name}</strong>!
        </div>`;
      } else if (lowThreshold > 0 && newQty <= lowThreshold) {
        msg = `<div style="border:1px solid #c93;border-radius:6px;padding:8px;background:#2a2211;">
          <strong style="color:#fc6;">🏹 Munição baixa!</strong><br>
          <em>${actor.name}</em> usou 1× <strong>${ammoItem.name}</strong>. Restam: <strong style="color:#fc6;">${newQty}</strong>
        </div>`;
      } else {
        msg = `<div style="border:1px solid #396;border-radius:6px;padding:6px;background:#112211;">
          🏹 <em>${actor.name}</em> usou 1× <strong>${ammoItem.name}</strong>. Restam: <strong>${newQty}</strong>
        </div>`;
      }
      ChatMessage.create({ content: msg, speaker: { alias: actor.name } });
    }
  } catch (e) {
    console.error(`[${MODULE_ID}] Erro na subtração de munição:`, e);
  }
});

// ============================================================
// HOOK: SNAPSHOT DE MUNIÇÃO AO INICIAR COMBATE
// ============================================================

Hooks.on("createCombat", async (combat) => {
  if (!game.settings.get(MODULE_ID, "ammoRecovery")) return;
  if (!game.user.isGM) return;

  debugNotify("Combate iniciado — salvando snapshot de munição.");

  const snapshot = {};

  // Para cada combatente, salvar a quantidade atual de munição vinculada
  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor || actor.type !== "char") continue;

    const weapons = actor.items.filter(i =>
      i.type === "weapon" && i.getFlag(MODULE_ID, FLAG_AMMO_ID)
    );

    if (weapons.length === 0) continue;

    snapshot[actor.id] = {};
    for (const weapon of weapons) {
      const ammoId = weapon.getFlag(MODULE_ID, FLAG_AMMO_ID);
      const ammoItem = actor.items.get(ammoId);
      if (ammoItem) {
        snapshot[actor.id][ammoId] = {
          weaponName: weapon.name,
          ammoName: ammoItem.name,
          startQty: ammoItem.system?.quantity ?? 0,
        };
      }
    }
  }

  await combat.setFlag(MODULE_ID, FLAG_COMBAT_AMMO_SNAPSHOT, snapshot);
  log("Snapshot de munição salvo:", snapshot);
});

// ============================================================
// HOOK: RECUPERAÇÃO DE MUNIÇÃO AO FIM DO COMBATE
// ============================================================

Hooks.on("deleteCombat", async (combat) => {
  if (!game.settings.get(MODULE_ID, "ammoRecovery")) return;
  if (!game.user.isGM) return;

  const snapshot = combat.getFlag(MODULE_ID, FLAG_COMBAT_AMMO_SNAPSHOT);
  if (!snapshot) return;

  const recoveryPercent = game.settings.get(MODULE_ID, "ammoRecoveryPercent") / 100;
  let reportLines = [];

  for (const [actorId, ammoData] of Object.entries(snapshot)) {
    const actor = game.actors.get(actorId);
    if (!actor) continue;

    for (const [ammoId, info] of Object.entries(ammoData)) {
      const ammoItem = actor.items.get(ammoId);
      if (!ammoItem) continue;

      const currentQty = ammoItem.system?.quantity ?? 0;
      const spent = info.startQty - currentQty;

      if (spent <= 0) continue;

      const recovered = Math.floor(spent * recoveryPercent);
      if (recovered <= 0) continue;

      const newQty = currentQty + recovered;
      await ammoItem.update({ "system.quantity": newQty });

      reportLines.push(
        `<strong>${actor.name}</strong>: recuperou ${recovered}× <em>${info.ammoName}</em> ` +
        `(gastou ${spent}, recuperou ${Math.round(recoveryPercent * 100)}%). Total: ${newQty}`
      );
    }
  }

  if (reportLines.length > 0) {
    ChatMessage.create({
      content: `<div style="border:1px solid #396;border-radius:6px;padding:8px;background:#112211;">
        <strong style="color:#6f6;">🏹 Recuperação de Munição Pós-Combate</strong>
        <hr style="border-color:#396;">
        ${reportLines.map(l => `<p>${l}</p>`).join("")}
      </div>`,
      speaker: { alias: "AGE Resource Tracker" },
    });
  }
});

// ============================================================
// HOOK: CONSUMO DE ÁGUA NO BREATHER
// ============================================================

Hooks.on("createChatMessage", async (message, options, userId) => {
  if (!game.settings.get(MODULE_ID, "consumeOnBreather")) return;
  if (game.userId !== userId) return;

  // Breather gera uma mensagem com flavor "{nome} | Breather" (ou localizado)
  const flavor = message.flavor || "";
  const breatherStr = game.i18n?.localize("age-system.breather") || "Breather";

  if (!flavor.includes(breatherStr)) return;

  debugNotify(`Breather detectado! Flavor: "${flavor}"`);

  // Extrair o nome do ator do flavor (formato: "Nome | Breather")
  const actorName = flavor.split("|")[0]?.trim();
  if (!actorName) return;

  // Encontrar o ator pelo nome
  const actor = game.actors.find(a => a.name === actorName && a.type === "char");
  if (!actor) {
    log("Ator do breather não encontrado:", actorName);
    return;
  }

  await consumeProvision(actor, "water", "💧");
});

// ============================================================
// COMANDOS DE CHAT
// ============================================================

Hooks.on("chatMessage", (chatLog, messageText, chatData) => {
  const cmd = messageText.trim().toLowerCase();

  // ── /municao ou /ammo ──
  if (cmd === "/municao" || cmd === "/ammo") {
    ammoReport();
    return false;
  }

  // ── /descanso ou /longrest ──
  if (cmd === "/descanso" || cmd === "/longrest") {
    longRest();
    return false;
  }

  // ── /provisoes ──
  if (cmd === "/provisoes" || cmd === "/provisions") {
    provisionsReport();
    return false;
  }
});

// ── Relatório de Munição ──
function ammoReport() {
  const speaker = ChatMessage.getSpeaker();
  const actor = game.actors.get(speaker.actor);
  if (!actor) return ui.notifications.warn("Selecione um token.");

  const weapons = actor.items.filter(i =>
    i.type === "weapon" && i.getFlag(MODULE_ID, FLAG_AMMO_ID)
  );

  if (weapons.length === 0) {
    ChatMessage.create({
      content: `<div style="border:1px solid #666;border-radius:6px;padding:8px;">
        🏹 <strong>${actor.name}</strong> não tem armas com munição vinculada.
      </div>`,
      speaker: { alias: actor.name },
    });
    return;
  }

  let report = `<div style="border:1px solid #396;border-radius:6px;padding:8px;">
    <strong>🏹 Munição — ${actor.name}</strong><hr style="border-color:#396;">`;
  for (const w of weapons) {
    const ammoItem = actor.items.get(w.getFlag(MODULE_ID, FLAG_AMMO_ID));
    if (ammoItem) {
      const qty = ammoItem.system?.quantity ?? 0;
      const color = qty <= 0 ? "#f66" : qty <= 5 ? "#fc6" : "#6f6";
      report += `<p><strong>${w.name}</strong> → ${ammoItem.name}: <span style="color:${color};font-weight:bold;">${qty}</span></p>`;
    } else {
      report += `<p><strong>${w.name}</strong> → <span style="color:#f66;">⚠️ Não encontrado</span></p>`;
    }
  }
  report += `</div>`;
  ChatMessage.create({ content: report, speaker: { alias: actor.name } });
}

// ── Descanso Longo ──
async function longRest() {
  if (!game.settings.get(MODULE_ID, "consumeOnLongRest")) return;

  const speaker = ChatMessage.getSpeaker();
  const actor = game.actors.get(speaker.actor);
  if (!actor) return ui.notifications.warn("Selecione um token.");

  const foodResult = await consumeProvision(actor, "food", "🍞");
  const waterResult = await consumeProvision(actor, "water", "💧");

  let lines = [];
  if (foodResult) lines.push(foodResult);
  if (waterResult) lines.push(waterResult);

  const restContent = lines.length > 0
    ? lines.join("<br>")
    : "Nenhuma provisão vinculada.";

  ChatMessage.create({
    content: `<div style="border:1px solid #69c;border-radius:6px;padding:8px;background:#111122;">
      <strong style="color:#9cf;">🏕️ Descanso Longo — ${actor.name}</strong>
      <hr style="border-color:#69c;">
      <p>${restContent}</p>
    </div>`,
    speaker: { alias: actor.name },
  });
}

// ── Relatório de Provisões ──
function provisionsReport() {
  const speaker = ChatMessage.getSpeaker();
  const actor = game.actors.get(speaker.actor);
  if (!actor) return ui.notifications.warn("Selecione um token.");

  const foodId = actor.getFlag(MODULE_ID, FLAG_FOOD_ID);
  const waterId = actor.getFlag(MODULE_ID, FLAG_WATER_ID);
  const foodItem = foodId ? actor.items.get(foodId) : null;
  const waterItem = waterId ? actor.items.get(waterId) : null;

  const foodLine = foodItem
    ? `🍞 <strong>${foodItem.name}</strong>: <span style="color:#6f6;font-weight:bold;">${foodItem.system?.quantity ?? 0}</span>`
    : `🍞 <span style="color:#888;">Nenhuma comida vinculada</span>`;
  const waterLine = waterItem
    ? `💧 <strong>${waterItem.name}</strong>: <span style="color:#6f6;font-weight:bold;">${waterItem.system?.quantity ?? 0}</span>`
    : `💧 <span style="color:#888;">Nenhuma água vinculada</span>`;

  ChatMessage.create({
    content: `<div style="border:1px solid #69c;border-radius:6px;padding:8px;background:#111122;">
      <strong style="color:#9cf;">🍖 Provisões — ${actor.name}</strong>
      <hr style="border-color:#69c;">
      <p>${foodLine}</p>
      <p>${waterLine}</p>
    </div>`,
    speaker: { alias: actor.name },
  });
}

// ============================================================
// FUNÇÃO AUXILIAR: CONSUMIR PROVISÃO
// ============================================================

async function consumeProvision(actor, type, emoji) {
  const flagKey = type === "food" ? FLAG_FOOD_ID : FLAG_WATER_ID;
  const label = type === "food" ? "Comida" : "Água";
  const itemId = actor.getFlag(MODULE_ID, flagKey);
  if (!itemId) return null;

  const item = actor.items.get(itemId);
  if (!item) {
    await actor.unsetFlag(MODULE_ID, flagKey);
    return `${emoji} <span style="color:#f66;">${label} vinculada não encontrada!</span>`;
  }

  const qty = item.system?.quantity;
  if (qty === undefined || qty === null) return null;

  if (qty <= 0) {
    return `${emoji} <strong style="color:#f66;">${actor.name} não tem mais ${item.name}!</strong>`;
  }

  const newQty = qty - 1;
  await item.update({ "system.quantity": newQty });

  const color = newQty <= 0 ? "#f66" : newQty <= 3 ? "#fc6" : "#6f6";
  return `${emoji} ${actor.name} consumiu 1× <strong>${item.name}</strong>. Restam: <span style="color:${color};font-weight:bold;">${newQty}</span>`;
}
