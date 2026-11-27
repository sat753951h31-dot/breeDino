import { calculateStats } from "../systems/stats.js";
import { requiredExp } from "../systems/level.js";
import { DEX_SPECIES } from "../data/dexSpecies.js";
import { DINO_SPECIES } from "../data/dinos.js";
import {
  rarityStars,
  getColorLabel,
  getSizeLabel,
  getRarityLabel,
  getEggRarityLabel,
  getSexLabel
} from "./labels.js";
import { AREAS } from "../data/areas.js";
import { SPECIAL_BREEDS } from "../data/specialBreeding.js";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { getChildMaxLevelInfo, calculateChildMaxLevel, getRequiredCrystals } from "../systems/breeding.js";
import { TREASURES, MAX_TREASURE_LEVEL, getTreasureDesc } from "../data/treasures.js";
import { getTraitData } from "../data/traits.js";
import { AREA_BOSSES } from "../data/bosses.js";
import { FACILITIES, FACILITY_MATERIALS, MAX_FACILITY_LEVEL, CRAFT_RECIPES, getMonumentUpgradeCost } from "../data/facilities.js";
import { renderDinoAvatar } from "./dinoVisual.js";
import { AREA_EXPEDITIONS } from "../data/expeditions.js";
import { updateIdleStage } from "./battleStage.js";
import { getDinoType, getTypeMatchupMultiplier, getTerrainMultiplier } from "../data/types.js";

const RARITY_RANK = {
  white: 1,
  blue: 2,
  purple: 3,
  rainbow: 4
};

function getSpeciesName(id) {
  const dino = DINO_SPECIES.find(d => d.id === id);
  if (dino) return dino.name;

  const special = SPECIAL_BREEDS.find(b => b.result.id === id);
  return special ? special.result.name : id;
}

// 世代の基本レベル上限（20 + 世代×5）を超えているボーナス分を計算
function getBloodlineBonus(dino) {
  if (!dino) return 0;
  const gen = dino.generation ?? 0;
  const maxLv = dino.maxLevel ?? (20 + gen * 5);
  return Math.max(0, maxLv - (20 + gen * 5));
}

// 世代バッジ（タップで世代固定値・レベル上限を表示）
function renderGenBadge(dino) {
  const gen = dino.generation ?? 0;
  const genBaseMax = 20 + gen * 5;
  const maxAllowedBonus = gen * 10;
  const maxLv = dino.maxLevel ?? genBaseMax;
  const currentBonus = Math.max(0, maxLv - genBaseMax);

  // 実際の計算式から世代のステータス固定倍率を算出
  const baseAtk = calculateStats({ ...dino, generation: 0 }).atk;
  const curAtk = calculateStats(dino).atk;
  const genMult = baseAtk > 0 ? (curAtk / baseAtk) : 1;
  const multPercent = Math.round((genMult - 1) * 100);

  const desc =
    `・世代ステータス倍率：${genMult.toFixed(2)}倍（+${multPercent}%）\n` +
    `・現在のレベル上限：Lv.${maxLv}\n` +
    `　（F${gen}基本 Lv.${genBaseMax} ＋ 継承ボーナス +${currentBonus}）\n` +
    `・F${gen}の最大上限目安：Lv.${genBaseMax + maxAllowedBonus}（ボーナス上限 +${maxAllowedBonus}）`;

  return `<span class="badge-gen" data-badge-title="🧬 世代情報【F${gen}】" data-badge-desc="${desc}">F${gen}</span>`;
}

// レア度バッジ（タップでレア度倍率・説明を表示）
function renderRarityBadge(dino) {
  const rarity = dino.rarityType ?? "white";
  const label = getRarityLabel(rarity);

  // 実際の計算式からレア度のステータス倍率を算出
  const whiteAtk = calculateStats({ ...dino, rarityType: "white" }).atk;
  const curAtk = calculateStats(dino).atk;
  const rarityMult = whiteAtk > 0 ? (curAtk / whiteAtk) : 1;
  const multPercent = Math.round((rarityMult - 1) * 100);

  const noteMap = {
    white: "最も標準的なレア度です。交配のベースや素材集めに活躍します。",
    blue: "基本能力が少し高い希少個体です。序盤〜中盤の主力に向いています。",
    purple: "非常に高い基礎能力を持つ上位個体です。交配の親としても優秀です。",
    rainbow: "最高峰のステータス倍率を誇る伝説級の個体です！"
  };

  const desc =
    `・レア度ステータス倍率：${rarityMult.toFixed(2)}倍（+${multPercent}%）\n` +
    `・特徴：${noteMap[rarity] ?? ""}`;

  return `<span class="badge-rarity" data-badge-title="✨ レア度情報【${label}】" data-badge-desc="${desc}">${label}</span>`;
}

// ログの文言から色分け用のCSSクラスを自動判定する関数
function getLogClass(text) {
  if (text.startsWith("===")) return "log-divider";
  if (text.includes("🔴")) return "log-enemy-low";  // 敵HP 25%以下（赤）
  if (text.includes("🟠")) return "log-enemy-half"; // 敵HP 50%以下（オレンジ）
  if (text.includes("☠️") || text.includes("🪦") || text.includes("❌") || text.includes("❗") || text.includes("⚠️")) {
    return "log-danger"; // 敗北・死亡・瀕死警告（赤）
  }
  if (text.includes("🏆") || text.includes("🎉") || text.includes("✨") || text.includes("💎") || text.includes("🥚")) {
    return "log-rare";   // 制覇・エリア解放・レア報酬（オレンジ/金）
  }
  if (text.includes("✅") || text.includes("🎊") || text.includes("🗺️")) {
    return "log-success"; // 勝利・探索率アップ（緑）
  }
  if (text.includes("💨")) {
    return "log-dodge";   // 回避（青）
  }
  return "log-normal";
}

// 遠征タブの通知バッジ更新
function updateExpBadge(game) {
  const badge = document.getElementById("expTabBadge");
  if (!badge) return;

  const now = Date.now();
  const doneCount = (game.expeditions ?? []).filter(e => e.endAt <= now).length;

  if (doneCount > 0) {
    badge.textContent = doneCount;
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
  }
}

// 1. スターター卵エリア
function renderStarterEgg(game, handlers) {
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

// 2. エサ在庫・ログ・交配親の表示
function renderStatusAndLogs(game, selectedMale, selectedFemale) {
  const foodStorage = document.getElementById("foodStorage");
  if (foodStorage) {
    const activeId = game.activeDinoId;
    const foodItems = [
      { type: "raw", icon: "🍖", name: "生肉", count: game.foods.raw, desc: "HP20%回復 / EXP+10" },
      { type: "good", icon: "🥩", name: "上質肉", count: game.foods.good, desc: "HP50%回復 / EXP+30" },
      { type: "premium", icon: "✨", name: "極上肉", count: game.foods.premium, desc: "HP全快 / EXP+100" }
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

      <!-- 👇 下段：貴重品（特性変更の果実 ＆ 個体値強化の秘薬） -->
      <div class="special-food-grid">
        <div class="food-card is-special-item ${fruitCount <= 0 ? "is-empty" : ""}">
          <div class="food-icon">🎲</div>
          <div class="food-name">特性変更の果実</div>
          <div class="food-count">所持: <strong>${fruitCount}</strong>個</div>
          <div class="food-desc">特性をランダム再抽選</div>
          <button
            id="useTraitFruitBtn"
            class="btn-use-special"
            ${!activeId || fruitCount <= 0 ? "disabled" : ""}
          >
            使う
          </button>
        </div>

        <div class="food-card is-special-item ${elixirCount <= 0 ? "is-empty" : ""}">
          <div class="food-icon">💉</div>
          <div class="food-name">個体値強化の秘薬</div>
          <div class="food-count">所持: <strong>${elixirCount}</strong>個</div>
          <div class="food-desc">全IV +10 (通常100 / 変異150)</div>
          <button
            id="useIvElixirBtn"
            class="btn-use-special"
            ${!activeId || elixirCount <= 0 ? "disabled" : ""}
          >
            使う
          </button>
        </div>

        <div class="food-card is-special-item ${sizePotionCount <= 0 ? "is-empty" : ""}">
          <div class="food-icon">📏</div>
          <div class="food-name">体格変化の薬</div>
          <div class="food-count">所持: <strong>${sizePotionCount}</strong>個</div>
          <div class="food-desc">体格をランダム変化</div>
          <button
            id="useSizePotionBtn"
            class="btn-use-special"
            ${!activeId || sizePotionCount <= 0 ? "disabled" : ""}
          >
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

// 3-A. 育成中の恐竜ステータス描画（左カード上部）
function renderActiveDino(game, handlers) {
  const el = document.getElementById("activeDino");
  if (!el) return;

  const activeDino = game.dinos.find(d => d.uid === game.activeDinoId);
  if (!activeDino) {
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

  // 👇 el.innerHTML より前に親密度と努力値を計算する
  const affection = Math.min(100, activeDino.affection ?? 0);
  const affectionBonus = Math.round(affection * 0.2);
  const evEarned = Math.min(100, activeDino.evEarned ?? 0);
  const ev = activeDino.ev ?? { atk: 0, hp: 0, spd: 0 };
  const evUsed = (ev.atk ?? 0) + (ev.hp ?? 0) + (ev.spd ?? 0);
  const evRemain = Math.max(0, evEarned - evUsed);

  const evRows = [
    { key: "atk", label: "⚔️ 攻撃IV", val: ev.atk ?? 0 },
    { key: "hp",  label: "❤️ HP IV",  val: ev.hp ?? 0 },
    { key: "spd", label: "💨 素早IV", val: ev.spd ?? 0 }
  ];

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
      <div class="partner-level">Lv.<span>${activeDino.level}</span><small>/${maxLv}</small></div>
    </div>

    ${renderDinoAvatar(activeDino.speciesId, {
      color: activeDino.color,
      size: activeDino.size,
      mutant: activeDino.mutant
    })}

    <!-- HP・EXP ゲージ -->
    <div class="gauge-group">
      <div class="gauge-label">
        <span>HP ${isCritical ? `<strong class="status-critical">⚠️瀕死</strong>` : ""}</span>
        <span><span id="activeDinoHp">${Math.floor(activeDino.currentHp)}</span> / ${Math.floor(stats.hp)}</span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill ${isCritical ? "hp-danger" : "hp-fill"}" style="width: ${hpPercent}%"></div>
      </div>

      <div class="gauge-label">
        <span>EXP</span>
        <span>${isMaxLv ? "<strong>MAX</strong>" : `${activeDino.exp} / ${nextExp}`}</span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill exp-fill" style="width: ${expPercent}%"></div>
      </div>
    </div>

    <!-- ステータス4マス表示 -->
    <div class="stats-mini-grid">
      <div class="stat-item"><span>⚔️ 攻撃</span><strong>${Math.floor(stats.atk)}</strong></div>
      <div class="stat-item"><span>💨 素早さ</span><strong>${Math.floor(stats.spd)}</strong></div>
      <div class="stat-item"><span>📏 体格</span><strong>${getSizeLabel(activeDino.size)}</strong></div>
      <div class="stat-item"><span>🎨 体色</span><strong>${getColorLabel(activeDino.color)}</strong></div>
    </div>

    <div class="active-trait-desc">
      <strong>${trait.icon} ${trait.name}：</strong>${trait.desc}
    </div>

    <!-- 💖 親密度 ＆ 📊 努力値カスタマイズパネル -->
    <div class="bond-ev-panel">
      <div class="gauge-label">
        <span>💖 親密度（与ダメ <strong>+${affectionBonus}%</strong>）</span>
        <span><strong>${affection}</strong> / 100</span>
      </div>
      <div class="bar-bg mini-bar">
        <div class="bar-fill affection-fill" style="width: ${affection}%"></div>
      </div>

      <div class="ev-header-row">
        <span>📊 努力値（残り: <strong>${evRemain}</strong> / 獲得: ${evEarned} <small>※最大100</small>）</span>
        <button id="resetEvBtn" type="button" class="btn-ev-reset" ${evUsed === 0 ? "disabled" : ""}>↺ リセット</button>
      </div>

      <div class="ev-rows">
        ${evRows.map(row => `
          <div class="ev-row">
            <span class="ev-stat-name">${row.label}: <strong>+${row.val}</strong></span>
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

// 3-B. 探索エリア選択＆出発ボタン描画（右カード上部）
function renderExploreBox(game, state, handlers) {
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

      <!-- 👇 出現モンスター ＆ おすすめタイプ表示 -->
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

      <!-- 出発ボタン ＆ オート周回ボタンの横並び -->
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
        <button
          id="bossBtn"
          class="btn-boss-main"
          ${!activeDino || isAuto ? "disabled" : ""}
        >
          ${isBossCleared ? "👑" : "🔥"} ボス戦：${areaBoss.name} に挑む
        </button>
      ` : ""}

      ${isFinalBossCleared ? `
        <button
          id="nextLoopBtn"
          class="btn-next-loop"
          ${isAuto ? "disabled" : ""}
        >
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
  if (bossBtn) {
    bossBtn.onclick = handlers.onBossBattle;
  }
  const nextLoopBtn = document.getElementById("nextLoopBtn");
  if (nextLoopBtn) {
    nextLoopBtn.onclick = handlers.onAdvanceWorldLoop;
  }
  updateIdleStage(activeDino, game.selectedAreaLevel);
}

// 4. 所持恐竜一覧
function renderDinoList(game, state, handlers) {
  const el = document.getElementById("dinoList");
  if (!el) return;
  el.innerHTML = "";

  const speciesSelect = document.getElementById("filterSpecies");
  const keyword = (state.filterName ?? "").trim().toLowerCase();

  if (speciesSelect) {
    // 種族ごとの所持数をカウント
    const countMap = new Map();
    game.dinos.forEach(d => {
      countMap.set(d.speciesId, (countMap.get(d.speciesId) ?? 0) + 1);
    });

    // お別れなどでその種族が0体になったら「すべて」に戻す
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

  // 1. 名前・種族・性別・タイプ・レア度・世代・ロックで絞り込み
  let list = game.dinos.filter(dino => {
    if (keyword !== "") {
      const currentName = (dino.name ?? "").toLowerCase();
      const baseSpeciesName = getSpeciesName(dino.speciesId).toLowerCase();
      if (!currentName.includes(keyword) && !baseSpeciesName.includes(keyword)) {
        return false;
      }
    }
    if (state.filterSpecies !== "all" && dino.speciesId !== state.filterSpecies) {
      return false;
    }
    if (state.filterSex !== "all" && dino.sex !== state.filterSex) {
      return false;
    }
    if (state.filterType && state.filterType !== "all") {
      const dinoType = getDinoType(dino.speciesId, dino.name);
      if (dinoType.id !== state.filterType) {
        return false;
      }
    }
    if (state.filterRarity && state.filterRarity !== "all") {
      if ((dino.rarityType ?? "white") !== state.filterRarity) {
        return false;
      }
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

  // 2. 条件で並び替え
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

  // 遠征中の恐竜IDセット
  const busyIds = new Set();
  (game.expeditions ?? []).forEach(exp => {
    exp.memberIds.forEach(id => busyIds.add(id));
  });

  // 💎 虹レア結晶還元バーの描画（絞り込み後の list を使って表示中対象をカウント）
  const rainbowBar = document.getElementById("rainbowConvertBar");
  if (rainbowBar) {
    const isMode = Boolean(state.isRainbowSelectMode);
    const pickedSet = state.selectedRainbowIds ?? new Set();
    const calcReturn = state.getRainbowCrystalReturn ?? ((d) => 5 + Math.min(10, d.generation ?? 0));

    // 表示中の恐竜のうち、保護対象外の虹レアIDだけを抽出
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
      <!-- 上部バッジ＆レベル -->
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

      <!-- 名前・性別・体格・体色 -->
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

      <!-- HP・EXP ミニゲージ -->
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

      <!-- ステータス＆個体値（IV）3列グリッド -->
      <!-- ステータス＆個体値（IV）・努力値 3列グリッド -->
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

      <!-- 横並び3連エサボタン -->
      <div class="card-feed-row">
        <button class="feed-btn" data-type="raw" data-id="${dino.uid}" ${game.foods.raw <= 0 ? "disabled" : ""} title="生肉 (HP+5 / EXP+10)">
          🍖 生肉
        </button>
        <button class="feed-btn" data-type="good" data-id="${dino.uid}" ${game.foods.good <= 0 ? "disabled" : ""} title="上質肉 (HP+20 / EXP+30)">
          🥩 上質
        </button>
        <button class="feed-btn" data-type="premium" data-id="${dino.uid}" ${game.foods.premium <= 0 ? "disabled" : ""} title="極上肉 (HP全快 / EXP+100)">
          ✨ 極上
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

      <!-- メイン設定＆交配選択ボタン -->
      <div class="card-action-row">
        <button class="set-active-btn" data-id="${dino.uid}" ${isActive || isOnExpedition ? "disabled" : ""}>
          ${isActive ? "⭐ 育成中" : isOnExpedition ? "🏕️ 遠征中" : "メインに設定"}
        </button>
        <button class="breed-select-btn ${isSelected ? "is-picked" : ""}" data-id="${dino.uid}" ${isOnExpedition ? "disabled" : ""}>
          ${isOnExpedition ? "選択不可" : isSelected ? "✅ 選択中" : "交配に選ぶ"}
        </button>
      </div>

      <!-- 最下段 -->
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

// 5. 交配卵リスト
function renderBreedingEggs(game, handlers) {
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

// 6. 野生の卵リスト
function renderWildEggs(game, handlers) {
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

// 種族IDから基礎データ（サイズや基礎ステータス）を取得するヘルパー
function getSpeciesDetail(id) {
  const normal = DINO_SPECIES.find(d => d.id === id);
  if (normal) return normal;

  const special = SPECIAL_BREEDS.find(b => b.result.id === id);
  return special ? special.result : null;
}

// 7. 図鑑
function renderDex(game, state) {
  const dexListEl = document.getElementById("dexList");
  const dexCountEl = document.getElementById("dexCount");
  if (!dexListEl || !dexCountEl) return;

  const count = game.discoveredSpecies.length;
  const total = DEX_SPECIES.length;
  const percent = total > 0 ? Math.floor((count / total) * 100) : 0;

  // ヘッダー部分に達成率バーを表示
  dexCountEl.innerHTML = `
    <div class="dex-summary">
      <div class="gauge-label">
        <span>図鑑コンプリート率 ${percent === 100 ? "👑 COMPLETE!" : ""}</span>
        <strong>${count} / ${total} 種 (${percent}%)</strong>
      </div>
      <div class="bar-bg">
        <div class="bar-fill dex-fill" style="width: ${percent}%"></div>
      </div>
    </div>
  `;

  dexListEl.innerHTML = "";

  const filterMode = state?.filterDex ?? "all";
  const filterTypeMode = state?.filterDexType ?? "all";

  const indexedSpecies = DEX_SPECIES.map((species, index) => ({
    ...species,
    no: String(index + 1).padStart(2, "0"),
    found: game.discoveredSpecies.includes(species.id),
    dinoType: getDinoType(species.id, species.name)
  }));

  const filteredSpecies = indexedSpecies.filter(item => {
    if (filterMode === "undiscovered" && item.found) return false;
    if (filterMode === "discovered" && !item.found) return false;
    if (filterTypeMode !== "all" && item.dinoType.id !== filterTypeMode) return false;
    return true;
  });

  if (filteredSpecies.length === 0) {
    dexListEl.innerHTML = `<p class="empty-msg">${
      filterMode === "undiscovered" && filterTypeMode === "all"
        ? "👑 すべての恐竜を発見済みです！図鑑コンプリートおめでとうございます！"
        : "条件に一致する恐竜がいません。"
    }</p>`;
    return;
  }

  filteredSpecies.forEach((species) => {
    const div = document.createElement("div");
    const { found, no, dinoType } = species;

    if (found) {
      const detail = getSpeciesDetail(species.id);
      div.className = `dex-card is-found ${species.special ? "is-special" : ""}`;

      div.innerHTML = `
        <div class="dex-card-top">
          <span class="dex-no">No.${no}</span>
          <span class="badge-type type-${dinoType.id}" title="${dinoType.desc}">${dinoType.icon} ${dinoType.name}</span>
          ${species.special ? `<span class="badge-special">✨ 特殊交配</span>` : `<span class="badge-normal">通常種</span>`}
        </div>
        <h4>${species.name}</h4>
        ${renderDinoAvatar(species.id, {
          size: detail?.size ?? "normal",
          compact: true
        })}
        ${detail ? `
          <div class="dex-size">体格: <strong>${getSizeLabel(detail.size)}</strong></div>
          <div class="dex-stats">
            <span>⚔️ ${detail.baseAtk}</span>
            <span>❤️ ${detail.baseHp}</span>
            <span>💨 ${detail.baseSpd}</span>
          </div>
        ` : ""}
      `;
    } else {
      div.className = "dex-card is-unknown";

      if (species.special && species.parents) {
        div.innerHTML = `
          <div class="dex-card-top">
            <span class="dex-no">No.${no}</span>
            <span class="badge-special">✨ 特殊交配</span>
          </div>
          <h4>❔ ?????</h4>
          ${renderDinoAvatar(species.id, {
            isUnknown: true,
            compact: true
          })}
          <div class="dex-hint">
            💡 交配ヒント<br>
            <strong>${getSpeciesName(species.parents[0])}</strong> × <strong>${getSpeciesName(species.parents[1])}</strong>
          </div>
        `;
      } else {
        div.innerHTML = `
          <div class="dex-card-top">
            <span class="dex-no">No.${no}</span>
          </div>
          <h4>❔ ?????</h4>
          ${renderDinoAvatar(species.id, {
            isUnknown: true,
            compact: true
          })}
          <div class="dex-hint">探索や卵から発見しよう</div>
        `;
      }
    }

    dexListEl.appendChild(div);
  });

}

// 8. 実績・記録タブの描画
function renderRecords(game, state) {
  const recordGrid = document.getElementById("recordGrid");
  const achievementList = document.getElementById("achievementList");
  const achievementCount = document.getElementById("achievementCount");
  if (!recordGrid || !achievementList) return;

  const s = game.stats;
  const currentCrystals = game.items?.breedCrystal ?? 0;

  const records = [
    { icon: "⚔️", label: "探索勝利数", value: `${s.exploreWins} 回` },
    { icon: "🥚", label: "卵の孵化数", value: `${s.eggsHatched} 個` },
    { icon: "💕", label: "交配回数", value: `${s.breedsDone} 回` },
    { icon: "💎", label: "結晶所持数", value: `${currentCrystals} 個` },
    { icon: "🧬", label: "突然変異誕生数", value: `${s.mutantsBorn} 体` },
    { icon: "🏕️", label: "遠征帰還数", value: `${s.expeditionsDone ?? 0} 回` },
    { icon: "👑", label: "到達最高世代", value: `F${s.maxGeneration}` },
    { icon: "👋", label: "お別れした数", value: `${s.dinosReleased} 体` },
    { icon: "🪦", label: "探索ロスト数", value: `${s.dinosLost ?? 0} 体` },
    { icon: "🔨", label: "工房クラフト回数", value: `${s.itemsCrafted ?? 0} 回` },
    { icon: "🎲", label: "厳選アイテム使用数", value: `${s.itemsUsed ?? 0} 回` },
    { icon: "🎰", label: "ガチャ召喚回数", value: `${s.gachaRolls ?? 0} 回` },
  ];

  recordGrid.innerHTML = records.map(r => `
    <div class="record-box">
      <div class="record-icon">${r.icon}</div>
      <div class="record-label">${r.label}</div>
      <div class="record-val">${r.value}</div>
    </div>
  `).join("");

  const unlockedCount = game.unlockedAchievements.length;
  const totalCount = ACHIEVEMENTS.length;
  const achPercent = totalCount > 0 ? Math.floor((unlockedCount / totalCount) * 100) : 0;

  if (achievementCount) {
    achievementCount.innerHTML = `
      <div class="ach-summary-card ${achPercent === 100 ? "is-complete" : ""}">
        <div class="gauge-label">
          <span>🏆 実績コンプリート率 ${achPercent === 100 ? "👑 COMPLETE!" : ""}</span>
          <strong>${unlockedCount} / ${totalCount} 達成 (${achPercent}%)</strong>
        </div>
        <div class="bar-bg">
          <div class="bar-fill ach-fill" style="width: ${achPercent}%"></div>
        </div>
      </div>
    `;
  }

  const filterMode = state?.filterAchievement ?? "all";
  const filteredAchievements = ACHIEVEMENTS.filter(ach => {
    const isUnlocked = game.unlockedAchievements.includes(ach.id);
    if (filterMode === "incomplete") return !isUnlocked;
    if (filterMode === "unlocked") return isUnlocked;
    return true;
  });

  if (filteredAchievements.length === 0) {
    achievementList.innerHTML = `<p class="empty-msg">${
      filterMode === "incomplete"
        ? "👑 すべての実績を達成済みです！おめでとうございます！"
        : "条件に一致する実績がありません。"
    }</p>`;
    return;
  }

  achievementList.innerHTML = filteredAchievements.map(ach => {
    const isUnlocked = game.unlockedAchievements.includes(ach.id);
    const { current, max } = ach.getProgress(game);
    const clamped = Math.min(current, max);
    const percent = Math.floor((clamped / max) * 100);

    return `
      <div class="ach-card ${isUnlocked ? "is-unlocked" : ""}">
        <div class="ach-header">
          <span class="ach-title">${isUnlocked ? "🏆" : "🔒"} ${ach.title}</span>
          <span class="ach-reward">報酬: ${ach.rewardText}</span>
        </div>
        <p class="ach-desc">${ach.desc}</p>
        <div class="gauge-label">
          <span>${isUnlocked ? "✅ 達成済み" : "進行度"}</span>
          <span>${clamped} / ${max}</span>
        </div>
        <div class="bar-bg mini-bar">
          <div class="bar-fill ${isUnlocked ? "hp-fill" : "area-fill"}" style="width: ${percent}%"></div>
        </div>
      </div>
    `;
  }).join("");

}

// 1秒ごとのタイマー専用（ボタンを消さずに数値だけ更新する）
export function renderTick(game, handlers) {
  // 育成中恐竜のHP更新
  const activeDino = game.dinos.find(d => d.uid === game.activeDinoId);
  const activeHpEl = document.getElementById("activeDinoHp");
  if (activeDino && activeHpEl) {
    activeHpEl.textContent = Math.floor(activeDino.currentHp);
  }

  // 一覧の恐竜たちのHP更新
  document.querySelectorAll(".dino-hp").forEach(el => {
    const dino = game.dinos.find(d => d.uid === el.dataset.uid);
    if (dino) {
      el.textContent = Math.floor(dino.currentHp);
    }
  });

  // 交配卵の残り秒数更新（0秒になって孵化ボタンを出すときだけ再描画）
  let needEggRedraw = false;
  game.breedingEggs.forEach(egg => {
    const remain = Math.max(0, Math.ceil((egg.hatchAt - Date.now()) / 1000));
    const remainEl = document.querySelector(`.egg-remain[data-id="${egg.id}"]`);
    if (remainEl) {
      remainEl.textContent = remain;
    }
    if (remain <= 0 && !document.querySelector(`.hatch-child-btn[data-id="${egg.id}"]`)) {
      needEggRedraw = true;
    }
  });

  // 野生の卵の残り秒数更新
  let needWildEggRedraw = false;
  game.wildEggs.forEach(egg => {
    const remain = Math.max(0, Math.ceil(((egg.hatchAt ?? 0) - Date.now()) / 1000));
    const remainEl = document.querySelector(`.wild-egg-remain[data-id="${egg.id}"]`);
    if (remainEl) {
      remainEl.textContent = remain;
    }
    if (remain <= 0 && !document.querySelector(`.wild-hatch-btn[data-id="${egg.id}"]`)) {
      needWildEggRedraw = true;
    }
  });

  if (needEggRedraw) {
    renderBreedingEggs(game, handlers);
  }

  if (needWildEggRedraw) {
    renderWildEggs(game, handlers);
  }

  let needExpRedraw = false;
  (game.expeditions ?? []).forEach(exp => {
    const remain = Math.max(0, Math.ceil((exp.endAt - Date.now()) / 1000));
    const secEl = document.querySelector(`.exp-team-remain[data-id="${exp.id}"]`);
    if (secEl) secEl.textContent = remain;
    if (remain <= 0 && !document.querySelector(`.btn-exp-claim[data-id="${exp.id}"]`)) {
      needExpRedraw = true;
    }
  });
  if (needExpRedraw) {
    renderExpeditionTab(game, handlers);
  }
  updateExpBadge(game);

  updateBreedBadge(game);
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

// 交配ステージの描画
function renderBreedingStage(game, selectedMale, selectedFemale) {
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

  // 特殊交配レシピに一致するかのプレビュー判定
  let previewHtml = "";
  if (male && female) {
    const lvInfo = getChildMaxLevelInfo(male, female);

    const ids = [male.speciesId, female.speciesId].sort();
    const special = SPECIAL_BREEDS.find(b => {
      const pIds = [...b.parents].sort();
      return pIds[0] === ids[0] && pIds[1] === ids[1];
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

// 孵化完了バッジの更新
function updateBreedBadge(game) {
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

function renderTreasures(game) {
  const el = document.getElementById("treasureList");
  if (!el) return;

  const owned = game.treasures ?? {};

  el.innerHTML = TREASURES.map(t => {
    const lv = Array.isArray(owned)
      ? (owned.includes(t.id) ? 1 : 0)
      : (Number(owned[t.id]) || 0);

    const hasIt = lv > 0;
    const isMax = lv >= MAX_TREASURE_LEVEL;

    return `
      <div class="treasure-card ${hasIt ? "is-owned" : "is-missing"} ${isMax ? "is-max" : ""}">
        <div class="treasure-top">
          <span class="treasure-area">エリア Lv.${t.areaLevel}</span>
          ${hasIt ? `<span class="treasure-lv ${isMax ? "max" : ""}">${isMax ? "👑 Lv.MAX" : `Lv.${lv} / ${MAX_TREASURE_LEVEL}`}</span>` : ""}
        </div>
        <div class="treasure-icon">${hasIt ? t.icon : "❔"}</div>
        <div class="treasure-name">${hasIt ? t.name : "未発見の秘宝"}</div>
        <div class="treasure-desc">${hasIt ? getTreasureDesc(t, lv) : `エリア Lv.${t.areaLevel} の探索でドロップ`}</div>
      </div>
    `;
  }).join("");
}

function renderFacility(game, handlers) {
  const matEl = document.getElementById("materialStorage");
  const listEl = document.getElementById("facilityList");
  if (!matEl || !listEl) return;

  const mats = game.materials ?? { wood: 0, stone: 0, ore: 0 };
  const foods = game.foods ?? { raw: 0, good: 0, premium: 0 };

  // 1. 所持素材・お肉の一覧バー
  matEl.innerHTML = `
    <div class="material-bar">
      ${FACILITY_MATERIALS.map(m => `
        <div class="mat-item">
          <span class="mat-icon">${m.icon}</span>
          <div>
            <div class="mat-name">${m.name}</div>
            <div class="mat-count">所持: <strong>${mats[m.id] ?? 0}</strong>個 <small>(${m.desc})</small></div>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  // 2. 3つの設備カードを描画
  const facState = game.facility ?? { incubatorLevel: 0, trainingLevel: 0, kitchenLevel: 0 };

  listEl.innerHTML = FACILITIES.map(fac => {
    const currentLv = facState[fac.key] ?? 0;
    const isMax = currentLv >= MAX_FACILITY_LEVEL;
    const currentInfo = fac.levels.find(l => l.level === currentLv);
    const nextPlan = fac.levels.find(l => l.level === currentLv + 1);

    let canAfford = false;
    if (nextPlan) {
      canAfford = Object.entries(nextPlan.cost).every(([itemKey, needed]) => {
        const owned = ["wood", "stone", "ore"].includes(itemKey)
          ? (mats[itemKey] ?? 0)
          : (foods[itemKey] ?? 0);
        return owned >= needed;
      });
    }

    return `
      <div class="facility-card ${isMax ? "is-max" : ""}">
        <div class="fac-card-header">
          <h3>${fac.icon} ${fac.name}</h3>
          <span class="fac-lv-badge ${isMax ? "max" : ""}">
            ${isMax ? "👑 Lv.MAX" : `Lv.${currentLv} / ${MAX_FACILITY_LEVEL}`}
          </span>
        </div>
        <p class="fac-desc">${fac.baseDesc}</p>
        <div class="fac-effect-box">
          <div>現在効果：<strong>${currentInfo ? currentInfo.effectText : "なし（未建設）"}</strong></div>
          ${nextPlan ? `<div class="fac-next-effect">次の効果：<strong>${nextPlan.effectText}</strong></div>` : ""}
        </div>
        ${isMax
          ? `<div class="fac-max-label">✨ 最大レベルまで強化済み！</div>`
          : `<div class="fac-upgrade-footer">
               <div class="facility-cost">必要素材：${nextPlan.costText}</div>
               <button class="btn-upgrade" data-key="${fac.key}" ${!canAfford ? "disabled" : ""}>
                 🔨 納品して強化する
               </button>
             </div>`
        }
      </div>
    `;
  }).join("");

  listEl.querySelectorAll(".btn-upgrade").forEach(btn => {
    btn.onclick = () => handlers.onUpgradeFacility(btn.dataset.key);
  });

  // 3. 🗿 古代のモニュメント（無限強化施設）
  const monEl = document.getElementById("monumentBox");
  if (monEl) {
    const maxedCount = FACILITIES.filter(f => (facState[f.key] ?? 0) >= MAX_FACILITY_LEVEL).length;
    const isMonumentUnlocked = maxedCount >= FACILITIES.length;

    const monLv = facState.monumentLevel ?? 0;
    const plan = getMonumentUpgradeCost(monLv);
    const canAffordMon =
      isMonumentUnlocked &&
      (mats.wood ?? 0) >= plan.wood &&
      (mats.stone ?? 0) >= plan.stone &&
      (mats.ore ?? 0) >= plan.ore;

    monEl.innerHTML = `
      <div class="endgame-section-box is-monument ${!isMonumentUnlocked ? "is-locked" : ""}">
        <div class="fac-card-header">
          <h3>🗿 古代のモニュメント（無限強化）</h3>
          <span class="fac-lv-badge">
            ${isMonumentUnlocked
              ? `Lv.${monLv}（全ステ +${monLv * 2}%）`
              : `🔒 未解放（MAX施設: ${maxedCount} / ${FACILITIES.length}）`
            }
          </span>
        </div>
        <p class="fac-desc">
          <strong>【解放条件】上の基本4施設すべてが Lv.MAX になると活性化します。</strong><br>
          上限なしで強化できる古代の石碑。遠征素材を捧げるたびに全恐竜の攻撃・HP・素早さが +2% ずつ永遠に上昇します。
        </p>
        <div class="monument-action-row">
          <div class="facility-cost">
            ${isMonumentUnlocked
              ? `次の強化（Lv.${plan.nextLv} / +${plan.nextLv * 2}%）：<strong>${plan.costText}</strong>`
              : `※まずは基本の4施設をすべて Lv.MAX まで強化してください`
            }
          </div>
          <button id="upgradeMonumentBtn" class="btn-upgrade" ${!canAffordMon ? "disabled" : ""}>
            ${isMonumentUnlocked ? "🗿 モニュメントを強化する" : "🔒 4施設MAXで解放"}
          </button>
        </div>
      </div>
    `;
    document.getElementById("upgradeMonumentBtn").onclick = handlers.onUpgradeMonument;
  }

  // 4. 🔨 古代工房（基本4施設がすべてLv.MAXで解放）
  const craftEl = document.getElementById("craftWorkshopBox");
  if (craftEl) {
    const maxedCount = FACILITIES.filter(f => (facState[f.key] ?? 0) >= MAX_FACILITY_LEVEL).length;
    const isWorkshopUnlocked = maxedCount >= FACILITIES.length;

    craftEl.innerHTML = `
      <div class="endgame-section-box is-workshop ${!isWorkshopUnlocked ? "is-locked" : ""}">
        <div class="fac-card-header">
          <h3>🔨 古代工房（素材クラフト）</h3>
          <span class="fac-lv-badge">
            ${isWorkshopUnlocked
              ? "✨ 稼働中"
              : `🔒 未解放（MAX施設: ${maxedCount} / ${FACILITIES.length}）`
            }
          </span>
        </div>
        <p class="fac-desc">
          <strong>【解放条件】上の基本4施設すべてが Lv.MAX になると解放されます。</strong><br>
          余った建築素材から生命の結晶や厳選アイテム（特性変更の果実・個体値強化の秘薬）を作成できます。
        </p>

        <!-- クラフトレシピ一覧 -->
        <div class="craft-grid">
          ${CRAFT_RECIPES.map(r => {
            const canCraft = isWorkshopUnlocked && Object.entries(r.cost).every(([k, needed]) => {
              const owned = ["wood", "stone", "ore"].includes(k) ? (mats[k] ?? 0) : (foods[k] ?? 0);
              return owned >= needed;
            });

            // 現在の所持数を取得
            let currentOwned = 0;
            if (r.id === "craft_crystal") currentOwned = game.items?.breedCrystal ?? 0;
            else if (r.id === "craft_premium_meat") currentOwned = foods.premium ?? 0;
            else if (r.id === "craft_trait_fruit") currentOwned = game.items?.traitFruit ?? 0;
            else if (r.id === "craft_iv_elixir") currentOwned = game.items?.ivElixir ?? 0;
            else if (r.id === "craft_size_potion") currentOwned = game.items?.sizePotion ?? 0;

            return `
              <div class="craft-card">
                <div class="craft-header-row">
                  <div class="craft-title">${r.icon} <strong>${r.name}</strong></div>
                  <span class="craft-owned-badge">所持: <strong>${currentOwned}</strong>個</span>
                </div>
                <div class="craft-desc">${r.desc}</div>
                <div class="facility-cost">素材：${r.costText}</div>
                <button class="btn-craft" data-id="${r.id}" ${!canCraft ? "disabled" : ""}>
                  ${isWorkshopUnlocked ? `🔨 作成する（所持: ${currentOwned}）` : "🔒 4施設MAXで解放"}
                </button>
              </div>
            `;
          }).join("")}
        </div>

      </div>
    `;

    craftEl.querySelectorAll(".btn-craft").forEach(btn => {
      btn.onclick = () => handlers.onCraftItem(btn.dataset.id);
    });
  }

}

// 9. 遠征タブ全体の描画
function renderExpeditionTab(game, handlers) {
  const activeEl = document.getElementById("activeExpeditions");
  const builderEl = document.getElementById("expeditionBuilder");
  const gridEl = document.getElementById("expeditionDinoGrid");
  if (!activeEl || !builderEl || !gridEl) return;

  const allLevels = AREA_EXPEDITIONS.map(e => e.areaLevel);
  const unlockedLevels = (game.worldLoop ?? 1) > 1
    ? allLevels
    : allLevels.filter(lv => (game.areaProgress?.[lv] ?? 0) >= 100);

  const maxTeams = unlockedLevels.length;
  const activeExps = game.expeditions ?? [];

  // 0エリアも100%になっていない場合
  if (maxTeams === 0) {
    activeEl.innerHTML = "";
    builderEl.innerHTML = `
      <div class="exp-locked-notice">
        <h3>🔒 遠征機能はまだ解放されていません</h3>
        <p>いずれかのエリアの<strong>探索率を 100%</strong> にすると、そのエリアへの遠征とチーム枠が解放されます！</p>
      </div>
    `;
    gridEl.innerHTML = "";
    return;
  }

  // 1. 出撃中の遠征チーム一覧
  const now = Date.now();
  activeEl.innerHTML = `
    <div class="exp-section-header">
      <h2>🏕️ 遠征中の部隊（${activeExps.length} / ${maxTeams} 枠稼働中）</h2>
      <small>※エリア100%制覇数に応じて同時派遣枠が増えます</small>
    </div>
    ${activeExps.length === 0
      ? `<p class="empty-msg">現在出撃中の遠征隊はありません。</p>`
      : `<div class="active-exp-grid">
          ${activeExps.map(exp => {
            const course = AREA_EXPEDITIONS.find(c => c.areaLevel === exp.areaLevel) ?? AREA_EXPEDITIONS[0];
            const remain = Math.max(0, Math.ceil((exp.endAt - now) / 1000));
            const isDone = remain <= 0;
            const memberNames = exp.memberIds
              .map(id => game.dinos.find(d => d.uid === id)?.name)
              .filter(Boolean)
              .join(" / ");

            return `
              <div class="active-exp-card ${isDone ? "is-done" : ""}">
                <div class="exp-card-title">${course.icon} ${course.name}</div>
                <div class="exp-card-members">メンバー：<strong>${memberNames}</strong></div>
                <div class="exp-card-footer">
                  ${isDone
                    ? `<span class="exp-done-msg">✨ 帰還完了！</span>
                       <button class="btn-exp-claim" data-id="${exp.id}">🎁 報酬を受け取る</button>`
                    : `<span>⏳ 残り <strong class="exp-team-remain" data-id="${exp.id}">${remain}</strong> 秒</span>`
                  }
                </div>
              </div>
            `;
          }).join("")}
        </div>`
    }
  `;

  activeEl.querySelectorAll(".btn-exp-claim").forEach(btn => {
    btn.onclick = () => handlers.onClaimExpedition(btn.dataset.id);
  });

  const busyIds = new Set();
  activeExps.forEach(e => e.memberIds.forEach(id => busyIds.add(id)));

  const draft = game.expeditionDraft ?? { areaLevel: unlockedLevels[0], memberIds: [] };
  const selectedLevel = unlockedLevels.includes(draft.areaLevel) ? draft.areaLevel : unlockedLevels[0];
  const validDraftMembers = draft.memberIds.filter(
    id => id !== game.activeDinoId && !busyIds.has(id) && game.dinos.some(d => d.uid === id)
  );

  // 2. 新規チーム編成パネル
  if (document.activeElement?.id !== "expAreaSelect") {
    const canLaunch = activeExps.length < maxTeams && validDraftMembers.length > 0;
    const luckyCount = validDraftMembers.filter(id => {
      const d = game.dinos.find(dino => dino.uid === id);
      return d?.trait === "hunter";
    }).length;
    const luckPercent = luckyCount * 10;
    const standbyCount = game.dinos.filter(d => d.uid !== game.activeDinoId && !busyIds.has(d.uid)).length;

    const selectedCourse = AREA_EXPEDITIONS.find(item => item.areaLevel === selectedLevel) ?? AREA_EXPEDITIONS[0];

    const optionsHtml = unlockedLevels.map(lv => {
      const c = AREA_EXPEDITIONS.find(item => item.areaLevel === lv);
      return `<option value="${lv}" ${lv === selectedLevel ? "selected" : ""}>${c.icon} ${c.name}</option>`;
    }).join("");

    builderEl.innerHTML = `
      <div class="exp-builder-box">
        <div class="exp-builder-top">
          <strong>🚩 新規チームの編成（選択中: ${validDraftMembers.length} / 3 体）</strong>
          <span>空き部隊枠: <strong>${maxTeams - activeExps.length}</strong> 枠</span>
        </div>
        <div class="exp-luck-info">
          <span>💡 特性「<strong>🍀 幸運</strong>」持ちでドロップ率UP！（1体につき <strong>+10%</strong> 重複）</span>
          <span class="exp-luck-badge ${luckyCount > 0 ? "is-active" : ""}">
            🍀 幸運ボーナス: <strong>+${luckPercent}%</strong>
          </span>
        </div>
        <div class="exp-setup-row">
          <select id="expAreaSelect">${optionsHtml}</select>
          <div class="exp-action-btns">
            <button id="autoSelectExpBtn" class="btn-exp-auto" ${standbyCount === 0 ? "disabled" : ""} title="幸運・高レア・低レベルを優先して最大3体自動選択">
              ✨ おすすめ編成
            </button>
            <button id="startExpBtn" class="btn-exp-start" ${!canLaunch ? "disabled" : ""}>
              ${activeExps.length >= maxTeams ? "部隊枠がいっぱいです" : "🚩 遠征に出発"}
            </button>
          </div>
        </div>
        <div class="exp-reward-preview">
          🎁 <strong>主な獲得報酬：</strong>${selectedCourse.rewardDesc}
        </div>
      </div>
    `;

    document.getElementById("expAreaSelect").onchange = (e) => {
      e.target.blur();
      handlers.onSelectExpArea(Number(e.target.value));
    };
    document.getElementById("startExpBtn").onclick = handlers.onStartExpedition;
    document.getElementById("autoSelectExpBtn").onclick = handlers.onAutoSelectExpMembers;
    document.getElementById("startExpBtn").onclick = handlers.onStartExpedition;

  }

  // 3. 待機恐竜カード一覧（🍀幸運持ち ＞ レベル順 ＞ 遠征中は下へ自動整列）
  const standbyDinos = game.dinos
    .filter(d => d.uid !== game.activeDinoId)
    .sort((a, b) => {
      // 1. すでに遠征中の個体は一番下に回す
      const busyA = busyIds.has(a.uid) ? 1 : 0;
      const busyB = busyIds.has(b.uid) ? 1 : 0;
      if (busyA !== busyB) return busyA - busyB;

      // 2. 特性「幸運（hunter）」を持っている個体を最優先で上に並べる
      const luckyA = a.trait === "hunter" ? 1 : 0;
      const luckyB = b.trait === "hunter" ? 1 : 0;
      if (luckyA !== luckyB) return luckyB - luckyA;

      // 3. 同じ条件ならレベルが高い順（戦力が高い順）に並べる
      return b.level - a.level;
    });

  if (standbyDinos.length === 0) {
    gridEl.innerHTML = "<p class='empty-msg'>派遣できる待機恐竜がいません。</p>";
    return;
  }

  gridEl.innerHTML = "";
  standbyDinos.forEach(dino => {
    const stats = calculateStats(dino);
    const trait = getTraitData(dino.trait);
    const isBusy = busyIds.has(dino.uid);
    const isPicked = validDraftMembers.includes(dino.uid);
    const isLucky = dino.trait === "hunter";

    const card = document.createElement("div");
    card.className = `dino-card ${isPicked ? "is-selected" : ""} ${isBusy ? "is-busy" : ""}`;

    card.innerHTML = `
      <div class="card-top-row" style="min-height: 28px;">
        <div class="card-badges">
          ${renderGenBadge(dino)}
          ${renderRarityBadge(dino)}
          <span class="badge-trait ${isLucky ? "is-lucky-highlight" : ""}" title="${trait.desc}" data-trait-name="${trait.icon} ${trait.name}" data-trait-desc="${trait.desc}">
            ${trait.icon} ${trait.name}
          </span>
        </div>
        <div class="card-lv">Lv.<strong>${dino.level}</strong></div>
      </div>

      <div class="card-name-line">
        <h3>${dino.name}</h3>
        <small>${getSexLabel(dino.sex)}</small>
      </div>

      ${renderDinoAvatar(dino.speciesId, {
        color: dino.color,
        size: dino.size,
        mutant: dino.mutant,
        compact: true
      })}

      <div class="card-stat-grid">
        <div class="stat-box"><div class="stat-label">⚔️ 攻撃</div><div class="stat-val">${Math.floor(stats.atk)}</div></div>
        <div class="stat-box"><div class="stat-label">❤️ HP</div><div class="stat-val">${Math.floor(stats.hp)}</div></div>
        <div class="stat-box"><div class="stat-label">💨 素早さ</div><div class="stat-val">${Math.floor(stats.spd)}</div></div>
      </div>

      <button
        class="btn-exp-pick ${isPicked ? "is-picked" : ""}"
        data-id="${dino.uid}"
        ${isBusy ? "disabled" : ""}
      >
        ${isBusy ? "🏕️ 遠征中" : isPicked ? "✅ メンバー選択中" : "＋ チームに加える"}
      </button>
    `;
    gridEl.appendChild(card);
  });

  gridEl.querySelectorAll(".btn-exp-pick").forEach(btn => {
    btn.onclick = () => handlers.onToggleExpDraftMember(btn.dataset.id);
  });
}

// 10. ガチャ卵タブの描画
function renderGachaTab(game, state, handlers) {
  const stageEl = document.getElementById("gachaStage");
  const resultEl = document.getElementById("gachaResultArea");
  if (!stageEl || !resultEl) return;

  const crystals = game.items?.breedCrystal ?? 0;
  const maxGen = state?.gachaMaxGen ?? 5;
  const discoveredCount = (game.discoveredSpecies ?? []).length;

  const currentLoop = game.worldLoop ?? 1;
  const isPremiumUnlocked = currentLoop >= 3;
  const pRange = state?.premiumGachaRange ?? { minGen: 3, maxGen: 5 };

  stageEl.innerHTML = `
    <!-- 通常ガチャ枠 -->
    <div class="gacha-box">
      <div class="gacha-status-row">
        <div class="gacha-crystal-pill">💎 所持結晶：<strong>${crystals}</strong> 個</div>
        <div class="gacha-spec-pill">📖 対象種族：<strong>${discoveredCount}</strong> 種 ／ 🧬 出現世代：<strong>F0 〜 F${maxGen}</strong></div>
      </div>

      <div class="gacha-rates-info">
        <span>【通常ガチャ】⚪ 白 45% ／ 🔵 青 30% ／ 🟣 紫 18% ／ 🌈 虹 7%（🧬 突然変異 12%・希少体色 28%）</span>
      </div>

      <div class="gacha-btn-group">
        <button id="gacha1Btn" class="btn-gacha-single" ${crystals < 10 ? "disabled" : ""}>
          🥚 1回まわす<br><small>💎 生命の結晶 ×10</small>
        </button>
        <button id="gacha10Btn" class="btn-gacha-multi" ${crystals < 100 ? "disabled" : ""}>
          🌈 10回まわす<br><small>💎 生命の結晶 ×100</small>
        </button>
      </div>
    </div>

    <!-- 👑 高級ガチャ枠（3周目以降で解放） -->
    <div class="gacha-box is-premium ${!isPremiumUnlocked ? "is-locked" : ""}">
      <div class="gacha-status-row">
        <div class="gacha-premium-title">👑 高級ガチャ（ハイグレード召喚）</div>
        <div class="gacha-spec-pill">
          ${isPremiumUnlocked
            ? `🧬 出現世代保証：<strong>F${pRange.minGen} 〜 F${pRange.maxGen}</strong>`
            : `🔒 <strong>3周目到達で解放</strong>（現在 ${currentLoop}周目）`
          }
        </div>
      </div>

      <div class="gacha-rates-info">
        <span>【高級ガチャ】<strong>⚪白なし・レベル上限MAX確定！</strong> 🔵 青 35% ／ 🟣 紫 40% ／ 🌈 虹 25%（🧬 突然変異 25%・IV40以上保証）</span>
      </div>

      <div class="gacha-btn-group">
        <button id="premiumGacha1Btn" class="btn-gacha-premium-single" ${!isPremiumUnlocked || crystals < 100 ? "disabled" : ""}>
          ${isPremiumUnlocked ? "👑 高級1回まわす<br><small>💎 生命の結晶 ×100</small>" : "🔒 3周目で解放<br><small>💎 結晶 ×100</small>"}
        </button>
        <button id="premiumGacha10Btn" class="btn-gacha-premium-multi" ${!isPremiumUnlocked || crystals < 1000 ? "disabled" : ""}>
          ${isPremiumUnlocked ? "🌟 高級10回まわす<br><small>💎 生命の結晶 ×1,000</small>" : "🔒 3周目で解放<br><small>💎 結晶 ×1,000</small>"}
        </button>
      </div>
    </div>
  `;

  document.getElementById("gacha1Btn").onclick = () => handlers.onRollGacha(1, false);
  document.getElementById("gacha10Btn").onclick = () => handlers.onRollGacha(10, false);
  document.getElementById("premiumGacha1Btn").onclick = () => handlers.onRollGacha(1, true);
  document.getElementById("premiumGacha10Btn").onclick = () => handlers.onRollGacha(10, true);

  // 直近のガチャ結果表示
  const results = state?.lastGachaResults ?? [];
  if (results.length === 0) {
    resultEl.innerHTML = `<p class="empty-msg">上のボタンを押してガチャ卵を召喚しよう！</p>`;
    return;
  }

  resultEl.innerHTML = `
    <h3 class="gacha-result-title">✨ 召喚結果（${results.length}体）</h3>
    <div class="gacha-result-grid">
      ${results.map(dino => {
        const trait = getTraitData(dino.trait);
        const dinoType = getDinoType(dino.speciesId, dino.name);
        const bonus = getBloodlineBonus(dino);
        const isHighRare = dino.rarityType === "rainbow" || dino.rarityType === "purple" || dino.mutant;

        return `
          <div class="dino-card gacha-card ${isHighRare ? "is-gacha-jackpot" : ""} ${dino.mutant ? "is-mutant" : ""}">
            <div class="card-top-row">
              <div class="card-badges">
                ${renderGenBadge(dino)}
                <span class="badge-type type-${dinoType.id}">${dinoType.icon} ${dinoType.name}</span>
                ${bonus > 0 ? `<span class="badge-bloodline">📈上限+${bonus}</span>` : ""}
                ${renderRarityBadge(dino)}
                <span
                  class="badge-trait"
                  title="${trait.desc}"
                  data-trait-name="${trait.icon} ${trait.name}"
                  data-trait-desc="${trait.desc}"
                >${trait.icon} ${trait.name}</span>
                ${renderMutantBadge(dino)}
              </div>
              <div class="card-lv">Lv.1<small>/${dino.maxLevel}</small></div>
            </div>

            <div class="card-name-line">
              <h3>${dino.name}</h3>
              <small>${getSexLabel(dino.sex)}</small>
            </div>

            ${renderDinoAvatar(dino.speciesId, {
              color: dino.color,
              size: dino.size,
              mutant: dino.mutant,
              compact: true
            })}

            <div class="card-sub-meta">
              <span>📏 ${getSizeLabel(dino.size)}</span>
              <span>🎨 ${getColorLabel(dino.color)}</span>
            </div>
            <div class="card-iv-total">
              IV: ATK <strong>${dino.atkIv}</strong> / HP <strong>${dino.hpIv}</strong> / SPD <strong>${dino.spdIv}</strong>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// ミュータントバッジ（タップで突然変異の説明を表示）
function renderMutantBadge(dino) {
  if (!dino?.mutant) return "";

  const desc =
    `・突然変異によって誕生した希少な覚醒個体です！\n` +
    `・通常の上限（IV 100）を超える高い個体値（最大150）や特別なオーラを宿しています。\n` +
    `・交配の親にすると、その高い個体値を次世代へ引き継ぐことができます。`;

  return `<span class="badge-mutant" data-badge-title="🧬 突然変異【MUTANT】" data-badge-desc="${desc}">🧬 MUTANT</span>`;
}

// 全体描画のエントリーポイント
export function renderGame(game, state, handlers) {
  renderStarterEgg(game, handlers);
  renderStatusAndLogs(game, state.selectedMale, state.selectedFemale);
  renderActiveDino(game, handlers);
  renderExploreBox(game, state, handlers);
  renderDinoList(game, state, handlers);
  renderBreedingEggs(game, handlers);
  renderWildEggs(game, handlers);
  renderDex(game, state);
  updateBreedBadge(game);
  renderBreedingStage(game, state.selectedMale, state.selectedFemale);
  renderRecords(game, state);
  renderTreasures(game);
  renderFacility(game, handlers);
  renderExpeditionTab(game, handlers);
  renderGachaTab(game, state, handlers);
  updateExpBadge(game);

  // エサやりボタンの共通登録（育成中エリア＋一覧の両方に対応）
  document.querySelectorAll(".feed-btn").forEach(btn => {
    btn.onclick = () => handlers.onFeed(btn.dataset.id, btn.dataset.type);
  });

  const fruitBtn = document.getElementById("useTraitFruitBtn");
  if (fruitBtn) fruitBtn.onclick = () => handlers.onUseTraitFruit();

  const elixirBtn = document.getElementById("useIvElixirBtn");
  if (elixirBtn) elixirBtn.onclick = () => handlers.onUseIvElixir();

  const sizePotionBtn = document.getElementById("useSizePotionBtn");
  if (sizePotionBtn) sizePotionBtn.onclick = () => handlers.onUseSizePotion();

}
