import { calculateStats } from "../systems/stats.js";
import { requiredExp } from "../systems/level.js";
import { getColorLabel, getSizeLabel, getRarityLabel, getSexLabel } from "./labels.js";
import { AREAS } from "../data/areas.js";
import { getTraitData } from "../data/traits.js";
import { AREA_BOSSES } from "../data/bosses.js";
import { renderDinoAvatar } from "./dinoVisual.js";
import { updateIdleStage } from "./battleStage.js";
import { getDinoType, getTypePassive, getFoodLabelsForType } from "../data/types.js";
import { getBloodlineBonus, renderGenBadge, renderRarityBadge, renderMutantBadge } from "./renderHelpers.js";

function getLogClass(text) {
  if (text.startsWith("===")) return "log-divider";
  if (text.includes("🔴")) return "log-enemy-low";
  if (text.includes("🟠")) return "log-enemy-half";
  if (text.includes("☠️") || text.includes("🪦") || text.includes("❌") || text.includes("❗") || text.includes("⚠️")) {
    return "log-danger";
  }
  if (text.includes("🏆") || text.includes("🎉") || text.includes("✨") || text.includes("💎") || text.includes("🥚")) {
    return "log-rare";
  }
  if (text.includes("✅") || text.includes("🎊") || text.includes("🗺️")) {
    return "log-success";
  }
  if (text.includes("💨")) {
    return "log-dodge";
  }
  return "log-normal";
}

export function renderStarterEgg(game, handlers) {
  const el = document.getElementById("starterEggArea");
  if (!el) return;

  if (game.starterSelected) {
    el.innerHTML = "";
    return;
  }

  const rarity = game.starterEgg.rarity ?? "white";

  el.innerHTML = `
    <div class="starter-stage">
      <div class="starter-header">✨ 最初のパートナーとなる卵を選ぼう！ ✨</div>
      <div class="starter-egg-card rarity-${rarity}">
        <div class="egg-visual">🥚</div>
        <div class="egg-badges">
          <span class="egg-badge">${getRarityLabel(rarity)}</span>
          <span class="egg-badge">📏 ${getSizeLabel(game.starterEgg.size)}</span>
        </div>
        <p class="starter-tip">※「選び直す」でレア度やサイズを厳選できます</p>
      </div>
      <div class="starter-actions">
        <button id="rerollEgg" class="btn-reroll">🔄 選び直す</button>
        <button id="selectEgg" class="btn-start-egg">🐣 この卵で始める！</button>
      </div>
    </div>
  `;

  document.getElementById("rerollEgg").onclick = handlers.onRerollStarter;
  document.getElementById("selectEgg").onclick = handlers.onSelectStarter;
}

export function renderStatusAndLogs(game) {
  const foodStorage = document.getElementById("foodStorage");
  if (foodStorage) {
    const activeId = game.activeDinoId;
    const activeDino = game.dinos.find(d => d.uid === activeId);
    const activeTypeId = activeDino ? getDinoType(activeDino.speciesId, activeDino.name).id : "carnivore";
    const fLabels = getFoodLabelsForType(activeTypeId);

    const foodItems = [
      { type: "raw", icon: fLabels.raw.icon, name: fLabels.raw.name, count: game.foods.raw, desc: "HP20%回復 / EXP+10" },
      { type: "good", icon: fLabels.good.icon, name: fLabels.good.name, count: game.foods.good, desc: "HP50%回復 / EXP+30" },
      { type: "premium", icon: fLabels.premium.icon, name: fLabels.premium.name, count: game.foods.premium, desc: "HP全快 / EXP+100" }
    ];

    const fruitCount = game.items?.traitFruit ?? 0;
    const elixirCount = game.items?.ivElixir ?? 0;
    const sizePotionCount = game.items?.sizePotion ?? 0;

    foodStorage.innerHTML = `
      <div class="food-grid">
        ${foodItems.map(item => `
          <div class="food-card ${item.count <= 0 ? "is-empty" : ""}">
            <div class="food-icon">${item.icon}</div>
            <div class="food-name">${item.name}</div>
            <div class="food-count">所持: <strong>${item.count}</strong>個</div>
            <div class="food-desc">${item.desc}</div>
            <button
              class="feed-btn"
              data-type="${item.type}"
              data-id="${activeId ?? ""}"
              ${!activeId || item.count <= 0 ? "disabled" : ""}
            >
              与える
            </button>
          </div>
        `).join("")}
      </div>

      <div class="special-food-grid">
        <div class="food-card is-special-item ${fruitCount <= 0 ? "is-empty" : ""}">
          <div class="food-icon">🎲</div>
          <div class="food-name">特性変更の果実</div>
          <div class="food-count">所持: <strong>${fruitCount}</strong>個</div>
          <div class="food-desc">特性をランダム再抽選</div>
          <button id="useTraitFruitBtn" class="btn-use-special" ${!activeId || fruitCount <= 0 ? "disabled" : ""}>
            使う
          </button>
        </div>

        <div class="food-card is-special-item ${elixirCount <= 0 ? "is-empty" : ""}">
          <div class="food-icon">💉</div>
          <div class="food-name">個体値強化の秘薬</div>
          <div class="food-count">所持: <strong>${elixirCount}</strong>個</div>
          <div class="food-desc">全IV +10 (通常100 / 変異150)</div>
          <button id="useIvElixirBtn" class="btn-use-special" ${!activeId || elixirCount <= 0 ? "disabled" : ""}>
            使う
          </button>
        </div>

        <div class="food-card is-special-item ${sizePotionCount <= 0 ? "is-empty" : ""}">
          <div class="food-icon">📏</div>
          <div class="food-name">体格変化の薬</div>
          <div class="food-count">所持: <strong>${sizePotionCount}</strong>個</div>
          <div class="food-desc">体格をランダム変化</div>
          <button id="useSizePotionBtn" class="btn-use-special" ${!activeId || sizePotionCount <= 0 ? "disabled" : ""}>
            使う
          </button>
        </div>
      </div>
    `;
  }

  const huntLog = document.getElementById("huntLog");
  if (huntLog) {
    huntLog.innerHTML = game.huntLogs.map(log => {
      const cls = getLogClass(log);
      const safeText = log.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<div class="log-line ${cls}">${safeText}</div>`;
    }).join("");
  }
}

export function renderActiveDino(game, handlers) {
  const el = document.getElementById("activeDino");
  if (!el) return;

  const activeDino = game.dinos.find(d => d.uid === game.activeDinoId);
  if (!activeDino) {
    el.dataset.renderedUid = "";
    el.innerHTML = `<p class="empty-msg">育成中の恐竜がいません。「恐竜一覧」からメインに設定してください。</p>`;
    return;
  }

  const stats = calculateStats(activeDino);
  const isCritical = activeDino.currentHp <= stats.hp * 0.2;
  const hpPercent = Math.max(0, Math.min(100, (activeDino.currentHp / stats.hp) * 100));
  const maxLv = activeDino.maxLevel ?? 20;
  const isMaxLv = activeDino.level >= maxLv;
  const nextExp = requiredExp(activeDino.level);
  const expPercent = isMaxLv ? 100 : Math.max(0, Math.min(100, (activeDino.exp / nextExp) * 100));
  const bloodlineBonus = getBloodlineBonus(activeDino);
  const trait = getTraitData(activeDino.trait);
  const dinoType = getDinoType(activeDino.speciesId, activeDino.name);

  const affection = Math.min(100, activeDino.affection ?? 0);
  const affectionBonus = Math.floor(affection * 0.2);
  const evEarned = Math.min(100, activeDino.evEarned ?? 0);
  const ev = activeDino.ev ?? { atk: 0, hp: 0, spd: 0 };
  const evUsed = (ev.atk ?? 0) + (ev.hp ?? 0) + (ev.spd ?? 0);
  const evRemain = Math.max(0, evEarned - evUsed);
  const typePassive = getTypePassive(dinoType.id);

  const evRows = [
    { key: "atk", label: "⚔️ 攻撃IV", val: ev.atk ?? 0 },
    { key: "hp",  label: "❤️ HP IV",  val: ev.hp ?? 0 },
    { key: "spd", label: "💨 素早IV", val: ev.spd ?? 0 }
  ];

  // 差分更新（連打ズーム防止）
  if (el.dataset.renderedUid === activeDino.uid && el.querySelector(".bond-ev-panel")) {
    const lvEl = el.querySelector(".js-active-lv");
    if (lvEl) lvEl.textContent = activeDino.level;

    const hpEl = document.getElementById("activeDinoHp");
    if (hpEl) hpEl.textContent = Math.floor(activeDino.currentHp);

    const maxHpEl = el.querySelector(".js-active-max-hp");
    if (maxHpEl) maxHpEl.textContent = Math.floor(stats.hp);

    const hpBar = el.querySelector(".js-active-hp-bar");
    if (hpBar) {
      hpBar.style.width = `${hpPercent}%`;
      hpBar.className = `bar-fill js-active-hp-bar ${isCritical ? "hp-danger" : "hp-fill"}`;
    }

    const expTextEl = el.querySelector(".js-active-exp-text");
    if (expTextEl) expTextEl.innerHTML = isMaxLv ? "<strong>MAX</strong>" : `${activeDino.exp} / ${nextExp}`;

    const expBar = el.querySelector(".js-active-exp-bar");
    if (expBar) expBar.style.width = `${expPercent}%`;

    const atkEl = el.querySelector(".js-active-atk");
    if (atkEl) atkEl.textContent = Math.floor(stats.atk);

    const spdEl = el.querySelector(".js-active-spd");
    if (spdEl) spdEl.textContent = Math.floor(stats.spd);

    const affBonusEl = el.querySelector(".js-aff-bonus");
    if (affBonusEl) affBonusEl.textContent = `+${affectionBonus}%`;

    const affValEl = el.querySelector(".js-aff-val");
    if (affValEl) affValEl.textContent = affection;

    const affBar = el.querySelector(".js-aff-bar");
    if (affBar) affBar.style.width = `${affection}%`;

    const remainEl = el.querySelector(".js-ev-remain");
    if (remainEl) remainEl.textContent = evRemain;

    const earnedEl = el.querySelector(".js-ev-earned");
    if (earnedEl) earnedEl.textContent = evEarned;

    const resetBtn = document.getElementById("resetEvBtn");
    if (resetBtn) resetBtn.disabled = evUsed === 0;

    evRows.forEach(row => {
      const valEl = el.querySelector(`.js-ev-val[data-stat="${row.key}"]`);
      if (valEl) valEl.textContent = `+${row.val}`;

      el.querySelectorAll(`.btn-ev-step[data-stat="${row.key}"]`).forEach(btn => {
        const delta = Number(btn.dataset.delta);
        btn.disabled = delta > 0 ? evRemain <= 0 : row.val <= 0;
      });
    });

    return;
  }

  el.dataset.renderedUid = activeDino.uid;

  el.innerHTML = `
    <div class="partner-header">
      <div>
        ${renderGenBadge(activeDino)}
        <span class="badge-type type-${dinoType.id}" title="${dinoType.desc}">${dinoType.icon} ${dinoType.name}</span>
        ${bloodlineBonus > 0 ? `<span class="badge-bloodline">📈上限+${bloodlineBonus}</span>` : ""}
        ${renderRarityBadge(activeDino)}
        <span class="badge-trait" title="${trait.desc}" data-trait-name="${trait.icon} ${trait.name}" data-trait-desc="${trait.desc}">${trait.icon} ${trait.name}</span>
        ${renderMutantBadge(activeDino)}
        <h3>${activeDino.name} <small>${getSexLabel(activeDino.sex)}</small></h3>
      </div>
      <div class="partner-level">Lv.<span class="js-active-lv">${activeDino.level}</span><small>/${maxLv}</small></div>
    </div>

    ${renderDinoAvatar(activeDino.speciesId, {
      color: activeDino.color,
      size: activeDino.size,
      mutant: activeDino.mutant
    })}

    <div class="gauge-group">
      <div class="gauge-label">
        <span>HP ${isCritical ? `<strong class="status-critical">⚠️瀕死</strong>` : ""}</span>
        <span><span id="activeDinoHp">${Math.floor(activeDino.currentHp)}</span> / <span class="js-active-max-hp">${Math.floor(stats.hp)}</span></span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill js-active-hp-bar ${isCritical ? "hp-danger" : "hp-fill"}" style="width: ${hpPercent}%"></div>
      </div>

      <div class="gauge-label">
        <span>EXP</span>
        <span class="js-active-exp-text">${isMaxLv ? "<strong>MAX</strong>" : `${activeDino.exp} / ${nextExp}`}</span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill js-active-exp-bar exp-fill" style="width: ${expPercent}%"></div>
      </div>
    </div>

    <div class="stats-mini-grid">
      <div class="stat-item"><span>⚔️ 攻撃</span><strong class="js-active-atk">${Math.floor(stats.atk)}</strong></div>
      <div class="stat-item"><span>💨 素早さ</span><strong class="js-active-spd">${Math.floor(stats.spd)}</strong></div>
      <div class="stat-item"><span>📏 体格</span><strong>${getSizeLabel(activeDino.size)}</strong></div>
      <div class="stat-item"><span>🎨 体色</span><strong>${getColorLabel(activeDino.color)}</strong></div>
    </div>

    <div class="active-trait-desc">
      <strong>${trait.icon} ${trait.name}：</strong>${trait.desc}
    </div>

    <div class="active-type-passive-desc type-${dinoType.id}">
      <strong>${typePassive.label}：</strong>${typePassive.desc}
    </div>

    <div class="bond-ev-panel">
      <div class="gauge-label">
        <span>💖 親密度（与ダメ <strong class="js-aff-bonus">+${affectionBonus}%</strong>）</span>
        <span><strong class="js-aff-val">${affection}</strong> / 100</span>
      </div>
      <div class="bar-bg mini-bar">
        <div class="bar-fill js-aff-bar affection-fill" style="width: ${affection}%"></div>
      </div>

      <div class="ev-header-row">
        <span>📊 努力値（残: <strong class="js-ev-remain">${evRemain}</strong> / 獲得: <strong class="js-ev-earned">${evEarned}</strong>/100）</span>
        <button id="resetEvBtn" type="button" class="btn-ev-reset" ${evUsed === 0 ? "disabled" : ""}>↺ リセット</button>
      </div>

      <div class="ev-rows">
        ${evRows.map(row => `
          <div class="ev-row">
            <span class="ev-stat-name">${row.label}: <strong class="js-ev-val" data-stat="${row.key}">+${row.val}</strong></span>
            <div class="ev-step-btns">
              <button type="button" class="btn-ev-step" data-stat="${row.key}" data-delta="-10" ${row.val <= 0 ? "disabled" : ""}>-10</button>
              <button type="button" class="btn-ev-step" data-stat="${row.key}" data-delta="-1" ${row.val <= 0 ? "disabled" : ""}>-1</button>
              <button type="button" class="btn-ev-step is-plus" data-stat="${row.key}" data-delta="1" ${evRemain <= 0 ? "disabled" : ""}>+1</button>
              <button type="button" class="btn-ev-step is-plus" data-stat="${row.key}" data-delta="10" ${evRemain <= 0 ? "disabled" : ""}>+10</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  const resetEvBtn = document.getElementById("resetEvBtn");
  if (resetEvBtn) resetEvBtn.onclick = handlers.onResetEv;

  el.querySelectorAll(".btn-ev-step").forEach(btn => {
    btn.onclick = () => handlers.onAdjustEv(btn.dataset.stat, Number(btn.dataset.delta));
  });
}

export function renderExploreBox(game, state, handlers) {
  if (document.activeElement?.id === "areaSelect") return;

  const el = document.getElementById("exploreAreaBox");
  if (!el) return;

  const activeDino = game.dinos.find(d => d.uid === game.activeDinoId);
  const stats = activeDino ? calculateStats(activeDino) : null;
  const isCritical = activeDino && stats ? activeDino.currentHp <= stats.hp * 0.2 : false;
  const isAuto = Boolean(state?.isAutoExploring);

  const unlockedAreas = AREAS.filter(a => a.level <= game.unlockedAreaLevel);
  const areaOptions = unlockedAreas.map(area => {
    const progress = game.areaProgress[area.level] ?? 0;
    const badge = progress >= 100 ? "👑制覇済" : `${progress}%`;
    const selected = area.level === game.selectedAreaLevel ? "selected" : "";
    return `<option value="${area.level}" ${selected}>${area.name}（${badge}）</option>`;
  }).join("");

  const currentProgress = game.areaProgress[game.selectedAreaLevel] ?? 0;
  const areaBoss = AREA_BOSSES.find(b => b.areaLevel === game.selectedAreaLevel);
  const isBossUnlocked = currentProgress >= 100 && areaBoss;
  const isBossCleared = game.bossCleared?.[game.selectedAreaLevel] ?? false;

  const currentLoop = game.worldLoop ?? 1;
  const isFinalBossCleared = Boolean(game.bossCleared?.[6]);

  const currentArea = AREAS.find(a => a.level === game.selectedAreaLevel) ?? AREAS[0];
  const enemyDesc = currentArea.enemyDesc ?? "様々な恐竜";
  const recommendDesc = currentArea.recommendDesc ?? "なし";

  el.innerHTML = `
    <div class="explore-box">
      <div class="explore-top-row">
        <label for="areaSelect">🗺️ 探索先エリア</label>
        <span class="world-loop-badge">🌐 現在 ${currentLoop}周目</span>
      </div>
      <select id="areaSelect" ${isAuto ? "disabled" : ""}>${areaOptions}</select>

      <div class="area-matchup-guide">
        <div>👾 出現モンスター：<strong>${enemyDesc}</strong></div>
        <div>💡 おすすめ：<strong>${recommendDesc}</strong></div>
      </div>

      <div class="gauge-label" style="margin-top: 8px;">
        <span>エリア探索率</span>
        <strong>${currentProgress}%</strong>
      </div>
      <div class="bar-bg">
        <div class="bar-fill area-fill" style="width: ${currentProgress}%"></div>
      </div>

      <div class="explore-btn-group">
        <button
          id="exploreBtn"
          class="btn-explore-main ${isCritical ? "is-danger" : ""}"
          ${!activeDino || isAuto ? "disabled" : ""}
        >
          ${!activeDino
            ? "育成中の恐竜がいません"
            : isAuto
              ? "🔄 オート周回中…"
              : isCritical
                ? "⚠️ 瀕死のまま出発"
                : "🧭 探索に出発"}
        </button>

        <button
          id="autoExploreBtn"
          class="btn-auto-explore ${isAuto ? "is-running" : ""}"
          ${!activeDino || (!isAuto && isCritical) ? "disabled" : ""}
          title="${isCritical ? "瀕死状態のため開始できません" : "瀕死になるまで自動で探索を繰り返します"}"
        >
          ${isAuto ? "⏹️ 停止" : "🔄 オート周回"}
        </button>
      </div>

      ${isBossUnlocked ? `
        <button id="bossBtn" class="btn-boss-main" ${!activeDino || isAuto ? "disabled" : ""}>
          ${isBossCleared ? "👑" : "🔥"} ボス戦：${areaBoss.name} に挑む
        </button>
      ` : ""}

      ${isFinalBossCleared ? `
        <button id="nextLoopBtn" class="btn-next-loop" ${isAuto ? "disabled" : ""}>
          🌌 次の周回（${currentLoop + 1}周目）へ進む
        </button>
      ` : ""}
    </div>
  `;

  document.getElementById("areaSelect").onchange = (e) => {
    e.target.blur();
    handlers.onSelectArea(Number(e.target.value));
  };
  document.getElementById("exploreBtn").onclick = () => handlers.onExplore(false);
  document.getElementById("autoExploreBtn").onclick = handlers.onToggleAutoExplore;

  const bossBtn = document.getElementById("bossBtn");
  if (bossBtn) bossBtn.onclick = handlers.onBossBattle;

  const nextLoopBtn = document.getElementById("nextLoopBtn");
  if (nextLoopBtn) nextLoopBtn.onclick = handlers.onAdvanceWorldLoop;

  updateIdleStage(activeDino, game.selectedAreaLevel);
}
