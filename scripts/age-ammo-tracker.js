/**
 * AGE Resource Tracker v2.1
 * Módulo para Foundry VTT + AGE System (VkDolea)
 */

const MODULE_ID = "age-ammo-tracker";
const FLAG_AMMO_ID = "linkedAmmoId";
const FLAG_AMMO_NAME = "linkedAmmoName";
const FLAG_FOOD_ID = "foodItemId";
const FLAG_WATER_ID = "waterItemId";
const FLAG_BREATHER_ID = "breatherItemId";
const FLAG_COMBAT_AMMO_SNAPSHOT = "combatAmmoSnapshot";
const ATTACK_ROLL_TYPES = ["attack", "meleeAttack", "rangedAttack", "stuntAttack"];

const DEBUG = false;
function log(...args) { if (DEBUG) console.log(`[${MODULE_ID}]`, ...args); }

// ── ESTILOS PASTEL ──
const STYLE = {
  normal: `border:1px solid #7caa8e; border-radius:6px; padding:8px; background:#1e2e26; color:#c8e6d0;`,
  warn:   `border:1px solid #c9a95c; border-radius:6px; padding:8px; background:#2e2a1e; color:#f0dca0;`,
  danger: `border:1px solid #b07070; border-radius:6px; padding:8px; background:#2e1e1e; color:#e8b0b0;`,
  rest:   `border:1px solid #7ca0c9; border-radius:6px; padding:8px; background:#1e2430; color:#b0d0e8;`,
  combat: `border:1px solid #7caa8e; border-radius:6px; padding:8px; background:#1e2e26; color:#c8e6d0;`,
};

// ── INICIALIZAÇÃO ──
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Inicializando AGE Resource Tracker v2.1`);
  game.settings.register(MODULE_ID, "enabled", {
    name: "Ativar Rastreamento de Munição", hint: "Subtrai munição ao atacar.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  game.settings.register(MODULE_ID, "showAmmoChat", {
    name: "Exibir Consumo de Munição no Chat", hint: "Mostra mensagem a cada consumo.",
    scope: "world", config: true, type: Boolean, default: false,
  });
  game.settings.register(MODULE_ID, "warnLowAmmo", {
    name: "Aviso de Munição Baixa (quantidade)", hint: "Aviso quando atinge esse valor. 0 = desativar.",
    scope: "world", config: true, type: Number, default: 5,
  });
  game.settings.register(MODULE_ID, "warnNoAmmo", {
    name: "Aviso ao Atacar sem Munição", hint: "Aviso no chat ao atacar com 0.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  game.settings.register(MODULE_ID, "ammoRecovery", {
    name: "Recuperar Munição ao Fim do Combate", hint: "Recupera parte da munição gasta.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  game.settings.register(MODULE_ID, "ammoRecoveryPercent", {
    name: "% de Recuperação de Munição", hint: "Percentual da munição gasta recuperada.",
    scope: "world", config: true, type: Number, default: 50,
    range: { min: 0, max: 100, step: 5 },
  });
  game.settings.register(MODULE_ID, "consumeOnBreather", {
    name: "Consumir Suprimento no Breather", hint: "Consome bebida alcoólica ou healing kit.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  game.settings.register(MODULE_ID, "consumeOnLongRest", {
    name: "Consumir Comida e Água no Descanso Longo", hint: "Consome 1 comida + 1 água.",
    scope: "world", config: true, type: Boolean, default: true,
  });
  game.settings.register(MODULE_ID, "healOnLongRest", {
    name: "Curar no Descanso Longo", hint: "Cura 10 + Constituição + Nível.",
    scope: "world", config: true, type: Boolean, default: true,
  });
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | AGE Resource Tracker v2.1 pronto!`);
});

// ── BOTÕES NAS FICHAS ──
Hooks.on("getItemSheetHeaderButtons", (sheet, buttons) => {
  const item = sheet.item || sheet.object;
  if (!item || item.type !== "weapon" || !item.actor) return;
  buttons.unshift({ label: "🏹 Munição", class: "age-ammo-link", icon: "", onclick: () => openAmmoLinkDialog(item) });
});

Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  const actor = sheet.actor || sheet.object;
  if (!actor || actor.type !== "char") return;
  buttons.unshift({ label: "🏕️ Descanso", class: "age-long-rest", icon: "", onclick: () => doLongRest(actor) });
  buttons.unshift({ label: "🍖 Provisões", class: "age-provisions-link", icon: "", onclick: () => openProvisionsDialog(actor) });
});

// ── DIÁLOGO: MUNIÇÃO ──
async function openAmmoLinkDialog(weapon) {
  const actor = weapon.actor;
  if (!actor) return ui.notifications.warn("Arma precisa estar no inventário.");
  const candidates = actor.items.filter(i => (i.type === "equipment" || i.type === "weapon") && i.id !== weapon.id);
  if (candidates.length === 0) return ui.notifications.warn("Sem itens para vincular.");
  const currentId = weapon.getFlag(MODULE_ID, FLAG_AMMO_ID) || "";
  const currentName = weapon.getFlag(MODULE_ID, FLAG_AMMO_NAME) || "";
  let opts = `<option value="">-- Nenhuma --</option>`;
  for (const i of candidates) opts += `<option value="${i.id}" ${i.id === currentId ? "selected" : ""}>${i.name} [${i.system?.quantity ?? "?"}]</option>`;
  new Dialog({
    title: `🏹 Vincular Munição — ${weapon.name}`,
    content: `<form>${currentId ? `<p style="color:#7caa8e;font-weight:bold;">Atual: ${currentName}</p>` : `<p style="color:#888;">Sem munição vinculada.</p>`}<div class="form-group"><label>Item de munição:</label><select id="ammo-select" style="width:100%;padding:4px;">${opts}</select></div></form>`,
    buttons: {
      save: { icon: '<i class="fas fa-check"></i>', label: "Salvar", callback: async (html) => {
        const id = html.find("#ammo-select").val();
        if (id) { const item = actor.items.get(id); await weapon.setFlag(MODULE_ID, FLAG_AMMO_ID, id); await weapon.setFlag(MODULE_ID, FLAG_AMMO_NAME, item.name); ui.notifications.info(`✅ ${weapon.name} → ${item.name}`); }
        else { await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_ID); await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_NAME); ui.notifications.info(`❌ Vínculo removido de ${weapon.name}`); }
      }},
      cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancelar" },
    }, default: "save",
  }).render(true);
}

// ── DIÁLOGO: PROVISÕES ──
async function openProvisionsDialog(actor) {
  const equipment = actor.items.filter(i => i.type === "equipment");
  if (equipment.length === 0) return ui.notifications.warn("Sem equipamentos no inventário.");
  const foodId = actor.getFlag(MODULE_ID, FLAG_FOOD_ID) || "";
  const waterId = actor.getFlag(MODULE_ID, FLAG_WATER_ID) || "";
  const breatherId = actor.getFlag(MODULE_ID, FLAG_BREATHER_ID) || "";
  function buildSelect(id, currentId) {
    let html = `<option value="">-- Nenhum --</option>`;
    for (const i of equipment) html += `<option value="${i.id}" ${i.id === currentId ? "selected" : ""}>${i.name} [${i.system?.quantity ?? "?"}]</option>`;
    return `<select id="${id}" style="width:100%;padding:4px;">${html}</select>`;
  }
  function currentLabel(itemId) {
    const item = itemId ? actor.items.get(itemId) : null;
    return item ? `<span style="color:#7caa8e;">${item.name} [${item.system?.quantity ?? 0}]</span>` : `<span style="color:#888;">—</span>`;
  }
  new Dialog({
    title: `🍖 Provisões — ${actor.name}`,
    content: `<form>
      <p style="font-size:12px;color:#b0d0e8;margin-bottom:10px;border-bottom:1px solid #555;padding-bottom:6px;"><strong>🏕️ Descanso Longo</strong> — consumidos ao descansar</p>
      <div class="form-group"><label>🍞 Comida: ${currentLabel(foodId)}</label>${buildSelect("food-select", foodId)}</div>
      <div class="form-group" style="margin-top:6px;"><label>💧 Água: ${currentLabel(waterId)}</label>${buildSelect("water-select", waterId)}</div>
      <p style="font-size:12px;color:#f0dca0;margin-top:14px;margin-bottom:10px;border-bottom:1px solid #555;padding-bottom:6px;"><strong>☕ Breather</strong> — consumido ao usar Breather</p>
      <div class="form-group"><label>🍺 Bebida / Kit de Cura: ${currentLabel(breatherId)}</label>${buildSelect("breather-select", breatherId)}</div>
      <p style="font-size:10px;color:#888;margin-top:8px;">Vincule uma bebida alcoólica ou healing kit. 1 unidade será consumida a cada Breather.</p>
    </form>`,
    buttons: {
      save: { icon: '<i class="fas fa-check"></i>', label: "Salvar", callback: async (html) => {
        const fId = html.find("#food-select").val();
        const wId = html.find("#water-select").val();
        const bId = html.find("#breather-select").val();
        if (fId) await actor.setFlag(MODULE_ID, FLAG_FOOD_ID, fId); else await actor.unsetFlag(MODULE_ID, FLAG_FOOD_ID);
        if (wId) await actor.setFlag(MODULE_ID, FLAG_WATER_ID, wId); else await actor.unsetFlag(MODULE_ID, FLAG_WATER_ID);
        if (bId) await actor.setFlag(MODULE_ID, FLAG_BREATHER_ID, bId); else await actor.unsetFlag(MODULE_ID, FLAG_BREATHER_ID);
        ui.notifications.info(`✅ Provisões de ${actor.name} atualizadas.`);
      }},
      cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancelar" },
    }, default: "save",
  }).render(true);
}

// ── SUBTRAÇÃO DE MUNIÇÃO ──
Hooks.on("createChatMessage", async (message, options, userId) => {
  try {
    if (!game.settings.get(MODULE_ID, "enabled")) return;
    if (game.userId !== userId) return;
    const ageRoll = message.flags?.["age-system"]?.ageroll;
    if (!ageRoll) return;
    if (!ATTACK_ROLL_TYPES.includes(ageRoll.rollType)) return;
    const rollData = ageRoll.rollData;
    if (!rollData?.itemId || !rollData?.actorId) return;
    let actor = await fromUuid(rollData.actorId);
    actor = actor?.actor ?? actor;
    if (!actor) return;
    const weapon = actor.items.get(rollData.itemId);
    if (!weapon || weapon.type !== "weapon") return;
    const ammoId = weapon.getFlag(MODULE_ID, FLAG_AMMO_ID);
    if (!ammoId) return;
    const ammoItem = actor.items.get(ammoId);
    if (!ammoItem) { ui.notifications.warn(`⚠️ Munição de ${weapon.name} não encontrada!`); await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_ID); await weapon.unsetFlag(MODULE_ID, FLAG_AMMO_NAME); return; }
    const currentQty = ammoItem.system?.quantity;
    if (currentQty === undefined || currentQty === null) return;
    if (currentQty <= 0) {
      if (game.settings.get(MODULE_ID, "warnNoAmmo")) ChatMessage.create({ content: `<div style="${STYLE.danger}"><strong>⚠️ SEM MUNIÇÃO!</strong><br><em>${actor.name}</em> atacou com <strong>${weapon.name}</strong>, mas não tem mais <strong>${ammoItem.name}</strong>!</div>`, speaker: { alias: actor.name } });
      return;
    }
    const newQty = currentQty - 1;
    await ammoItem.update({ "system.quantity": newQty });
    if (game.settings.get(MODULE_ID, "showAmmoChat")) {
      const low = game.settings.get(MODULE_ID, "warnLowAmmo");
      let msg;
      if (newQty <= 0) msg = `<div style="${STYLE.danger}"><strong>🏹 Última munição!</strong><br><em>${actor.name}</em> usou a última <strong>${ammoItem.name}</strong> com <strong>${weapon.name}</strong>.</div>`;
      else if (low > 0 && newQty <= low) msg = `<div style="${STYLE.warn}"><strong>🏹 Munição baixa</strong><br><em>${actor.name}</em> usou 1× <strong>${ammoItem.name}</strong>. Restam: <strong>${newQty}</strong></div>`;
      else msg = `<div style="${STYLE.normal}">🏹 <em>${actor.name}</em> usou 1× <strong>${ammoItem.name}</strong>. Restam: <strong>${newQty}</strong></div>`;
      ChatMessage.create({ content: msg, speaker: { alias: actor.name } });
    }
  } catch (e) { console.error(`[${MODULE_ID}] Erro munição:`, e); }
});

// ── SNAPSHOT COMBATE ──
Hooks.on("createCombat", async (combat) => {
  if (!game.settings.get(MODULE_ID, "ammoRecovery") || !game.user.isGM) return;
  const snapshot = {};
  for (const c of combat.combatants) {
    const actor = c.actor; if (!actor || actor.type !== "char") continue;
    const weapons = actor.items.filter(i => i.type === "weapon" && i.getFlag(MODULE_ID, FLAG_AMMO_ID));
    if (weapons.length === 0) continue;
    snapshot[actor.id] = {};
    for (const w of weapons) {
      const ammoId = w.getFlag(MODULE_ID, FLAG_AMMO_ID); const ammo = actor.items.get(ammoId);
      if (ammo) snapshot[actor.id][ammoId] = { weaponName: w.name, ammoName: ammo.name, startQty: ammo.system?.quantity ?? 0 };
    }
  }
  await combat.setFlag(MODULE_ID, FLAG_COMBAT_AMMO_SNAPSHOT, snapshot);
});

// ── RECUPERAÇÃO PÓS-COMBATE ──
Hooks.on("deleteCombat", async (combat) => {
  if (!game.settings.get(MODULE_ID, "ammoRecovery") || !game.user.isGM) return;
  const snapshot = combat.getFlag(MODULE_ID, FLAG_COMBAT_AMMO_SNAPSHOT); if (!snapshot) return;
  const pct = game.settings.get(MODULE_ID, "ammoRecoveryPercent") / 100;
  let lines = [];
  for (const [actorId, ammoData] of Object.entries(snapshot)) {
    const actor = game.actors.get(actorId); if (!actor) continue;
    for (const [ammoId, info] of Object.entries(ammoData)) {
      const ammo = actor.items.get(ammoId); if (!ammo) continue;
      const current = ammo.system?.quantity ?? 0; const spent = info.startQty - current;
      if (spent <= 0) continue; const recovered = Math.floor(spent * pct); if (recovered <= 0) continue;
      const newQty = current + recovered; await ammo.update({ "system.quantity": newQty });
      lines.push(`<strong>${actor.name}</strong>: +${recovered}× <em>${info.ammoName}</em> (gastou ${spent}, total: ${newQty})`);
    }
  }
  if (lines.length > 0) ChatMessage.create({
    content: `<div style="${STYLE.combat}"><strong>🏹 Recuperação Pós-Combate</strong><hr style="border-color:#7caa8e;margin:6px 0;">${lines.map(l => `<p style="margin:4px 0;">${l}</p>`).join("")}</div>`,
    speaker: { alias: "AGE Resource Tracker" },
  });
});

// ── BREATHER: CONSUMIR BEBIDA/KIT ──
Hooks.on("createChatMessage", async (message, options, userId) => {
  if (!game.settings.get(MODULE_ID, "consumeOnBreather")) return;
  if (game.userId !== userId) return;
  const flavor = message.flavor || "";
  const breatherStr = game.i18n?.localize("age-system.breather") || "Breather";
  if (!flavor.includes(breatherStr)) return;
  const actorName = flavor.split("|")[0]?.trim();
  if (!actorName) return;
  const actor = game.actors.find(a => a.name === actorName && a.type === "char");
  if (!actor) return;
  const breatherId = actor.getFlag(MODULE_ID, FLAG_BREATHER_ID);
  if (!breatherId) return;
  const result = await consumeItem(actor, breatherId);
  if (result) ChatMessage.create({
    content: `<div style="${STYLE.warn}"><strong>☕ Breather — ${actor.name}</strong><hr style="border-color:#c9a95c;margin:6px 0;"><p style="margin:4px 0;">${result}</p></div>`,
    speaker: { alias: actor.name },
  });
});

// ── DESCANSO LONGO ──
async function doLongRest(actor) {
  if (!actor || actor.type !== "char") return;
  const cons = actor.system?.abilities?.cons?.total ?? 0;
  const level = actor.system?.level ?? 0;
  const healFormula = `10 + ${cons} (Con) + ${level} (Nv) = ${10 + cons + level}`;
  const confirmed = await new Promise(resolve => {
    new Dialog({
      title: `🏕️ Descanso Longo — ${actor.name}`,
      content: `<p>Deseja realizar um descanso longo?</p><p style="font-size:11px;color:#888;">Cura: ${healFormula}<br>Consome: 1 comida + 1 água (se vinculados)</p>`,
      buttons: {
        yes: { icon: '<i class="fas fa-bed"></i>', label: "Descansar", callback: () => resolve(true) },
        no: { icon: '<i class="fas fa-times"></i>', label: "Cancelar", callback: () => resolve(false) },
      }, default: "yes", close: () => resolve(false),
    }).render(true);
  });
  if (!confirmed) return;
  let reportLines = [];
  if (game.settings.get(MODULE_ID, "consumeOnLongRest")) {
    const foodId = actor.getFlag(MODULE_ID, FLAG_FOOD_ID);
    const waterId = actor.getFlag(MODULE_ID, FLAG_WATER_ID);
    if (foodId) { const r = await consumeItem(actor, foodId); if (r) reportLines.push(`🍞 ${r}`); }
    else reportLines.push(`🍞 <span style="color:#888;">Sem comida vinculada</span>`);
    if (waterId) { const r = await consumeItem(actor, waterId); if (r) reportLines.push(`💧 ${r}`); }
    else reportLines.push(`💧 <span style="color:#888;">Sem água vinculada</span>`);
  }
  if (game.settings.get(MODULE_ID, "healOnLongRest")) {
    const healAmount = 10 + cons + level;
    const currentHP = actor.system?.health?.value ?? 0;
    const maxHP = actor.system?.health?.max ?? 0;
    const newHP = Math.min(currentHP + healAmount, maxHP);
    const actualHeal = newHP - currentHP;
    if (actualHeal > 0) {
      await actor.update({ "system.health.value": newHP });
      reportLines.push(`❤️ Curou <strong>${actualHeal}</strong> HP (10 + ${cons} Con + ${level} Nv). HP: ${newHP}/${maxHP}`);
    } else reportLines.push(`❤️ HP já está no máximo (${maxHP}/${maxHP})`);
  }
  ChatMessage.create({
    content: `<div style="${STYLE.rest}"><strong>🏕️ Descanso Longo — ${actor.name}</strong><hr style="border-color:#7ca0c9;margin:6px 0;">${reportLines.map(l => `<p style="margin:4px 0;">${l}</p>`).join("")}</div>`,
    speaker: { alias: actor.name },
  });
}

// ── COMANDOS DE CHAT ──
Hooks.on("chatMessage", (chatLog, messageText, chatData) => {
  const cmd = messageText.trim().toLowerCase();
  if (cmd === "/municao" || cmd === "/ammo") { ammoReport(); return false; }
  if (cmd === "/descanso" || cmd === "/longrest") {
    const speaker = ChatMessage.getSpeaker(); const actor = game.actors.get(speaker.actor);
    if (!actor) { ui.notifications.warn("Selecione um token."); return false; }
    doLongRest(actor); return false;
  }
  if (cmd === "/provisoes" || cmd === "/provisions") { provisionsReport(); return false; }
});

function ammoReport() {
  const speaker = ChatMessage.getSpeaker(); const actor = game.actors.get(speaker.actor);
  if (!actor) return ui.notifications.warn("Selecione um token.");
  const weapons = actor.items.filter(i => i.type === "weapon" && i.getFlag(MODULE_ID, FLAG_AMMO_ID));
  if (weapons.length === 0) { ChatMessage.create({ content: `<div style="${STYLE.normal}">🏹 <strong>${actor.name}</strong> não tem munição vinculada.</div>`, speaker: { alias: actor.name } }); return; }
  let rows = "";
  for (const w of weapons) {
    const ammo = actor.items.get(w.getFlag(MODULE_ID, FLAG_AMMO_ID));
    if (ammo) { const qty = ammo.system?.quantity ?? 0; const color = qty <= 0 ? "#e8b0b0" : qty <= 5 ? "#f0dca0" : "#c8e6d0"; rows += `<p style="margin:4px 0;"><strong>${w.name}</strong> → ${ammo.name}: <span style="color:${color};font-weight:bold;">${qty}</span></p>`; }
    else rows += `<p style="margin:4px 0;"><strong>${w.name}</strong> → <span style="color:#e8b0b0;">não encontrado</span></p>`;
  }
  ChatMessage.create({ content: `<div style="${STYLE.normal}"><strong>🏹 Munição — ${actor.name}</strong><hr style="border-color:#7caa8e;margin:6px 0;">${rows}</div>`, speaker: { alias: actor.name } });
}

function provisionsReport() {
  const speaker = ChatMessage.getSpeaker(); const actor = game.actors.get(speaker.actor);
  if (!actor) return ui.notifications.warn("Selecione um token.");
  function itemLine(emoji, itemId, fallback) {
    const item = itemId ? actor.items.get(itemId) : null;
    if (item) { const qty = item.system?.quantity ?? 0; const color = qty <= 0 ? "#e8b0b0" : qty <= 3 ? "#f0dca0" : "#c8e6d0"; return `${emoji} <strong>${item.name}</strong>: <span style="color:${color};font-weight:bold;">${qty}</span>`; }
    return `${emoji} <span style="color:#888;">${fallback}</span>`;
  }
  ChatMessage.create({
    content: `<div style="${STYLE.rest}"><strong>🍖 Provisões — ${actor.name}</strong><hr style="border-color:#7ca0c9;margin:6px 0;">
      <p style="margin:4px 0;">${itemLine("🍞", actor.getFlag(MODULE_ID, FLAG_FOOD_ID), "Sem comida")}</p>
      <p style="margin:4px 0;">${itemLine("💧", actor.getFlag(MODULE_ID, FLAG_WATER_ID), "Sem água")}</p>
      <p style="margin:4px 0;">${itemLine("🍺", actor.getFlag(MODULE_ID, FLAG_BREATHER_ID), "Sem suprimento de breather")}</p>
    </div>`,
    speaker: { alias: actor.name },
  });
}

// ── CONSUMIR ITEM ──
async function consumeItem(actor, itemId) {
  const item = actor.items.get(itemId);
  if (!item) return `<span style="color:#e8b0b0;">Item vinculado não encontrado!</span>`;
  const qty = item.system?.quantity;
  if (qty === undefined || qty === null) return null;
  if (qty <= 0) return `<strong style="color:#e8b0b0;">${actor.name} não tem mais ${item.name}!</strong>`;
  const newQty = qty - 1;
  await item.update({ "system.quantity": newQty });
  const color = newQty <= 0 ? "#e8b0b0" : newQty <= 3 ? "#f0dca0" : "#c8e6d0";
  return `Consumiu 1× <strong>${item.name}</strong>. Restam: <span style="color:${color};font-weight:bold;">${newQty}</span>`;
}
