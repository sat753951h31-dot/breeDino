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
import { INCUBATOR_LEVELS, MAX_INCUBATOR_LEVEL } from "../data/facility.js";
import { FACILITIES, FACILITY_MATERIALS, MAX_FACILITY_LEVEL } from "../data/facilities.js";
import { renderDinoAvatar } from "./dinoVisual.js";
import { AREA_EXPEDITIONS } from "../data/expeditions.js";
import { updateIdleStage } from "./battleStage.js";

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

// ログの文言から色分け用のCSSクラスを自動判定する関数
function getLogClass(text) {
  if (text.startsWith("===")) return "log-divider";
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
function renderActiveDino(game) {
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

  el.innerHTML = `
    <div class="partner-header">
      <div>
        <span class="badge-gen">F${activeDino.generation ?? 0}</span>
        ${bloodlineBonus > 0 ? `<span class="badge-bloodline">📈上限+${bloodlineBonus}</span>` : ""}
        <span class="badge-rarity">${getRarityLabel(activeDino.rarityType)}</span>
        <span class="badge-trait" title="${trait.desc}">${trait.icon} ${trait.name}</span>
        ${activeDino.mutant ? `<span class="badge-mutant">🧬 MUTANT</span>` : ""}
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
  `;
}

// 3-B. 探索エリア選択＆出発ボタン描画（右カード上部）
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

  el.innerHTML = `
    <div class="explore-box">
      <label for="areaSelect">🗺️ 探索先エリア</label>
      <select id="areaSelect" ${isAuto ? "disabled" : ""}>${areaOptions}</select>
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

  // 1. 名前・種族・性別で絞り込み
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

  if (list.length === 0) {
    el.innerHTML = "<p>条件に一致する恐竜がいません。</p>";
    return;
  }

  const busyIds = new Set();
  (game.expeditions ?? []).forEach(exp => {
    exp.memberIds.forEach(id => busyIds.add(id));
  });

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
    const bloodlineBonus = getBloodlineBonus(dino);
    const trait = getTraitData(dino.trait);

    const card = document.createElement("div");
    card.className = "dino-card";

    if (isActive) card.classList.add("is-active");
    if (isOnExpedition) card.classList.add("is-expedition");
    if (isSelected) card.classList.add("is-selected");
    if (dino.locked) card.classList.add("is-locked");
    if (dino.color && dino.color !== "normal") card.classList.add(`color-${dino.color}`);
    if (dino.mutant) card.classList.add("is-mutant");

    card.innerHTML = `
      <!-- 上部バッジ＆レベル -->
      <div class="card-top-row">
        <div class="card-badges">
          <span class="badge-gen">F${dino.generation ?? 0}</span>
          ${bloodlineBonus > 0 ? `<span class="badge-bloodline">📈上限+${bloodlineBonus}</span>` : ""}
          <span class="badge-rarity">${getRarityLabel(dino.rarityType)}</span>
          <span class="badge-trait" title="${trait.desc}">${trait.icon} ${trait.name}</span>
          ${dino.mutant ? `<span class="badge-mutant">🧬MUTANT</span>` : ""}
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
      <div class="card-stat-grid">
        <div class="stat-box">
          <div class="stat-label">⚔️ 攻撃</div>
          <div class="stat-val">${Math.floor(stats.atk)}</div>
          <div class="stat-iv ${dino.atkIv >= 100 ? "iv-high" : ""}">IV: ${dino.atkIv}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">❤️ HP</div>
          <div class="stat-val">${Math.floor(stats.hp)}</div>
          <div class="stat-iv ${dino.hpIv >= 100 ? "iv-high" : ""}">IV: ${dino.hpIv}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">💨 素早さ</div>
          <div class="stat-val">${Math.floor(stats.spd)}</div>
          <div class="stat-iv ${dino.spdIv >= 100 ? "iv-high" : ""}">IV: ${dino.spdIv}</div>
        </div>
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

      <!-- メイン設定＆交配選択ボタン -->
      <div class="card-action-row">
        <button class="set-active-btn" data-id="${dino.uid}" ${isActive || isOnExpedition ? "disabled" : ""}>
          ${isActive ? "⭐ 育成中" : isOnExpedition ? "🏕️ 遠征中" : "メインに設定"}
        </button>
        <button class="breed-select-btn ${isSelected ? "is-picked" : ""}" data-id="${dino.uid}" ${isOnExpedition ? "disabled" : ""}>
          ${isOnExpedition ? "選択不可" : isSelected ? "✅ 選択中" : "交配に選ぶ"}
        </button>
      </div>

      <!-- 最下段（どのカードも同じ高さになるよう統一） -->
      ${isActive
        ? `<div class="active-protect-label">⭐ 現在の育成パートナー</div>`
        : isOnExpedition
          ? `<div class="expedition-protect-label">🏕️ 遠征隊として派遣中${dino.locked ? " (🔒)" : ""}</div>`
          : dino.locked
            ? `<div class="locked-label">🔒 保護ロック中</div>`
            : `<button class="release-btn" data-id="${dino.uid}">👋 お別れする</button>`
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
}

// 5. 交配卵リスト
function renderBreedingEggs(game, handlers) {
  const el = document.getElementById("eggList");
  if (!el) return;
  el.innerHTML = "";

  if (game.breedingEggs.length === 0) {
    el.innerHTML = "<p class='empty-msg'>現在、孵化待ちの交配卵はありません。</p>";
    return;
  }

  game.breedingEggs.forEach(egg => {
    const remain = Math.max(0, Math.ceil((egg.hatchAt - Date.now()) / 1000));
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
function renderDex(game) {
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

  DEX_SPECIES.forEach((species, index) => {
    const div = document.createElement("div");
    const found = game.discoveredSpecies.includes(species.id);
    const no = String(index + 1).padStart(2, "0");

    if (found) {
      const detail = getSpeciesDetail(species.id);
      div.className = `dex-card is-found ${species.special ? "is-special" : ""}`;

      div.innerHTML = `
        <div class="dex-card-top">
          <span class="dex-no">No.${no}</span>
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
function renderRecords(game) {
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
    { icon: "🪦", label: "探索ロスト数", value: `${s.dinosLost ?? 0} 体` }
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
  if (achievementCount) {
    achievementCount.textContent = `達成状況: ${unlockedCount} / ${totalCount} 達成`;
  }

  achievementList.innerHTML = ACHIEVEMENTS.map(ach => {
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
        <span>F${dino.generation ?? 0}</span>
        ${bloodlineBonus > 0 ? `<span class="badge-bloodline">📈上限+${bloodlineBonus}</span>` : ""}
        <span>${getRarityLabel(dino.rarityType)}</span>
        <span class="badge-trait" title="${trait.desc}">${trait.icon} ${trait.name}</span>
        <span>${getColorLabel(dino.color)}</span>
        ${dino.mutant ? `<span class="badge-mutant">🧬MUTANT</span>` : ""}
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
        ? `🥚 生命の結晶を ${requiredCrystals}個 使って交配する`
        : `💎 生命の結晶が不足しています（必要: ${requiredCrystals}個）`;
  }

  // 特殊交配レシピに一致するかのプレビュー判定
  let previewHtml = "";
  if (male && female) {
    const lvInfo = getChildMaxLevelInfo(male, female);

    const ids = [male.speciesId, female.speciesId].sort();
    const special = SPECIAL_BREEDS.find(b => {
      const pIds = [...b.parents].sort();
      return pIds === ids && pIds === ids;
    });

    const isCapped = (lvInfo.inheritedBonus + lvInfo.trainBonus) > lvInfo.maxAllowedBonus;

    previewHtml = `
      <div class="breed-preview">
        ${special
          ? `✨ <strong>特殊交配レシピ成立！</strong>「${special.result.name}（F${lvInfo.nextGen}）」`
          : `🥚 誕生予定：<strong>${male.name}（F${lvInfo.nextGen}）</strong>`
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
      💎 生命の結晶：所持 <strong>${crystals}</strong> 個（今回の交配に <strong>${requiredCrystals}</strong> 個消費）
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
}

// 9. 遠征タブ全体の描画
function renderExpeditionTab(game, handlers) {
  const activeEl = document.getElementById("activeExpeditions");
  const builderEl = document.getElementById("expeditionBuilder");
  const gridEl = document.getElementById("expeditionDinoGrid");
  if (!activeEl || !builderEl || !gridEl) return;

  const unlockedLevels = [1, 2, 3, 4, 5].filter(lv => (game.areaProgress?.[lv] ?? 0) >= 100);
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
            const course = AREA_EXPEDITIONS.find(c => c.areaLevel === exp.areaLevel) ?? AREA_EXPEDITIONS;
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

  // 2. 新規チーム編成パネル
  const busyIds = new Set();
  activeExps.forEach(e => e.memberIds.forEach(id => busyIds.add(id)));

  const draft = game.expeditionDraft ?? { areaLevel: unlockedLevels, memberIds: [] };
  const selectedLevel = unlockedLevels.includes(draft.areaLevel) ? draft.areaLevel : unlockedLevels;
  const validDraftMembers = draft.memberIds.filter(
    id => id !== game.activeDinoId && !busyIds.has(id) && game.dinos.some(d => d.uid === id)
  );

  const luckyCount = validDraftMembers.filter(id => {
    const d = game.dinos.find(dino => dino.uid === id);
    return d?.trait === "hunter";
  }).length;
  const luckPercent = luckyCount * 10;
  const canLaunch = activeExps.length < maxTeams && validDraftMembers.length > 0;

  // 現在選択されているコースの情報を取得
  const selectedCourse = AREA_EXPEDITIONS.find(item => item.areaLevel === selectedLevel) ?? AREA_EXPEDITIONS[0];

  // リストボックス内は短い表記にして横はみ出しを防ぐ
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
        <button id="startExpBtn" class="btn-exp-start" ${!canLaunch ? "disabled" : ""}>
          ${activeExps.length >= maxTeams ? "部隊枠がいっぱいです" : "🚩 このチームで遠征に出発"}
        </button>
      </div>
      <!-- 👇 選択した遠征先の報酬内容をスマホでも見やすく折り返し表示 -->
      <div class="exp-reward-preview">
        🎁 <strong>主な獲得報酬：</strong>${selectedCourse.rewardDesc}
      </div>
    </div>
  `;

  document.getElementById("expAreaSelect").onchange = (e) => {
    handlers.onSelectExpArea(Number(e.target.value));
  };
  document.getElementById("startExpBtn").onclick = handlers.onStartExpedition;

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
          <span class="badge-gen">F${dino.generation ?? 0}</span>
          <span class="badge-rarity">${getRarityLabel(dino.rarityType)}</span>
          <span class="badge-trait ${isLucky ? "is-lucky-highlight" : ""}" title="${trait.desc}">
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

// 全体描画のエントリーポイント
export function renderGame(game, state, handlers) {
  renderStarterEgg(game, handlers);
  renderStatusAndLogs(game, state.selectedMale, state.selectedFemale);
  renderActiveDino(game);
  renderExploreBox(game, state, handlers);
  renderDinoList(game, state, handlers);
  renderBreedingEggs(game, handlers);
  renderWildEggs(game, handlers);
  renderDex(game);
  updateBreedBadge(game);
  renderBreedingStage(game, state.selectedMale, state.selectedFemale);
  renderRecords(game);
  renderTreasures(game);
  renderFacility(game, handlers);
  renderExpeditionTab(game, handlers);
  updateExpBadge(game);

  // エサやりボタンの共通登録（育成中エリア＋一覧の両方に対応）
  document.querySelectorAll(".feed-btn").forEach(btn => {
    btn.onclick = () => handlers.onFeed(btn.dataset.id, btn.dataset.type);
  });
}
