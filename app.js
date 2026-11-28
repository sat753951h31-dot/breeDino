import { loadGame, saveGame } from "./systems/save.js";
import { calculateStats, syncTreasures, syncFacilities, getTreasureBonuses } from "./systems/stats.js";
import { addExp } from "./systems/level.js";
import { rollStarterEgg, hatchStarterEgg } from "./systems/starterEgg.js";
import { renderGame, renderTick } from "./ui/render.js";
import { getSizeLabel } from "./ui/labels.js";
import { DINO_SPECIES } from "./data/dinos.js";
import { SPECIAL_BREEDS } from "./data/specialBreeding.js";
import { ACHIEVEMENTS } from "./data/achievements.js";
import { AREA_EXPEDITIONS } from "./data/expeditions.js";
import { getFacilityBonuses } from "./data/facilities.js";
import { initModals } from "./ui/modals.js";

import { createExploreActions } from "./actions/exploreActions.js";
import { createDinoActions } from "./actions/dinoActions.js";
import { createBreedActions } from "./actions/breedActions.js";
import { createExpeditionActions } from "./actions/expeditionActions.js";
import { createFacilityActions } from "./actions/facilityActions.js";

// =========================================
// 1. ゲームデータの読み込み ＆ 初期整合性チェック
// =========================================
let game = loadGame();
syncTreasures(game.treasures);
syncFacilities(game.facility);
processOfflineProgress();

if (!game.starterEgg) {
  game.starterEgg = rollStarterEgg();
}

if (!Array.isArray(game.expeditions)) game.expeditions = [];
game.expeditions = game.expeditions.filter(e => e && Number.isFinite(e.endAt));
if (!game.expeditionDraft || typeof game.expeditionDraft.areaLevel !== "number") {
  game.expeditionDraft = { areaLevel: 1, memberIds: [] };
}

game.dinos.forEach(dino => {
  const stats = calculateStats(dino);
  if (dino.currentHp == null || Number.isNaN(dino.currentHp)) {
    dino.currentHp = stats.hp;
  }
});

// =========================================
// 2. UI状態変数
// =========================================
let selectedMale = null;
let selectedFemale = null;
let filterName = "";
let filterSpecies = "all";
let filterSex = "all";
let filterType = "all";
let filterRarity = "all";
let filterGen = "all";
let filterLock = "all";
let filterAchievement = "all";
let filterDex = "all";
let filterDexType = "all";
let sortBy = "default";

let lastActionTime = 0;
let tickCounter = 0;
let isAutoExploring = false;
let lastGachaResults = [];
let isRainbowSelectMode = false;
let selectedRainbowIds = new Set();

// =========================================
// 3. 共通ヘルパー関数
// =========================================
function canAct(cooldownMs = 250) {
  const now = Date.now();
  if (now - lastActionTime < cooldownMs) return false;
  lastActionTime = now;
  return true;
}

function addLog(text) {
  game.huntLogs.unshift(text);
  game.huntLogs = game.huntLogs.slice(0, 100);
}

function discoverSpecies(dino) {
  if (!game.discoveredSpecies.includes(dino.speciesId)) {
    game.discoveredSpecies.push(dino.speciesId);
  }
}

function currentHatchMult() {
  return getFacilityBonuses(game.facility).hatchTimeMult;
}

function getUnlockedExpeditionLevels() {
  const allLevels = AREA_EXPEDITIONS.map(e => e.areaLevel);
  if ((game.worldLoop ?? 1) > 1) return allLevels;
  return allLevels.filter(lv => (game.areaProgress?.[lv] ?? 0) >= 100);
}

function getDefaultSpeciesName(speciesId) {
  const normal = DINO_SPECIES.find(d => d.id === speciesId);
  if (normal) return normal.name;

  const special = SPECIAL_BREEDS.find(b => b.result.id === speciesId);
  return special ? special.result.name : speciesId;
}

function rescueIfSoftlocked() {
  const noDinos = (game.dinos?.length ?? 0) === 0;
  const noWildEggs = (game.wildEggs?.length ?? 0) === 0;
  const noBreedingEggs = (game.breedingEggs?.length ?? 0) === 0;

  if (noDinos && noWildEggs && noBreedingEggs) {
    if (game.starterSelected || !game.starterEgg) {
      game.starterEgg = rollStarterEgg();
      game.starterSelected = false;
      addLog(`🥚 手持ちの恐竜と卵がすべてなくなったため、新しい「スターター卵」が支給されました！`);
    }

    const exploreTabBtn = document.querySelector('.tab-btn[data-tab="tab-explore"]');
    if (exploreTabBtn && !exploreTabBtn.classList.contains("active")) {
      exploreTabBtn.click();
    }
  }
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}時間${minutes}分`;
  if (minutes > 0) return `${minutes}分${seconds}秒`;
  return `${seconds}秒`;
}

function processOfflineProgress() {
  const now = Date.now();
  const lastSaved = game.lastSavedAt ?? now;
  const rawElapsedSec = Math.floor((now - lastSaved) / 1000);
  if (rawElapsedSec < 30) return;

  const effectiveSec = Math.min(rawElapsedSec, 86400);
  const tBonus = getTreasureBonuses();
  const fBonus = getFacilityBonuses(game.facility);
  const totalStandbyExp = tBonus.standbyExp + fBonus.standbyExp;
  const passiveExpGain = Math.floor(effectiveSec / 5) * totalStandbyExp;

  let healedCount = 0;
  let leveledUpCount = 0;

  game.dinos.forEach(dino => {
    const stats = calculateStats(dino);
    if (dino.currentHp == null || Number.isNaN(dino.currentHp)) {
      dino.currentHp = stats.hp;
    }
    if (dino.uid === game.activeDinoId) return;

    if (dino.currentHp < stats.hp) {
      const healPerSec = Math.max(1, stats.hp * 0.01);
      dino.currentHp = Math.min(stats.hp, dino.currentHp + healPerSec * effectiveSec);
      healedCount++;
    }

    if (passiveExpGain > 0) {
      const prevLv = dino.level;
      addExp(dino, passiveExpGain);
      if (dino.level > prevLv) leveledUpCount++;
    }
  });

  const readyBreeding = (game.breedingEggs ?? []).filter(e => e.hatchAt <= now).length;
  const readyWild = (game.wildEggs ?? []).filter(e => (e.hatchAt ?? 0) <= now).length;
  const totalReadyEggs = readyBreeding + readyWild;

  const timeText = formatDuration(effectiveSec);
  const summaryLines = [];
  if (healedCount > 0) summaryLines.push(`・待機恐竜 ${healedCount}体 のHPが回復`);
  if (passiveExpGain > 0) summaryLines.push(`・秘宝効果で待機恐竜全員が EXP +${passiveExpGain} 獲得（${leveledUpCount}体がレベルアップ！）`);
  if (totalReadyEggs > 0) summaryLines.push(`・🥚 ${totalReadyEggs}個 の卵が孵化可能になりました！`);

  addLog(`💤 【おかえりなさい！】${timeText} の放置進行が完了しました`);
  summaryLines.forEach(line => addLog(line));

  if (summaryLines.length > 0) {
    alert(`💤 おかえりなさい！（不在時間: ${timeText}）\n\n` + summaryLines.join("\n"));
  }
}

function checkAchievements() {
  let unlockedAny = false;

  ACHIEVEMENTS.forEach(ach => {
    if (game.unlockedAchievements.includes(ach.id)) return;

    const { current, max } = ach.getProgress(game);
    if (current >= max) {
      game.unlockedAchievements.push(ach.id);
      if (ach.reward) {
        const { type, amount } = ach.reward;
        if (type === "crystal") {
          game.items ??= {};
          game.items.breedCrystal = (game.items.breedCrystal ?? 0) + amount;
          game.stats.crystalsEarned = (game.stats.crystalsEarned ?? 0) + amount;
        } else if (type === "traitFruit") {
          game.items ??= {};
          game.items.traitFruit = (game.items.traitFruit ?? 0) + amount;
        } else if (type === "ivElixir") {
          game.items ??= {};
          game.items.ivElixir = (game.items.ivElixir ?? 0) + amount;
        } else if (type === "sizePotion") {
          game.items ??= {};
          game.items.sizePotion = (game.items.sizePotion ?? 0) + amount;
        } else {
          game.foods[type] = (game.foods[type] ?? 0) + amount;
        }
      }
      addLog(`🏆 【実績解除】「${ach.title}」を達成！報酬：${ach.rewardText}`);
      unlockedAny = true;
    }
  });

  return unlockedAny;
}

// =========================================
// 4. 分割した各機能アクションの初期化
// =========================================
let expeditionActions = null;

const ctx = {
  game,
  update,
  addLog,
  canAct,
  discoverSpecies,
  currentHatchMult,
  rescueIfSoftlocked,
  getUnlockedExpeditionLevels,
  getDefaultSpeciesName,
  getBusyExpeditionDinoIds: () => expeditionActions.getBusyExpeditionDinoIds(),

  // 状態アクセス用
  getSelectedMale: () => selectedMale,
  setSelectedMale: (val) => { selectedMale = val; },
  getSelectedFemale: () => selectedFemale,
  setSelectedFemale: (val) => { selectedFemale = val; },
  clearSelectedBreedParent: (uid) => {
    if (selectedMale === uid) selectedMale = null;
    if (selectedFemale === uid) selectedFemale = null;
  },
  getIsAutoExploring: () => isAutoExploring,
  setIsAutoExploring: (val) => { isAutoExploring = val; },
  getIsRainbowSelectMode: () => isRainbowSelectMode,
  setIsRainbowSelectMode: (val) => { isRainbowSelectMode = val; },
  selectedRainbowIds,
  setLastGachaResults: (val) => { lastGachaResults = val; }
};

expeditionActions = createExpeditionActions(ctx);
const exploreActions = createExploreActions(ctx);
const dinoActions = createDinoActions(ctx);
const breedActions = createBreedActions(ctx);
const facilityActions = createFacilityActions(ctx);

// =========================================
// 5. UI描画用ハンドラー束ね
// =========================================
const handlers = {
  // 探索・ボス・周回
  onExplore: exploreActions.handleExplore,
  onToggleAutoExplore: exploreActions.handleToggleAutoExplore,
  onBossBattle: exploreActions.handleBossBattle,
  onAdvanceWorldLoop: exploreActions.handleAdvanceWorldLoop,
  onSelectArea: (level) => {
    game.selectedAreaLevel = level;
    update();
  },

  // 恐竜育成・整理・還元・貴重品・努力値
  onFeed: dinoActions.handleFeed,
  onRelease: dinoActions.handleRelease,
  onRename: dinoActions.handleRename,
  onToggleLock: dinoActions.handleToggleLock,
  onToggleRainbowMode: dinoActions.handleToggleRainbowMode,
  onToggleRainbowPick: dinoActions.handleToggleRainbowPick,
  onExecuteRainbowConvert: dinoActions.handleExecuteRainbowConvert,
  onSelectAllFilteredRainbows: dinoActions.handleSelectAllFilteredRainbows,
  onClearRainbowPicks: dinoActions.handleClearRainbowPicks,
  onAdjustEv: dinoActions.handleAdjustEv,
  onResetEv: dinoActions.handleResetEv,
  onShowPedigree: dinoActions.handleShowPedigree,
  onUseTraitFruit: (dinoId) => dinoActions.handleUseTraitFruit(typeof dinoId === "string" ? dinoId : game.activeDinoId),
  onUseIvElixir: (dinoId) => dinoActions.handleUseIvElixir(typeof dinoId === "string" ? dinoId : game.activeDinoId),
  onUseSizePotion: (dinoId) => dinoActions.handleUseSizePotion(typeof dinoId === "string" ? dinoId : game.activeDinoId),
  onSetActive: (dinoId) => {
    if (expeditionActions.getBusyExpeditionDinoIds().has(dinoId)) {
      alert("🏕️ 遠征中の恐竜は育成パートナーに設定できません！帰還を待ってください。");
      return;
    }
    if (game.expeditionDraft?.memberIds) {
      game.expeditionDraft.memberIds = game.expeditionDraft.memberIds.filter(id => id !== dinoId);
    }
    game.activeDinoId = dinoId;
    isAutoExploring = false;
    update();
  },

  // 交配・孵化・スターター卵
  onSelectBreed: (dinoId) => {
    if (expeditionActions.getBusyExpeditionDinoIds().has(dinoId)) return;
    const dino = game.dinos.find(d => d.uid === dinoId);
    if (!dino) return;

    if (dino.sex === "male") {
      selectedMale = selectedMale === dinoId ? null : dinoId;
    } else if (dino.sex === "female") {
      selectedFemale = selectedFemale === dinoId ? null : dinoId;
    }
    update();
  },
  onHatchBreedingEgg: breedActions.handleHatchBreedingEgg,
  onHatchWildEgg: breedActions.handleHatchWildEgg,
  onHatchAllBreedingEggs: breedActions.handleHatchAllBreedingEggs,
  onHatchAllWildEggs: breedActions.handleHatchAllWildEggs,
  onRerollStarter: () => {
    if (game.starterEgg?.rarity === "rainbow") {
      const sizeText = getSizeLabel(game.starterEgg.size);
      const ok = confirm(
        `⚠️ 【確認】最高レアの「🌈 虹の卵（${sizeText}）」が出現しています！\n` +
        `本当に選び直して別の卵にしますか？`
      );
      if (!ok) return;
    }

    game.starterEgg = rollStarterEgg();
    update();
  },
  onSelectStarter: () => {
    const starterDino = hatchStarterEgg(game.starterEgg);
    game.dinos.push(starterDino);
    if (!game.activeDinoId) game.activeDinoId = starterDino.uid;
    discoverSpecies(starterDino);
    game.starterSelected = true;
    game.stats.eggsHatched++;
    update();
  },

  // 遠征
  onToggleExpDraftMember: expeditionActions.handleToggleExpDraftMember,
  onSelectExpArea: expeditionActions.handleSelectExpArea,
  onAutoSelectExpMembers: expeditionActions.handleAutoSelectExpMembers,
  onStartExpedition: expeditionActions.handleStartExpedition,
  onClaimExpedition: expeditionActions.handleClaimExpedition,
  onClaimAllExpeditions: () => expeditionActions.handleClaimAllExpeditions(false),
  onClaimAndRedeployAll: () => expeditionActions.handleClaimAllExpeditions(true),

  // 設備・工房・ガチャ
  onUpgradeFacility: facilityActions.handleUpgradeFacility,
  onUpgradeMonument: facilityActions.handleUpgradeMonument,
  onCraftItem: facilityActions.handleCraftItem,
  onRollGacha: (times, isPremium = false) => facilityActions.handleRollGacha(times, isPremium)
};

// =========================================
// 6. 画面描画 ＆ セーブ統合関数
// =========================================
function update() {
  rescueIfSoftlocked();
  syncTreasures(game.treasures);
  syncFacilities(game.facility);
  checkAchievements();
  renderGame(
    game,
    {
      selectedMale,
      selectedFemale,
      filterName,
      filterSpecies,
      filterSex,
      filterType,
      filterRarity,
      filterGen,
      filterLock,
      filterAchievement,
      filterDex,
      filterDexType,
      sortBy,
      isAutoExploring,
      lastGachaResults,
      gachaMaxGen: facilityActions.getGachaMaxGeneration(),
      premiumGachaRange: facilityActions.getPremiumGachaGenRange(),
      isRainbowSelectMode,
      selectedRainbowIds,
      getRainbowCrystalReturn: dinoActions.getRainbowCrystalReturn
    },
    handlers
  );
  saveGame(game);
}

// =========================================
// 7. 固定UIイベント登録 ＆ 1秒タイマー
// =========================================
document.getElementById("breedBtn")?.addEventListener("click", () => breedActions.executeBreed(1));
document.getElementById("breed10Btn")?.addEventListener("click", () => breedActions.executeBreed(10));
document.getElementById("bulkReleaseBtn")?.addEventListener("click", dinoActions.handleBulkRelease);

// 📱 スマホボタン連打時のダブルタップズーム防止
let lastBtnTapTime = 0;
document.addEventListener("touchend", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const now = Date.now();
  if (now - lastBtnTapTime < 350) {
    e.preventDefault();
    if (!btn.disabled) btn.click();
  }
  lastBtnTapTime = now;
}, { passive: false });

// タブ切り替え
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));

    btn.classList.add("active");
    const targetPanel = document.getElementById(btn.dataset.tab);
    if (targetPanel) targetPanel.classList.add("active");
  });
});

// 各種フィルター・ソート
const bindSelect = (id, setter) => {
  document.getElementById(id)?.addEventListener("change", (e) => {
    setter(e.target.value);
    update();
  });
};

bindSelect("filterType", v => { filterType = v; });
bindSelect("filterSpecies", v => { filterSpecies = v; });
bindSelect("filterSex", v => { filterSex = v; });
bindSelect("filterRarity", v => { filterRarity = v; });
bindSelect("filterGen", v => { filterGen = v; });
bindSelect("filterLock", v => { filterLock = v; });
bindSelect("filterAchievement", v => { filterAchievement = v; });
bindSelect("filterDex", v => { filterDex = v; });
bindSelect("filterDexType", v => { filterDexType = v; });
bindSelect("sortBy", v => { sortBy = v; });

document.getElementById("filterName")?.addEventListener("input", (e) => {
  filterName = e.target.value;
  update();
});

document.getElementById("resetFilterBtn")?.addEventListener("click", () => {
  filterName = "";
  filterSpecies = "all";
  filterSex = "all";
  filterType = "all";
  filterRarity = "all";
  filterGen = "all";
  filterLock = "all";
  sortBy = "default";

  const resetMap = {
    filterName: "",
    filterSpecies: "all",
    filterSex: "all",
    filterType: "all",
    filterRarity: "all",
    filterGen: "all",
    filterLock: "all",
    sortBy: "default"
  };
  Object.entries(resetMap).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });

  update();
});

document.getElementById("clearLogBtn")?.addEventListener("click", () => {
  if (game.huntLogs.length === 0) return;
  game.huntLogs = [];
  update();
});

document.getElementById("resetSave")?.addEventListener("click", () => {
  localStorage.clear();
  location.reload();
});

// バッジタップ時の詳細ポップアップ
document.addEventListener("click", (e) => {
  const traitBadge = e.target.closest(".badge-trait[data-trait-desc]");
  if (traitBadge) {
    e.stopPropagation();
    alert(`【特性】${traitBadge.dataset.traitName}\n\n効果：${traitBadge.dataset.traitDesc}`);
    return;
  }

  const infoBadge = e.target.closest("[data-badge-desc]");
  if (infoBadge) {
    e.stopPropagation();
    alert(`${infoBadge.dataset.badgeTitle}\n━━━━━━━━━━━━━━━━━━━━\n${infoBadge.dataset.badgeDesc}`);
  }
});

// 1秒ごとのHP自動回復とタイマー更新
setInterval(() => {
  tickCounter++;
  const tBonus = getTreasureBonuses();
  const fBonus = getFacilityBonuses(game.facility);
  const totalStandbyExp = tBonus.standbyExp + fBonus.standbyExp;
  const givePassiveExp = (tickCounter % 5 === 0) && (totalStandbyExp > 0);

  game.dinos.forEach(dino => {
    if (dino.uid === game.activeDinoId) return;
    const stats = calculateStats(dino);
    const healPerSec = Math.max(1, stats.hp * 0.01);
    dino.currentHp = Math.min(stats.hp, dino.currentHp + healPerSec);

    if (givePassiveExp) addExp(dino, totalStandbyExp);
  });
  renderTick(game, handlers);
  saveGame(game);
}, 1000);

// モーダル初期化 ＆ 初回描画
initModals({
  game,
  saveGame,
  getDefaultSpeciesName,
  findBestParentsForSpecies: breedActions.findBestParentsForSpecies,
  onApplyReverseParents: breedActions.selectBestParentsForSpecies
});

update();

