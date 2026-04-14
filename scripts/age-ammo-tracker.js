/**
 * AGE Provisions Tracker v3.0
 * Modulo para Foundry VTT + AGE System (VkDolea)
 *
 * Sistema de acampamento com niveis de conforto, contribuicoes,
 * consumo de provisoes e cura automatica.
 */

const MODULE_ID = "age-ammo-tracker";
const FLAG_FOOD_ID = "foodItemId";
const FLAG_BREATHER_ID = "breatherItemId";

const COMFORT_TIERS = [
  { key: "terrible",    label: "Terrivel",    base: 0,  color: "#a93535", bg: "rgba(169,53,53,0.1)", border: "#a93535",
    fatigue: "Nao remove nenhuma condicao de Fadiga.",
    mp: "Recupera apenas metade dos Magic Points." },
  { key: "rudimentary", label: "Rudimentar",  base: 5,  color: "#b8860b", bg: "rgba(184,134,11,0.1)", border: "#b8860b",
    fatigue: "Remove apenas Winded.",
    mp: "Recupera apenas metade dos Magic Points." },
  { key: "modest",      label: "Modesto",     base: 10, color: "#4e8a4e", bg: "rgba(78,138,78,0.1)", border: "#4e8a4e",
    fatigue: "Regra padrao: remove Fadiga ate Tired. Exhausted cai para Tired.",
    mp: "Recupera todos os Magic Points." },
  { key: "comfortable", label: "Confortavel", base: 15, color: "#4a86c8", bg: "rgba(74,134,200,0.1)", border: "#4a86c8",
    fatigue: "Remove todas as condicoes de Fadiga, incluindo Exhausted.",
    mp: "Recupera todos os Magic Points." },
];

const STYLE = {
  card: "border:1px solid var(--color-border-dark-tertiary); border-radius:4px; padding:10px; background:var(--color-bg-option); color:var(--color-text-dark-primary);",
  breather: "border:1px solid var(--color-border-dark-tertiary); border-radius:4px; padding:8px; background:var(--color-bg-option); color:var(--color-text-dark-primary);",
};

// Camp state (module-level, used by the panel)
let campState = null;

// ============================================================
// INITIALIZATION
// ============================================================

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Inicializando AGE Provisions Tracker v3.0`);

  game.settings.register(MODULE_ID, "healOnLongRest", {
    name: "Curar no Descanso Longo",
    hint: "Aplica cura automatica baseada no patamar de conforto.",
    scope: "world", config: true, type: Boolean, default: true,
  });

  game.settings.register(MODULE_ID, "consumeOnBreather", {
    name: "Consumir Suprimento no Breather",
    hint: "Consome 1 unidade do item vinculado (bebida alcoolica ou healing kit) ao usar Breather.",
    scope: "world", config: true, type: Boolean, default: true,
  });
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | AGE Provisions Tracker v3.0 pronto!`);
});

// ============================================================
// UI: SCENE CONTROL BUTTON (GM) + CHARACTER SHEET BUTTON
// ============================================================

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;
  const tokenControls = controls.find(c => c.name === "token");
  if (tokenControls) {
    tokenControls.tools.push({
      name: "age-camp",
      title: "Acampamento",
      icon: "fas fa-campground",
      button: true,
      onClick: () => openCampPanel(),
      visible: game.user.isGM,
    });
  }
});

Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  const actor = sheet.actor || sheet.object;
  if (!actor || actor.type !== "char") return;
  buttons.unshift({
    label: "Provisoes",
    class: "age-provisions-link",
    icon: "fas fa-utensils",
    onclick: () => openProvisionsDialog(actor),
  });
});

// ============================================================
// PROVISIONS DIALOG (on character sheet)
// ============================================================

async function openProvisionsDialog(actor) {
  const equipment = actor.items.filter(i => i.type === "equipment");
  if (equipment.length === 0) return ui.notifications.warn("Sem equipamentos no inventario.");

  const foodId = actor.getFlag(MODULE_ID, FLAG_FOOD_ID) || "";
  const breatherId = actor.getFlag(MODULE_ID, FLAG_BREATHER_ID) || "";

  function buildSelect(id, currentId) {
    let html = '<option value="">-- Nenhum --</option>';
    for (const i of equipment) {
      html += '<option value="' + i.id + '"' + (i.id === currentId ? " selected" : "") + '>' + i.name + ' [' + (i.system?.quantity ?? "?") + ']</option>';
    }
    return '<select id="' + id + '" style="width:100%;padding:4px;">' + html + '</select>';
  }

  function currentLabel(itemId) {
    const item = itemId ? actor.items.get(itemId) : null;
    if (item) return '<span style="color:#4e8a4e;">' + item.name + ' [' + (item.system?.quantity ?? 0) + ']</span>';
    return '<span style="color:#888;">Nenhum</span>';
  }

  new Dialog({
    title: "Provisoes - " + actor.name,
    content: '<form style="padding:4px 0;">' +
      '<h3 style="border-bottom:1px solid var(--color-border-dark-tertiary);padding-bottom:4px;margin-bottom:8px;"><i class="fas fa-utensils"></i> Racoes de Viagem</h3>' +
      '<div class="form-group"><label>Atual: ' + currentLabel(foodId) + '</label>' + buildSelect("food-select", foodId) + '</div>' +
      '<p style="font-size:10px;color:#888;margin-top:4px;">Consumidas durante o Descanso Longo, se o jogador optar.</p>' +
      '<h3 style="border-bottom:1px solid var(--color-border-dark-tertiary);padding-bottom:4px;margin-top:16px;margin-bottom:8px;"><i class="fas fa-mug-hot"></i> Suprimento de Breather</h3>' +
      '<div class="form-group"><label>Atual: ' + currentLabel(breatherId) + '</label>' + buildSelect("breather-select", breatherId) + '</div>' +
      '<p style="font-size:10px;color:#888;margin-top:4px;">Bebida alcoolica ou kit de cura. 1 unidade consumida automaticamente a cada Breather.</p>' +
    '</form>',
    buttons: {
      save: {
        icon: '<i class="fas fa-check"></i>', label: "Salvar",
        callback: async (html) => {
          const fId = html.find("#food-select").val();
          const bId = html.find("#breather-select").val();
          if (fId) await actor.setFlag(MODULE_ID, FLAG_FOOD_ID, fId);
          else await actor.unsetFlag(MODULE_ID, FLAG_FOOD_ID);
          if (bId) await actor.setFlag(MODULE_ID, FLAG_BREATHER_ID, bId);
          else await actor.unsetFlag(MODULE_ID, FLAG_BREATHER_ID);
          ui.notifications.info("Provisoes de " + actor.name + " atualizadas.");
        },
      },
      cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancelar" },
    },
    default: "save",
  }).render(true);
}

// ============================================================
// CAMP PANEL
// ============================================================

function openCampPanel() {
  if (!game.user.isGM) return ui.notifications.warn("Apenas o Mestre pode abrir o painel de acampamento.");

  const pcs = game.actors.filter(a => a.type === "char" && a.hasPlayerOwner);
  if (pcs.length === 0) return ui.notifications.warn("Nenhum personagem de jogador encontrado.");

  campState = {
    comfort: 2,
    contributions: {},
  };
  for (const pc of pcs) {
    campState.contributions[pc.id] = false;
  }

  renderCampDialog(pcs);
}

function renderCampDialog(pcs) {
  const tier = COMFORT_TIERS[campState.comfort];

  // Comfort tier selector
  let tierHTML = '<div style="display:flex;gap:4px;margin-bottom:12px;">';
  for (let i = 0; i < COMFORT_TIERS.length; i++) {
    const t = COMFORT_TIERS[i];
    const isActive = i === campState.comfort;
    tierHTML += '<button type="button" class="camp-tier-btn' + (isActive ? ' active' : '') + '" data-tier="' + i + '" ' +
      'style="flex:1;padding:6px 4px;border:2px solid ' + (isActive ? t.border : '#666') + ';' +
      'background:' + (isActive ? t.bg : 'transparent') + ';color:' + (isActive ? t.color : '#666') + ';' +
      'border-radius:4px;cursor:pointer;font-size:11px;font-weight:' + (isActive ? 'bold' : 'normal') + ';">' +
      t.label + '<br><span style="font-size:13px;font-weight:bold;">+' + t.base + '</span>' +
    '</button>';
  }
  tierHTML += '</div>';

  // Tier effects summary
  let effectsHTML = '<div style="background:var(--color-bg-btn-default, #222);border-radius:4px;padding:8px;margin-bottom:14px;font-size:11px;border:1px solid ' + tier.border + ';">' +
    '<p style="margin:0 0 4px 0;"><i class="fas fa-heart" style="width:14px;color:#a93535;"></i> <strong>Cura:</strong> ' + tier.base + ' + Constituicao + Nivel</p>' +
    '<p style="margin:0 0 4px 0;"><i class="fas fa-bed" style="width:14px;color:#b8860b;"></i> <strong>Fadiga:</strong> ' + tier.fatigue + '</p>' +
    '<p style="margin:0;"><i class="fas fa-hat-wizard" style="width:14px;color:#4a86c8;"></i> <strong>Mana:</strong> ' + tier.mp + '</p>' +
  '</div>';

  // PC list
  let pcHTML = '<div style="border-top:1px solid var(--color-border-dark-tertiary);padding-top:8px;">' +
    '<h3 style="margin:0 0 8px 0;font-size:12px;text-transform:uppercase;color:#888;letter-spacing:1px;">' +
    '<i class="fas fa-users"></i> Personagens</h3>';

  for (const pc of pcs) {
    const contributed = campState.contributions[pc.id];
    const foodId = pc.getFlag(MODULE_ID, FLAG_FOOD_ID);
    const foodItem = foodId ? pc.items.get(foodId) : null;
    const foodQty = foodItem ? (foodItem.system?.quantity ?? 0) : -1;

    let foodLabel;
    if (!foodItem) foodLabel = '<span style="color:#666;">Sem racoes</span>';
    else if (foodQty <= 0) foodLabel = '<span style="color:#a93535;">' + foodItem.name + ' (0)</span>';
    else foodLabel = '<span style="color:#4e8a4e;">' + foodItem.name + ' (' + foodQty + ')</span>';

    pcHTML += '<div style="display:flex;align-items:center;padding:4px 6px;margin-bottom:4px;background:var(--color-bg-btn-default, #222);border-radius:4px;border:1px solid var(--color-border-dark-tertiary);">' +
      '<button type="button" class="camp-contrib-btn" data-actor="' + pc.id + '" title="Marcar contribuicao" ' +
        'style="width:28px;height:28px;border:1px solid ' + (contributed ? '#b8860b' : '#666') + ';' +
        'background:' + (contributed ? 'rgba(184,134,11,0.15)' : 'transparent') + ';color:' + (contributed ? '#b8860b' : '#666') + ';' +
        'border-radius:4px;cursor:pointer;margin-right:8px;font-size:14px;padding:0;line-height:28px;">' +
        '<i class="fas fa-star"></i></button>' +
      '<div style="flex:1;">' +
        '<div style="font-weight:bold;font-size:12px;">' + pc.name + '</div>' +
        '<div style="font-size:10px;"><i class="fas fa-utensils" style="width:12px;"></i> ' + foodLabel + '</div>' +
      '</div>' +
    '</div>';
  }
  pcHTML += '</div>';

  const content = '<div style="padding:2px 0;">' + tierHTML + effectsHTML + pcHTML + '</div>';

  const d = new Dialog({
    title: "Acampamento",
    content: content,
    buttons: {
      finalize: {
        icon: '<i class="fas fa-campground"></i>',
        label: "Finalizar Descanso",
        callback: () => finalizeCamp(pcs),
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancelar",
      },
    },
    render: (html) => {
      html.find(".camp-tier-btn").click(function(ev) {
        ev.preventDefault();
        campState.comfort = parseInt(this.dataset.tier);
        d.close();
        renderCampDialog(pcs);
      });
      html.find(".camp-contrib-btn").click(function(ev) {
        ev.preventDefault();
        const actorId = this.dataset.actor;
        campState.contributions[actorId] = !campState.contributions[actorId];
        d.close();
        renderCampDialog(pcs);
      });
    },
    default: "finalize",
  }, {
    width: 460,
    classes: ["age-camp-dialog"],
  });
  d.render(true);
}

// ============================================================
// FINALIZE CAMP: APPLY REST EFFECTS
// ============================================================

async function finalizeCamp(pcs) {
  const tier = COMFORT_TIERS[campState.comfort];
  const base = tier.base;

  let reportLines = [];
  reportLines.push('<div style="text-align:center;margin-bottom:8px;padding:6px;background:var(--color-bg-btn-default, #222);border-radius:4px;border:1px solid ' + tier.border + ';">' +
    '<strong style="font-size:13px;color:' + tier.color + ';">' + tier.label + '</strong>' +
    '<span style="color:#888;font-size:11px;"> (base +' + base + ')</span></div>');

  let contributorNames = [];
  for (const pc of pcs) {
    if (campState.contributions[pc.id]) contributorNames.push(pc.name);
  }
  if (contributorNames.length > 0) {
    reportLines.push('<p style="margin:4px 0;font-size:11px;color:#b8860b;"><i class="fas fa-star" style="width:14px;"></i> <strong>Contribuicoes:</strong> ' + contributorNames.join(", ") + '</p>');
  }

  reportLines.push('<hr style="border-color:var(--color-border-dark-tertiary);margin:8px 0;">');

  for (const pc of pcs) {
    let pcLines = [];
    const cons = pc.system?.abilities?.cons?.total ?? 0;
    const level = pc.system?.level ?? 0;

    // -- HEALING --
    if (game.settings.get(MODULE_ID, "healOnLongRest") && base > 0) {
      const healAmount = base + cons + level;
      const currentHP = pc.system?.health?.value ?? 0;
      const maxHP = pc.system?.health?.max ?? 0;
      const newHP = Math.min(currentHP + healAmount, maxHP);
      const actualHeal = newHP - currentHP;
      if (actualHeal > 0) {
        await pc.update({ "system.health.value": newHP });
        pcLines.push('<i class="fas fa-heart" style="width:14px;color:#a93535;"></i> +' + actualHeal + ' HP (' + base + '+' + cons + '+' + level + '). Agora: ' + newHP + '/' + maxHP);
      } else {
        pcLines.push('<i class="fas fa-heart" style="width:14px;color:#a93535;"></i> HP maximo (' + maxHP + '/' + maxHP + ')');
      }
    } else if (base === 0) {
      pcLines.push('<i class="fas fa-heart" style="width:14px;color:#a93535;"></i> Sem cura (descanso terrivel)');
    }

    // -- MAGIC POINTS --
    const currentMP = pc.system?.powerPoints?.value;
    const maxMP = pc.system?.powerPoints?.max;
    if (currentMP !== undefined && maxMP !== undefined && maxMP > 0) {
      if (campState.comfort >= 2) {
        if (currentMP < maxMP) {
          await pc.update({ "system.powerPoints.value": maxMP });
          pcLines.push('<i class="fas fa-hat-wizard" style="width:14px;color:#4a86c8;"></i> MP restaurados: ' + maxMP + '/' + maxMP);
        } else {
          pcLines.push('<i class="fas fa-hat-wizard" style="width:14px;color:#4a86c8;"></i> MP ja no maximo');
        }
      } else {
        const halfMax = Math.floor(maxMP / 2);
        const targetMP = Math.min(Math.max(currentMP, halfMax), maxMP);
        if (targetMP > currentMP) {
          await pc.update({ "system.powerPoints.value": targetMP });
          pcLines.push('<i class="fas fa-hat-wizard" style="width:14px;color:#4a86c8;"></i> MP parciais: ' + targetMP + '/' + maxMP + ' (metade)');
        } else {
          pcLines.push('<i class="fas fa-hat-wizard" style="width:14px;color:#4a86c8;"></i> MP: ' + currentMP + '/' + maxMP + ' (sem melhora)');
        }
      }
    }

    // -- PROVISIONS --
    const foodId = pc.getFlag(MODULE_ID, FLAG_FOOD_ID);
    if (foodId) {
      const foodItem = pc.items.get(foodId);
      if (foodItem) {
        const foodQty = foodItem.system?.quantity ?? 0;
        if (foodQty > 0) {
          const newQty = foodQty - 1;
          await foodItem.update({ "system.quantity": newQty });
          const qtyColor = newQty <= 0 ? "#a93535" : newQty <= 3 ? "#b8860b" : "#4e8a4e";
          pcLines.push('<i class="fas fa-utensils" style="width:14px;color:#b8860b;"></i> Consumiu 1x ' + foodItem.name + '. Restam: <span style="color:' + qtyColor + ';">' + newQty + '</span>');
        } else {
          pcLines.push('<i class="fas fa-utensils" style="width:14px;color:#b8860b;"></i> <span style="color:#a93535;">Sem racoes!</span>');
        }
      }
    }

    // Build PC section
    const contributed = campState.contributions[pc.id];
    reportLines.push(
      '<div style="margin-bottom:6px;padding:6px;background:var(--color-bg-btn-default, #222);border-radius:4px;border-left:3px solid ' + (contributed ? '#b8860b' : 'var(--color-border-dark-tertiary)') + ';">' +
        '<strong>' + pc.name + '</strong>' + (contributed ? ' <i class="fas fa-star" style="color:#b8860b;font-size:10px;" title="Contribuiu"></i>' : '') +
        pcLines.map(function(l) { return '<div style="margin-top:3px;font-size:11px;">' + l + '</div>'; }).join('') +
      '</div>'
    );
  }

  // -- FATIGUE NOTE --
  reportLines.push('<div style="margin-top:6px;padding:6px;background:var(--color-bg-btn-default, #222);border-radius:4px;font-size:11px;">' +
    '<i class="fas fa-bed" style="width:14px;color:#b8860b;"></i> <strong>Fadiga:</strong> ' + tier.fatigue +
  '</div>');

  ChatMessage.create({
    content: '<div style="' + STYLE.card + '">' +
      '<h3 style="margin:0 0 8px 0;text-align:center;"><i class="fas fa-campground"></i> Descanso Longo</h3>' +
      reportLines.join('') +
    '</div>',
    speaker: { alias: "Acampamento" },
  });

  campState = null;
}

// ============================================================
// BREATHER: AUTO-CONSUME LINKED ITEM
// ============================================================

Hooks.on("createChatMessage", async (message, options, userId) => {
  if (!game.settings.get(MODULE_ID, "consumeOnBreather")) return;
  if (game.userId !== userId) return;

  const breatherStr = game.i18n?.localize("age-system.breather") || "Breather";
  const flavor = message.flavor || "";
  const content = message.content || "";

  if (!flavor.includes(breatherStr) && !content.includes(breatherStr)) return;
  if (message.flags?.["age-system"]?.ageroll) return;
  if (!message.isRoll && (!message.rolls || message.rolls.length === 0)) return;

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
      content: '<div style="' + STYLE.breather + '">' +
        '<strong><i class="fas fa-mug-hot"></i> Breather - ' + actor.name + '</strong>' +
        '<hr style="border-color:var(--color-border-dark-tertiary);margin:6px 0;">' +
        '<p style="margin:0;">' + result + '</p>' +
      '</div>',
      speaker: { alias: actor.name },
    });
  }
});

// ============================================================
// CHAT COMMANDS
// ============================================================

Hooks.on("chatMessage", (chatLog, messageText, chatData) => {
  const cmd = messageText.trim().toLowerCase();

  if (cmd === "/acampar" || cmd === "/camp") {
    openCampPanel();
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

  function itemLine(icon, itemId, fallback) {
    const item = itemId ? actor.items.get(itemId) : null;
    if (item) {
      const qty = item.system?.quantity ?? 0;
      const color = qty <= 0 ? "#a93535" : qty <= 3 ? "#b8860b" : "#4e8a4e";
      return '<i class="fas ' + icon + '" style="width:14px;"></i> <strong>' + item.name + '</strong>: <span style="color:' + color + ';font-weight:bold;">' + qty + '</span>';
    }
    return '<i class="fas ' + icon + '" style="width:14px;color:#666;"></i> <span style="color:#666;">' + fallback + '</span>';
  }

  ChatMessage.create({
    content: '<div style="' + STYLE.card + '">' +
      '<strong><i class="fas fa-utensils"></i> Provisoes - ' + actor.name + '</strong>' +
      '<hr style="border-color:var(--color-border-dark-tertiary);margin:6px 0;">' +
      '<p style="margin:4px 0;">' + itemLine("fa-bread-slice", actor.getFlag(MODULE_ID, FLAG_FOOD_ID), "Sem racoes vinculadas") + '</p>' +
      '<p style="margin:4px 0;">' + itemLine("fa-mug-hot", actor.getFlag(MODULE_ID, FLAG_BREATHER_ID), "Sem suprimento de breather") + '</p>' +
    '</div>',
    speaker: { alias: actor.name },
  });
}

// ============================================================
// UTILITY: CONSUME ITEM
// ============================================================

async function consumeItem(actor, itemId) {
  const item = actor.items.get(itemId);
  if (!item) return '<span style="color:#a93535;">Item vinculado nao encontrado!</span>';
  const qty = item.system?.quantity;
  if (qty === undefined || qty === null) return null;
  if (qty <= 0) return '<strong style="color:#a93535;">' + actor.name + ' nao tem mais ' + item.name + '!</strong>';
  const newQty = qty - 1;
  await item.update({ "system.quantity": newQty });
  const color = newQty <= 0 ? "#a93535" : newQty <= 3 ? "#b8860b" : "#4e8a4e";
  return 'Consumiu 1x <strong>' + item.name + '</strong>. Restam: <span style="color:' + color + ';font-weight:bold;">' + newQty + '</span>';
}
