/**
 * AGE Provisions Tracker v3.0
 * Módulo para Foundry VTT + AGE System (VkDolea)
 *
 * - Descanso Longo: pergunta se quer consumir 1 ração, cura 10 + Con + Nível
 * - Breather: consome bebida alcoólica ou healing kit automaticamente
 */

const MODULE_ID = "age-ammo-tracker";
const FLAG_FOOD_ID = "foodItemId";
const FLAG_BREATHER_ID = "breatherItemId";

const STYLE = {
  normal: "border:1px solid #7caa8e; border-radius:6px; padding:8px; background:#1e2e26; color:#c8e6d0;",
  warn:   "border:1px solid #c9a95c; border-radius:6px; padding:8px; background:#2e2a1e; color:#f0dca0;",
  danger: "border:1px solid #b07070; border-radius:6px; padding:8px; background:#2e1e1e; color:#e8b0b0;",
  rest:   "border:1px solid #7ca0c9; border-radius:6px; padding:8px; background:#1e2430; color:#b0d0e8;",
};

// ── INICIALIZAÇÃO ──

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Inicializando AGE Provisions Tracker v3.0`);

  game.settings.register(MODULE_ID, "consumeOnBreather", {
    name: "Consumir Suprimento no Breather",
    hint: "Consome 1 bebida alcoólica ou 1 uso de healing kit ao usar Breather.",
    scope: "world", config: true, type: Boolean, default: true,
  });

  game.settings.register(MODULE_ID, "healOnLongRest", {
    name: "Curar no Descanso Longo",
    hint: "Cura 10 + Constituição + Nível ao descansar.",
    scope: "world", config: true, type: Boolean, default: true,
  });
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | AGE Provisions Tracker v3.0 pronto!`);
});

// ── BOTÕES NA FICHA DO PERSONAGEM ──

Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  const actor = sheet.actor || sheet.object;
  if (!actor || actor.type !== "char") return;

  buttons.unshift({
    label: "🏕️ Descanso Longo",
    class: "age-long-rest",
    icon: "",
    onclick: () => doLongRest(actor),
  });

  buttons.unshift({
    label: "🍖 Provisões",
    class: "age-provisions-link",
    icon: "",
    onclick: () => openProvisionsDialog(actor),
  });
});

// ── DIÁLOGO: PROVISÕES ──

async function openProvisionsDialog(actor) {
  const equipment = actor.items.filter(i => i.type === "equipment");
  if (equipment.length === 0) return ui.notifications.warn("Sem equipamentos no inventário.");

  const foodId = actor.getFlag(MODULE_ID, FLAG_FOOD_ID) || "";
  const breatherId = actor.getFlag(MODULE_ID, FLAG_BREATHER_ID) || "";

  function buildSelect(id, currentId) {
    let html = '<option value="">-- Nenhum --</option>';
    for (const i of equipment) {
      html += '<option value="' + i.id + '" ' + (i.id === currentId ? "selected" : "") + '>' + i.name + ' [' + (i.system?.quantity ?? "?") + ']</option>';
    }
    return '<select id="' + id + '" style="width:100%;padding:4px;">' + html + '</select>';
  }

  function currentLabel(itemId) {
    const item = itemId ? actor.items.get(itemId) : null;
    if (item) return '<span style="color:#7caa8e;">' + item.name + ' [' + (item.system?.quantity ?? 0) + ']</span>';
    return '<span style="color:#888;">—</span>';
  }

  new Dialog({
    title: "🍖 Provisões — " + actor.name,
    content: '<form>' +
      '<p style="font-size:12px;color:#b0d0e8;margin-bottom:10px;border-bottom:1px solid #555;padding-bottom:6px;"><strong>🏕️ Descanso Longo</strong></p>' +
      '<div class="form-group"><label>🍞 Rações: ' + currentLabel(foodId) + '</label>' + buildSelect("food-select", foodId) + '</div>' +
      '<p style="font-size:10px;color:#888;margin-top:4px;">Ao descansar, o módulo perguntará se deseja consumir 1 ração.</p>' +
      '<p style="font-size:12px;color:#f0dca0;margin-top:14px;margin-bottom:10px;border-bottom:1px solid #555;padding-bottom:6px;"><strong>☕ Breather</strong></p>' +
      '<div class="form-group"><label>🍺 Bebida / Kit de Cura: ' + currentLabel(breatherId) + '</label>' + buildSelect("breather-select", breatherId) + '</div>' +
      '<p style="font-size:10px;color:#888;margin-top:4px;">1 unidade consumida automaticamente a cada Breather.</p>' +
    '</form>',
    buttons: {
      save: {
        icon: '<i class="fas fa-check"></i>',
        label: "Salvar",
        callback: async (html) => {
          const fId = html.find("#food-select").val();
          const bId = html.find("#breather-select").val();
          if (fId) await actor.setFlag(MODULE_ID, FLAG_FOOD_ID, fId);
          else await actor.unsetFlag(MODULE_ID, FLAG_FOOD_ID);
          if (bId) await actor.setFlag(MODULE_ID, FLAG_BREATHER_ID, bId);
          else await actor.unsetFlag(MODULE_ID, FLAG_BREATHER_ID);
          ui.notifications.info("✅ Provisões de " + actor.name + " atualizadas.");
        },
      },
      cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancelar" },
    },
    default: "save",
  }).render(true);
}

// ── DESCANSO LONGO ──

async function doLongRest(actor) {
  if (!actor || actor.type !== "char") return;

  const cons = actor.system?.abilities?.cons?.total ?? 0;
  const level = actor.system?.level ?? 0;
  const healAmount = 10 + cons + level;

  const foodId = actor.getFlag(MODULE_ID, FLAG_FOOD_ID);
  const foodItem = foodId ? actor.items.get(foodId) : null;
  const foodQty = foodItem ? (foodItem.system?.quantity ?? 0) : 0;

  // Montar info da ração para o diálogo
  let foodInfo;
  if (!foodItem) {
    foodInfo = '<p style="color:#888;">🍞 Nenhuma ração vinculada.</p>';
  } else if (foodQty <= 0) {
    foodInfo = '<p style="color:#e8b0b0;">🍞 <strong>' + foodItem.name + '</strong> — sem estoque!</p>';
  } else {
    foodInfo = '<p>🍞 <strong>' + foodItem.name + '</strong> — ' + foodQty + ' restantes</p>';
  }

  // Diálogo com opção de consumir ração
  const result = await new Promise(resolve => {
    const hasFood = foodItem && foodQty > 0;

    let buttons = {};
    if (hasFood) {
      buttons.withFood = {
        icon: '<i class="fas fa-utensils"></i>',
        label: "Descansar e Consumir Ração",
        callback: () => resolve("withFood"),
      };
    }
    buttons.withoutFood = {
      icon: '<i class="fas fa-bed"></i>',
      label: hasFood ? "Descansar sem Consumir" : "Descansar",
      callback: () => resolve("withoutFood"),
    };
    buttons.cancel = {
      icon: '<i class="fas fa-times"></i>',
      label: "Cancelar",
      callback: () => resolve("cancel"),
    };

    new Dialog({
      title: "🏕️ Descanso Longo — " + actor.name,
      content: '<div style="margin-bottom:8px;">' +
        '<p>Deseja realizar um descanso longo?</p>' +
        '<p style="font-size:12px;color:#b0d0e8;">❤️ Cura: 10 + ' + cons + ' (Con) + ' + level + ' (Nv) = <strong>' + healAmount + '</strong></p>' +
        '<hr style="border-color:#555;">' +
        foodInfo +
        (hasFood ? '<p style="font-size:11px;color:#f0dca0;">Deseja consumir 1 ração?</p>' : '') +
        '</div>',
      buttons: buttons,
      default: hasFood ? "withFood" : "withoutFood",
      close: () => resolve("cancel"),
    }).render(true);
  });

  if (result === "cancel") return;

  let reportLines = [];

  // Consumir ração se escolheu
  if (result === "withFood" && foodItem) {
    const r = await consumeItem(actor, foodId);
    if (r) reportLines.push("🍞 " + r);
  } else if (result === "withoutFood" && foodItem && foodQty > 0) {
    reportLines.push('🍞 <span style="color:#f0dca0;">Optou por não consumir ração.</span>');
  }

  // Curar
  if (game.settings.get(MODULE_ID, "healOnLongRest")) {
    const currentHP = actor.system?.health?.value ?? 0;
    const maxHP = actor.system?.health?.max ?? 0;
    const newHP = Math.min(currentHP + healAmount, maxHP);
    const actualHeal = newHP - currentHP;
    if (actualHeal > 0) {
      await actor.update({ "system.health.value": newHP });
      reportLines.push("❤️ Curou <strong>" + actualHeal + "</strong> HP (10 + " + cons + " Con + " + level + " Nv). HP: " + newHP + "/" + maxHP);
    } else {
      reportLines.push("❤️ HP já está no máximo (" + maxHP + "/" + maxHP + ")");
    }
  }

  ChatMessage.create({
    content: '<div style="' + STYLE.rest + '"><strong>🏕️ Descanso Longo — ' + actor.name + '</strong><hr style="border-color:#7ca0c9;margin:6px 0;">' + reportLines.map(function(l) { return '<p style="margin:4px 0;">' + l + '</p>'; }).join("") + '</div>',
    speaker: { alias: actor.name },
  });
}

// ── BREATHER: CONSUMIR BEBIDA/KIT ──

Hooks.on("createChatMessage", async (message, options, userId) => {
  if (!game.settings.get(MODULE_ID, "consumeOnBreather")) return;
  if (game.userId !== userId) return;

  const breatherStr = game.i18n?.localize("age-system.breather") || "Breather";
  const flavor = message.flavor || "";
  const content = message.content || "";

  if (!flavor.includes(breatherStr) && !content.includes(breatherStr)) return;
  if (message.flags?.["age-system"]?.ageroll) return;
  if (!message.isRoll && (!message.rolls || message.rolls.length === 0)) return;

  // Encontrar o ator
  let actor = null;
  if (message.speaker?.actor) actor = game.actors.get(message.speaker.actor);
  if (!actor && message.speaker?.scene && message.speaker?.token) {
    const scene = game.scenes.get(message.speaker.scene);
    const tokenDoc = scene?.tokens?.get(message.speaker.token);
    actor = tokenDoc?.actor;
  }
  if (!actor && flavor.includes("|")) {
    const actorName = flavor.split("|")[0]?.trim();
    if (actorName) actor = game.actors.find(function(a) { return a.name === actorName && a.type === "char"; });
  }
  if (!actor || actor.type !== "char") return;

  const breatherId = actor.getFlag(MODULE_ID, FLAG_BREATHER_ID);
  if (!breatherId) return;

  const result = await consumeItem(actor, breatherId);
  if (result) {
    ChatMessage.create({
      content: '<div style="' + STYLE.warn + '"><strong>☕ Breather — ' + actor.name + '</strong><hr style="border-color:#c9a95c;margin:6px 0;"><p style="margin:4px 0;">' + result + '</p></div>',
      speaker: { alias: actor.name },
    });
  }
});

// ── COMANDOS DE CHAT ──

Hooks.on("chatMessage", (chatLog, messageText, chatData) => {
  const cmd = messageText.trim().toLowerCase();

  if (cmd === "/descanso" || cmd === "/longrest") {
    const speaker = ChatMessage.getSpeaker();
    const actor = game.actors.get(speaker.actor);
    if (!actor) { ui.notifications.warn("Selecione um token."); return false; }
    doLongRest(actor);
    return false;
  }

  if (cmd === "/provisoes" || cmd === "/provisions") {
    provisionsReport();
    return false;
  }
});

function provisionsReport() {
  const speaker = ChatMessage.getSpeaker();
  const actor = game.actors.get(speaker.actor);
  if (!actor) return ui.notifications.warn("Selecione um token.");

  function itemLine(emoji, itemId, fallback) {
    const item = itemId ? actor.items.get(itemId) : null;
    if (item) {
      const qty = item.system?.quantity ?? 0;
      const color = qty <= 0 ? "#e8b0b0" : qty <= 3 ? "#f0dca0" : "#c8e6d0";
      return emoji + ' <strong>' + item.name + '</strong>: <span style="color:' + color + ';font-weight:bold;">' + qty + '</span>';
    }
    return emoji + ' <span style="color:#888;">' + fallback + '</span>';
  }

  ChatMessage.create({
    content: '<div style="' + STYLE.rest + '"><strong>🍖 Provisões — ' + actor.name + '</strong><hr style="border-color:#7ca0c9;margin:6px 0;">' +
      '<p style="margin:4px 0;">' + itemLine("🍞", actor.getFlag(MODULE_ID, FLAG_FOOD_ID), "Sem rações") + '</p>' +
      '<p style="margin:4px 0;">' + itemLine("🍺", actor.getFlag(MODULE_ID, FLAG_BREATHER_ID), "Sem suprimento de breather") + '</p>' +
    '</div>',
    speaker: { alias: actor.name },
  });
}

// ── CONSUMIR ITEM ──

async function consumeItem(actor, itemId) {
  const item = actor.items.get(itemId);
  if (!item) return '<span style="color:#e8b0b0;">Item vinculado não encontrado!</span>';

  const qty = item.system?.quantity;
  if (qty === undefined || qty === null) return null;

  if (qty <= 0) return '<strong style="color:#e8b0b0;">' + actor.name + ' não tem mais ' + item.name + '!</strong>';

  const newQty = qty - 1;
  await item.update({ "system.quantity": newQty });

  const color = newQty <= 0 ? "#e8b0b0" : newQty <= 3 ? "#f0dca0" : "#c8e6d0";
  return 'Consumiu 1× <strong>' + item.name + '</strong>. Restam: <span style="color:' + color + ';font-weight:bold;">' + newQty + '</span>';
}
