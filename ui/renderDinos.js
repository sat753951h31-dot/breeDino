import { calculateStats } from "../systems/stats.js";
import { requiredExp } from "../systems/level.js";
import { DEX_SPECIES } from "../data/dexSpecies.js";
import { getColorLabel, getSizeLabel, getRarityLabel, getEggRarityLabel, getSexLabel } from "./labels.js";
import { SPECIAL_BREEDS } from "../data/specialBreeding.js";
import { getChildMaxLevelInfo, getRequiredCrystals } from "../systems/breeding.js";
import { getTraitData } from "../data/traits.js";
import { renderDinoAvatar } from "./dinoVisual.js";
import { getDinoType, getFoodLabelsForType } from "../data/types.js";
import { getSpeciesName, getBloodlineBonus, renderGenBadge, renderRarityBadge, renderMutantBadge } from "./renderHelpers.js";

const RARITY_RANK = { white: 1, blue: 2, purple: 3, rainbow: 4 };

export function renderDinoList(game, state, handlers) {
  const el = document.getElementById("dinoList");
  if (!el) return;
  el.innerHTML = "";

  const speciesSelect = document.getElementById("filterSpecies");
  const keyword = (state.filterName ?? "").trim().toLowerCase();

  if (speciesSelect) {
    const countMap = new Map();
    game.dinos.forEach(d => {
      countMap.set(d.speciesId, (countMap.get(d.speciesId) ?? 0) + 1);
    });

    if (state.filterSpecies !== "all" && !countMap.has(state.filterSpecies)) {
      state.filterSpecies = "all";
    }

    const optionsHtml = [`<option value="all">すべての種族 (${game.dinos.length})</option>`];
    DEX_SPECIES.forEach(sp => {
      const count = countMap.get(sp.id);
      if (count > 0) {
        const selected = state.filterSpecies === sp.id ? "selected" : "";
        optionsHtml.push(`<option value="${sp.id}" ${selected}>${sp.name} (${count})</option>`);
      }
    });
    speciesSelect.innerHTML = optionsHtml.join("");
  }

  let list = game.dinos.filter(dino => {
    if (keyword !== "") {
      const currentName = (dino.name ?? "").toLowerCase();
      const baseSpeciesName = getSpeciesName(dino.speciesId).toLowerCase();
      if (!currentName.includes(keyword) && !baseSpeciesName.includes(keyword)) return false;
    }
    if (state.filterSpecies !== "all" && dino.speciesId !== state.filterSpecies) return false;
    if (state.filterSex !== "all" && dino.sex !== state.filterSex) return false;
    if (state.filterType && state.filterType !== "all") {
      if (getDinoType(dino.speciesId, dino.name).id !== state.filterType) return false;
    }
    if (state.filterRarity && state.filterRarity !== "all") {
      if ((dino.rarityType ?? "white") !== state.filterRarity) return false;
    }
    if (state.filterGen && state.filterGen !== "all") {
      const gen = dino.generation ?? 0;
      if (state.filterGen === "0" && gen !== 0) return false;
      if (state.filterGen === "1_plus" && gen < 1) return false;
      if (state.filterGen === "2_plus" && gen < 2) return false;
      if (state.filterGen === "5_plus" && gen < 5) return false;
    }
    if (state.filterLock && state.filterLock !== "all") {
      if (state.filterLock === "locked" && !dino.locked) return false;
      if (state.filterLock === "unlocked" && dino.locked) return false;
    }
    return true;
  });

  if (state.sortBy === "newest") {
    list = [...list].reverse();
  } else if (state.sortBy === "level") {
    list.sort((a, b) => b.level - a.level);
  } else if (state.sortBy === "maxLevel") {
    list.sort((a, b) => {
      const maxA = a.maxLevel ?? (20 + (a.generation ?? 0) * 5);
      const maxB = b.maxLevel ?? (20 + (b.generation ?? 0) * 5);
      return maxB - maxA;
    });
  } else if (state.sortBy === "rarity") {
    list.sort((a, b) => (RARITY_RANK[b.rarityType] ?? 1) - (RARITY_RANK[a.rarityType] ?? 1));
  } else if (state.sortBy === "generation") {
    list.sort((a, b) => (b.generation ?? 0) - (a.generation ?? 0));
  } else if (state.sortBy === "iv") {
    list.sort((a, b) => (b.atkIv + b.hpIv + b.spdIv) - (a.atkIv + a.hpIv + a.spdIv));
  }

  const busyIds = new Set();
  (game.expeditions ?? []).forEach(exp => {
    exp.memberIds.forEach(id => busyIds.add(id));
  });

  const rainbowBar = document.getElementById("rainbowConvertBar");
  if (rainbowBar) {
    const isMode = Boolean(state.isRainbowSelectMode);
    const pickedSet = state.selectedRainbowIds ?? new Set();
    const calcReturn = state.getRainbowCrystalReturn ?? ((d) => 5 + Math.min(10, d.generation ?? 0));

    const visibleTargetIds = list.filter(d => {
      if ((d.rarityType ?? "white") !== "rainbow") return false;
      if (d.uid === game.activeDinoId) return false;
      if (busyIds.has(d.uid)) return false;
      if (d.uid === state.selectedMale || d.uid === state.selectedFemale) return false;
      if (d.locked || d.mutant) return false;
      if (d.color && d.color !== "normal") return false;
      return true;
    }).map(d => d.uid);

    const unpickedVisibleCount = visibleTargetIds.filter(id => !pickedSet.has(id)).length;
    const pickedDinos = game.dinos.filter(d => pickedSet.has(d.uid));
    const totalGain = pickedDinos.reduce((sum, d) => sum + calcReturn(d), 0);

    if (!isMode) {
      rainbowBar.innerHTML = `
        <div class="rainbow-bar-row">
          <span>🌈 <strong>余った虹レアの結晶還元：</strong>個別に選んで「💎 生命の結晶」に変換できます</span>
          <button id="toggleRainbowModeBtn" class="btn-rainbow-mode">💎 虹レアを選んで還元する</button>
        </div>
      `;
    } else {
      rainbowBar.innerHTML = `
        <div class="rainbow-bar-row is-active">
          <div>
            <strong>💎 還元モード選択中：${pickedDinos.length}体 選択（獲得予定：💎 ${totalGain}個）</strong><br>
            <small>※現在表示中の対象のみ一括選択できます（保護対象は自動除外）</small>
          </div>
          <div class="rainbow-bar-actions">
            <button id="selectAllVisibleRainbowBtn" class="btn-rainbow-bulk" ${unpickedVisibleCount === 0 ? "disabled" : ""}>
              ☑️ 表示中を一括選択 (+${unpickedVisibleCount}体)
            </button>
            <button id="clearRainbowPicksBtn" class="btn-rainbow-cancel" ${pickedDinos.length === 0 ? "disabled" : ""}>
              選択解除
            </button>
            <button id="execRainbowConvertBtn" class="btn-rainbow-exec" ${pickedDinos.length === 0 ? "disabled" : ""}>
              ✨ 結晶 ${totalGain}個 に還元
            </button>
            <button id="cancelRainbowModeBtn" class="btn-rainbow-cancel">✕ 終了</button>
          </div>
        </div>
      `;
    }

    const startBtn = document.getElementById("toggleRainbowModeBtn");
    if (startBtn) startBtn.onclick = handlers.onToggleRainbowMode;

    const selectAllBtn = document.getElementById("selectAllVisibleRainbowBtn");
    if (selectAllBtn) selectAllBtn.onclick = () => handlers.onSelectAllFilteredRainbows(visibleTargetIds);

    const clearBtn = document.getElementById("clearRainbowPicksBtn");
    if (clearBtn) clearBtn.onclick = handlers.onClearRainbowPicks;

    const execBtn = document.getElementById("execRainbowConvertBtn");
    if (execBtn) execBtn.onclick = handlers.onExecuteRainbowConvert;

    const cancelBtn = document.getElementById("cancelRainbowModeBtn");
    if (cancelBtn) cancelBtn.onclick = handlers.onToggleRainbowMode;
  }

  if (list.length === 0) {
    el.innerHTML = "<p>条件に一致する恐竜がいません。</p>";
    return;
  }

  list.forEach(dino => {
    const stats = calculateStats(dino);
    const isActive = game.activeDinoId === dino.uid;
    const isOnExpedition = busyIds.has(dino.uid);
    const isSelected = state.selectedMale === dino.uid || state.selectedFemale === dino.uid;
    const isCritical = dino.currentHp <= stats.hp * 0.2;

    const hpPercent = Math.max(0, Math.min(100, (dino.currentHp / stats.hp) * 100));
    const maxLv = dino.maxLevel ?? 20;
    const isMaxLv = dino.level >= maxLv;
    const nextExp = requiredExp(dino.level);
    const expPercent = isMaxLv ? 100 : Math.max(0, Math.min(100, (dino.exp / nextExp) * 100));
    const totalIv = dino.atkIv + dino.hpIv + dino.spdIv;
    const affection = Math.min(100, dino.affection ?? 0);
    const evEarned = Math.min(100, dino.evEarned ?? 0);
    const ev = dino.ev ?? { atk: 0, hp: 0, spd: 0 };
    const evUsed = (ev.atk ?? 0) + (ev.hp ?? 0) + (ev.spd ?? 0);
    const bloodlineBonus = getBloodlineBonus(dino);
    const trait = getTraitData(dino.trait);
    const dinoType = getDinoType(dino.speciesId, dino.name);
    const fLabels = getFoodLabelsForType(dinoType.id);
    const fruitCount = game.items?.traitFruit ?? 0;
    const elixirCount = game.items?.ivElixir ?? 0;
    const sizePotionCount = game.items?.sizePotion ?? 0;

    const card = document.createElement("div");
    card.className = "dino-card";

    if (isActive) card.classList.add("is-active");
    if (isOnExpedition) card.classList.add("is-expedition");
    if (isSelected) card.classList.add("is-selected");
    if (dino.locked) card.classList.add("is-locked");
    if (dino.color && dino.color !== "normal") card.classList.add(`color-${dino.color}`);
    if (dino.mutant) card.classList.add("is-mutant");

    const isRainbowTarget =
      (dino.rarityType ?? "white") === "rainbow" &&
      !isActive &&
      !isOnExpedition &&
      !isSelected &&
      !dino.locked &&
      !dino.mutant &&
      (!dino.color || dino.color === "normal");

    const isRainbowPicked = Boolean(state.isRainbowSelectMode && state.selectedRainbowIds?.has(dino.uid));
    if (isRainbowPicked) card.classList.add("is-rainbow-picked");
    const crystalGain = (state.getRainbowCrystalReturn ?? ((d) => 5 + Math.min(10, d.generation ?? 0)))(dino);

    card.innerHTML = `
      <div class="card-top-row">
        <div class="card-badges">
          ${renderGenBadge(dino)}
          <span class="badge-type type-${dinoType.id}" title="${dinoType.desc}">${dinoType.icon} ${dinoType.name}</span>
          ${bloodlineBonus > 0 ? `<span class="badge-bloodline">📈上限+${bloodlineBonus}</span>` : ""}
          ${renderRarityBadge(dino)}
          <span class="badge-trait" title="${trait.desc}" data-trait-name="${trait.icon} ${trait.name}" data-trait-desc="${trait.desc}">${trait.icon} ${trait.name}</span>
          ${renderMutantBadge(dino)}
        </div>
        <div class="card-lv">Lv.<strong>${dino.level}</strong><small>/${maxLv}</small></div>
      </div>

      <div class="card-title-row">
        <div class="card-name-line">
          <h3 title="${dino.name}">${dino.name}</h3>
          <div class="card-mini-actions">
            <button class="btn-pedigree" data-id="${dino.uid}" title="血統書を見る">📜</button>
            <button class="btn-lock ${dino.locked ? "is-locked" : ""}" data-id="${dino.uid}" title="${dino.locked ? "ロック解除" : "保護ロック"}">
              ${dino.locked ? "🔒" : "🔓"}
            </button>
            <button class="btn-rename" data-id="${dino.uid}" title="名前を変更">✏️</button>
          </div>
        </div>
        <div class="card-sub-meta">
          <span>${getSexLabel(dino.sex)}</span>
          <span>📏 ${getSizeLabel(dino.size)}</span>
          <span>🎨 ${getColorLabel(dino.color)}</span>
        </div>
      </div>

      ${renderDinoAvatar(dino.speciesId, {
        color: dino.color,
        size: dino.size,
        mutant: dino.mutant,
        compact: true
      })}

      <div class="card-gauges">
        <div class="gauge-label">
          <span>HP</span>
          <span><span class="dino-hp" data-uid="${dino.uid}">${Math.floor(dino.currentHp)}</span> / ${Math.floor(stats.hp)}</span>
        </div>
        <div class="bar-bg mini-bar">
          <div class="bar-fill ${isCritical ? "hp-danger" : "hp-fill"}" style="width: ${hpPercent}%"></div>
        </div>

        <div class="gauge-label">
          <span>EXP</span>
          <span>${isMaxLv ? "<strong>MAX</strong>" : `${dino.exp} / ${nextExp}`}</span>
        </div>
        <div class="bar-bg mini-bar">
          <div class="bar-fill exp-fill" style="width: ${expPercent}%"></div>
        </div>
      </div>

      <div class="card-stat-grid">
        <div class="stat-box">
          <div class="stat-label">⚔️ 攻撃</div>
          <div class="stat-val">${Math.floor(stats.atk)}</div>
          <div class="stat-iv ${dino.atkIv >= 100 ? "iv-high" : ""}">
            IV: ${dino.atkIv}${ev.atk > 0 ? `<span class="ev-plus-tag">+${ev.atk}</span>` : ""}
          </div>
        </div>
        <div class="stat-box">
          <div class="stat-label">❤️ HP</div>
          <div class="stat-val">${Math.floor(stats.hp)}</div>
          <div class="stat-iv ${dino.hpIv >= 100 ? "iv-high" : ""}">
            IV: ${dino.hpIv}${ev.hp > 0 ? `<span class="ev-plus-tag">+${ev.hp}</span>` : ""}
          </div>
        </div>
        <div class="stat-box">
          <div class="stat-label">💨 素早さ</div>
          <div class="stat-val">${Math.floor(stats.spd)}</div>
          <div class="stat-iv ${dino.spdIv >= 100 ? "iv-high" : ""}">
            IV: ${dino.spdIv}${ev.spd > 0 ? `<span class="ev-plus-tag">+${ev.spd}</span>` : ""}
          </div>
        </div>
      </div>

      <div class="card-sub-stats-row">
        <span>💖 親密度: <strong>${affection}</strong>/100</span>
        <span>📊 努力値: <strong>${evUsed}</strong>/${evEarned}</span>
      </div>

      <div class="card-iv-total">個体値合計: <strong>${totalIv}</strong></div>

      <div class="card-feed-row">
        <button class="feed-btn" data-type="raw" data-id="${dino.uid}" ${game.foods.raw <= 0 ? "disabled" : ""} title="${fLabels.raw.name} (HP20%回復 / EXP+10)">
          ${fLabels.raw.icon} ${fLabels.raw.shortName}
        </button>
        <button class="feed-btn" data-type="good" data-id="${dino.uid}" ${game.foods.good <= 0 ? "disabled" : ""} title="${fLabels.good.name} (HP50%回復 / EXP+30)">
          ${fLabels.good.icon} ${fLabels.good.shortName}
        </button>
        <button class="feed-btn" data-type="premium" data-id="${dino.uid}" ${game.foods.premium <= 0 ? "disabled" : ""} title="${fLabels.premium.name} (HP全快 / EXP+100)">
          ${fLabels.premium.icon} ${fLabels.premium.shortName}
        </button>
      </div>

      <div class="card-special-feed-row">
        <button class="btn-card-special use-fruit-card-btn" data-id="${dino.uid}" ${fruitCount <= 0 ? "disabled" : ""} title="特性変更の果実（特性を再抽選）">
          🎲 果実 (${fruitCount})
        </button>
        <button class="btn-card-special use-elixir-card-btn" data-id="${dino.uid}" ${elixirCount <= 0 ? "disabled" : ""} title="個体値強化の秘薬（全IV +10）">
          💉 秘薬 (${elixirCount})
        </button>
        <button class="btn-card-special use-size-card-btn" data-id="${dino.uid}" ${sizePotionCount <= 0 ? "disabled" : ""} title="体格変化の薬（体格をランダム変化）">
          📏 体格 (${sizePotionCount})
        </button>
      </div>

      <div class="card-action-row">
        <button class="set-active-btn" data-id="${dino.uid}" ${isActive || isOnExpedition ? "disabled" : ""}>
          ${isActive ? "⭐ 育成中" : isOnExpedition ? "🏕️ 遠征中" : "メインに設定"}
        </button>
        <button class="breed-select-btn ${isSelected ? "is-picked" : ""}" data-id="${dino.uid}" ${isOnExpedition ? "disabled" : ""}>
          ${isOnExpedition ? "選択不可" : isSelected ? "✅ 選択中" : "交配に選ぶ"}
        </button>
      </div>

      ${state.isRainbowSelectMode
        ? (isRainbowTarget
            ? `<button class="btn-rainbow-pick ${isRainbowPicked ? "is-picked" : ""}" data-id="${dino.uid}">
                 ${isRainbowPicked ? `✅ 還元対象に選択中（💎+${crystalGain}）` : `💎 還元に選ぶ（💎+${crystalGain}）`}
               </button>`
            : `<div class="locked-label">${(dino.rarityType ?? "white") === "rainbow" ? "🛡️ 保護対象のため選択不可" : "⚪〜🟣 虹レア以外は対象外"}</div>`
          )
        : (isActive
            ? `<div class="active-protect-label">⭐ 現在の育成パートナー</div>`
            : isOnExpedition
              ? `<div class="expedition-protect-label">🏕️ 遠征隊として派遣中${dino.locked ? " (🔒)" : ""}</div>`
              : dino.locked
                ? `<div class="locked-label">🔒 保護ロック中</div>`
                : `<button class="release-btn" data-id="${dino.uid}">👋 お別れする</button>`
          )
      }
    `;
    el.appendChild(card);
  });

  el.querySelectorAll(".set-active-btn").forEach(btn => {
    btn.onclick = () => handlers.onSetActive(btn.dataset.id);
  });
  el.querySelectorAll(".breed-select-btn").forEach(btn => {
    btn.onclick = () => handlers.onSelectBreed(btn.dataset.id);
  });
  el.querySelectorAll(".release-btn").forEach(btn => {
    btn.onclick = () => handlers.onRelease(btn.dataset.id);
  });
  el.querySelectorAll(".btn-rename").forEach(btn => {
    btn.onclick = () => handlers.onRename(btn.dataset.id);
  });
  el.querySelectorAll(".btn-lock").forEach(btn => {
    btn.onclick = () => handlers.onToggleLock(btn.dataset.id);
  });
  el.querySelectorAll(".btn-pedigree").forEach(btn => {
    btn.onclick = () => handlers.onShowPedigree(btn.dataset.id);
  });
  el.querySelectorAll(".use-fruit-card-btn").forEach(btn => {
    btn.onclick = () => handlers.onUseTraitFruit(btn.dataset.id);
  });
  el.querySelectorAll(".use-elixir-card-btn").forEach(btn => {
    btn.onclick = () => handlers.onUseIvElixir(btn.dataset.id);
  });
  el.querySelectorAll(".btn-rainbow-pick").forEach(btn => {
    btn.onclick = () => handlers.onToggleRainbowPick(btn.dataset.id);
  });
  el.querySelectorAll(".use-size-card-btn").forEach(btn => {
    btn.onclick = () => handlers.onUseSizePotion(btn.dataset.id);
  });
}

export function renderBreedingEggs(game, handlers) {
  const el = document.getElementById("eggList");
  const hatchAllBtn = document.getElementById("hatchAllBreedingBtn");
  if (!el) return;

  const now = Date.now();
  const readyCount = game.breedingEggs.filter(egg => (egg.hatchAt ?? 0) <= now).length;

  if (hatchAllBtn) {
    hatchAllBtn.disabled = readyCount === 0;
    hatchAllBtn.textContent = readyCount > 0
      ? `🐣 孵化可能な交配卵をすべて孵化 (${readyCount}個)`
      : "🐣 すべて孵化させる";
    hatchAllBtn.onclick = handlers.onHatchAllBreedingEggs;
  }

  el.innerHTML = "";

  if (game.breedingEggs.length === 0) {
    el.innerHTML = "<p class='empty-msg'>現在、孵化待ちの交配卵はありません。</p>";
    return;
  }

  game.breedingEggs.forEach(egg => {
    const remain = Math.max(0, Math.ceil(((egg.hatchAt ?? 0) - now) / 1000));
    const rarity = egg.rarityType ?? egg.rarity ?? egg.child?.rarityType ?? "white";
    const size = egg.child?.size;
    const isReady = remain <= 0;

    const div = document.createElement("div");
    div.className = `egg-card rarity-${rarity} ${isReady ? "is-ready" : ""}`;

    div.innerHTML = `
      <div class="egg-card-top">
        <span class="egg-type-tag">💕 交配卵</span>
        <span>${getEggRarityLabel(rarity)}</span>
      </div>
      <div class="egg-visual-small">${isReady ? "🐣" : "🥚"}</div>
      ${size ? `<div class="egg-meta">体格: <strong>${getSizeLabel(size)}</strong></div>` : ""}
      <div class="egg-timer ${isReady ? "ready-text" : ""}">
        ${isReady
          ? "✨ 孵化の準備完了！"
          : `⏳ 残り <strong class="egg-remain" data-id="${egg.id}">${remain}</strong> 秒`
        }
      </div>
      ${isReady
        ? `<button class="hatch-child-btn btn-hatch-ready" data-id="${egg.id}">🐣 孵化させる</button>`
        : `<button class="btn-hatch-wait" disabled>温め中…</button>`
      }
    `;
    el.appendChild(div);
  });

  el.querySelectorAll(".hatch-child-btn").forEach(btn => {
    btn.onclick = () => handlers.onHatchBreedingEgg(btn.dataset.id);
  });
}

export function renderWildEggs(game, handlers) {
  const el = document.getElementById("wildEggList");
  const hatchAllBtn = document.getElementById("hatchAllWildBtn");
  if (!el) return;

  const now = Date.now();
  const readyCount = game.wildEggs.filter(egg => (egg.hatchAt ?? 0) <= now).length;

  if (hatchAllBtn) {
    hatchAllBtn.disabled = readyCount === 0;
    hatchAllBtn.textContent = readyCount > 0
      ? `🐣 孵化可能な卵をすべて孵化 (${readyCount}個)`
      : "🐣 すべて孵化させる";
    hatchAllBtn.onclick = handlers.onHatchAllWildEggs;
  }

  el.innerHTML = "";

  if (game.wildEggs.length === 0) {
    el.innerHTML = "<p class='empty-msg'>野生の卵はありません。</p>";
    return;
  }

  game.wildEggs.forEach(egg => {
    const remain = Math.max(0, Math.ceil(((egg.hatchAt ?? 0) - now) / 1000));
    const rarity = egg.rarity ?? "white";
    const isReady = remain <= 0;

    const div = document.createElement("div");
    div.className = `egg-card rarity-${rarity} ${isReady ? "is-ready" : ""}`;

    div.innerHTML = `
      <div class="egg-card-top">
        <span class="egg-type-tag wild">🌿 野生卵</span>
        <span>${getEggRarityLabel(rarity)}</span>
      </div>
      <div class="egg-visual-small">${isReady ? "🐣" : "🥚"}</div>
      <div class="egg-meta">体格: <strong>${getSizeLabel(egg.size)}</strong></div>
      <div class="egg-timer ${isReady ? "ready-text" : ""}">
        ${isReady
          ? "✨ 孵化の準備完了！"
          : `⏳ 残り <strong class="wild-egg-remain" data-id="${egg.id}">${remain}</strong> 秒`
        }
      </div>
      ${isReady
        ? `<button class="wild-hatch-btn btn-hatch-ready" data-id="${egg.id}">🐣 孵化させる</button>`
        : `<button class="btn-hatch-wait" disabled>温め中…</button>`
      }
    `;
    el.appendChild(div);
  });

  el.querySelectorAll(".wild-hatch-btn").forEach(button => {
    button.onclick = () => handlers.onHatchWildEgg(button.dataset.id);
  });
}

function createParentSlotHtml(dino, roleLabel, roleClass) {
  if (!dino) {
    return `
      <div class="parent-slot is-empty ${roleClass}">
        <div class="slot-role">${roleLabel}</div>
        <div class="slot-empty-text">未選択<br><small>「恐竜一覧」から選んでください</small></div>
      </div>
    `;
  }

  const bloodlineBonus = getBloodlineBonus(dino);
  const trait = getTraitData(dino.trait);

  return `
    <div class="parent-slot ${roleClass}">
      <div class="slot-role">${roleLabel}</div>
      <h4>${dino.name} <small>Lv.${dino.level}</small></h4>
      ${renderDinoAvatar(dino.speciesId, {
        color: dino.color,
        size: dino.size,
        mutant: dino.mutant,
        compact: true
      })}
      <div class="slot-badges">
        ${renderGenBadge(dino)}
        ${bloodlineBonus > 0 ? `<span class="badge-bloodline">📈上限+${bloodlineBonus}</span>` : ""}
        ${renderRarityBadge(dino)}
        <span class="badge-trait" title="${trait.desc}" data-trait-name="${trait.icon} ${trait.name}" data-trait-desc="${trait.desc}">${trait.icon} ${trait.name}</span>
        <span>${getColorLabel(dino.color)}</span>
        ${renderMutantBadge(dino)}
      </div>
      <div class="slot-ivs">
        ATK IV: <strong>${dino.atkIv}</strong> /
        HP IV: <strong>${dino.hpIv}</strong> /
        SPD IV: <strong>${dino.spdIv}</strong>
      </div>
    </div>
  `;
}

export function renderBreedingStage(game, selectedMale, selectedFemale) {
  const parentInfo = document.getElementById("parentInfo");
  const breedBtn = document.getElementById("breedBtn");
  const breed10Btn = document.getElementById("breed10Btn");
  if (!parentInfo) return;

  const male = game.dinos.find(d => d.uid === selectedMale);
  const female = game.dinos.find(d => d.uid === selectedFemale);
  const crystals = game.items?.breedCrystal ?? 0;
  const requiredCrystals = (male && female) ? getRequiredCrystals(male, female) : 1;

  if (breedBtn) {
    const canBreed = male && female && crystals >= requiredCrystals;
    breedBtn.disabled = !canBreed;
    breedBtn.textContent = !(male && female)
      ? "🥚 オスとメスを選択してください"
      : crystals >= requiredCrystals
        ? `🥚 1回交配 (💎${requiredCrystals})`
        : `💎 結晶不足 (必要: ${requiredCrystals}個)`;
  }

  if (breed10Btn) {
    const req10 = requiredCrystals * 10;
    const canBreed10 = male && female && crystals >= req10;
    breed10Btn.disabled = !canBreed10;
    breed10Btn.textContent = !(male && female)
      ? "🥚 10回交配"
      : `🥚 10回交配 (💎${req10})`;
  }

  let previewHtml = "";
  if (male && female) {
    const lvInfo = getChildMaxLevelInfo(male, female);

    const ids = [male.speciesId, female.speciesId].sort();
    const special = SPECIAL_BREEDS.find(b => {
      const pIds = [...b.parents].sort();
      return pIds === ids && pIds === ids;
    });

    const isCapped = (lvInfo.inheritedBonus + lvInfo.trainBonus) > lvInfo.maxAllowedBonus;
    const maleSpeciesName = getSpeciesName(male.speciesId);
    const femaleSpeciesName = getSpeciesName(female.speciesId);
    const normalResultText = male.speciesId === female.speciesId
      ? `<strong>${maleSpeciesName}（F${lvInfo.nextGen}）</strong>`
      : `<strong>${maleSpeciesName}</strong> または <strong>${femaleSpeciesName}</strong>（各50% / F${lvInfo.nextGen}）`;

    previewHtml = `
      <div class="breed-preview">
        ${special
          ? `✨ <strong>特殊交配レシピ成立！</strong>「${special.result.name}（F${lvInfo.nextGen}）」`
          : `🥚 誕生予定：${normalResultText}`
        }
        <br>
        📈 レベル上限：<strong>Lv.${lvInfo.totalMaxLevel}</strong>
        （F${lvInfo.nextGen}基本 <strong>${lvInfo.genBaseMax}</strong>
        ＋ ボーナス <strong>+${lvInfo.totalBonus}</strong>${isCapped ? ` <small>※F${lvInfo.nextGen}上限</small>` : ""}）
      </div>
    `;
  }

  parentInfo.innerHTML = `
    <div class="crystal-status ${crystals < requiredCrystals ? "is-empty" : ""}">
      💎 生命の結晶：所持 <strong>${crystals}</strong> 個（1回の交配に <strong>${requiredCrystals}</strong> 個消費）
    </div>
    <div class="breeding-slots">
      ${createParentSlotHtml(male, "♂️ オス親", "slot-male")}
      <div class="breed-plus">＋</div>
      ${createParentSlotHtml(female, "♀️ メス親", "slot-female")}
    </div>
    ${previewHtml}
  `;
}

export function updateBreedBadge(game) {
  const badge = document.getElementById("breedTabBadge");
  if (!badge) return;

  const now = Date.now();
  const readyBreeding = game.breedingEggs.filter(egg => egg.hatchAt <= now).length;
  const readyWild = game.wildEggs.filter(egg => (egg.hatchAt ?? 0) <= now).length;
  const totalReady = readyBreeding + readyWild;

  if (totalReady > 0) {
    badge.textContent = totalReady;
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
  }
}
