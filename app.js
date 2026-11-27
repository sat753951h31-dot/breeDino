import { loadGame, saveGame } from "./systems/save.js";
import { calculateStats, syncTreasures, syncFacilities, getTreasureBonuses } from "./systems/stats.js";
import { addExp } from "./systems/level.js";
import { breed, createBreedingEgg, getRequiredCrystals } from "./systems/breeding.js";
import { rollStarterEgg, hatchStarterEgg, createWildEgg } from "./systems/starterEgg.js";
import { AREAS } from "./data/areas.js";
import { getEnemyForArea, battle } from "./systems/battle.js";
import { renderGame, renderTick } from "./ui/render.js";
import { DINO_SPECIES } from "./data/dinos.js";
import { SPECIAL_BREEDS } from "./data/specialBreeding.js";
import { ACHIEVEMENTS } from "./data/achievements.js";
import { getEggRarityLabel, getSizeLabel, getRarityLabel, getColorLabel } from "./ui/labels.js";
import { TREASURES, MAX_TREASURE_LEVEL, getTreasureDesc } from "./data/treasures.js";
import * as traitModule from "./data/traits.js";
const { getTraitData } = traitModule;
import { AREA_BOSSES } from "./data/bosses.js";
import { AREA_EXPEDITIONS } from "./data/expeditions.js";
import { playExploreSequence } from "./ui/battleStage.js";
import { FACILITIES, MAX_FACILITY_LEVEL, getFacilityBonuses, CRAFT_RECIPES, getMonumentUpgradeCost } from "./data/facilities.js";

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

let selectedMale = null;
let selectedFemale = null;
let filterName = "";
let filterSpecies = "all";
let filterSex = "all";
let filterType = "all";
let filterRarity = "all";
let filterGen = "all";
let filterLock = "all";
let sortBy = "default";
let lastActionTime = 0;
let tickCounter = 0;
let isAutoExploring = false;
let lastGachaResults = [];
let isRainbowSelectMode = false;
let selectedRainbowIds = new Set();
let filterAchievement = "all";
let filterDex = "all";
let filterDexType = "all";

function discoverSpecies(dino) {
  if (!game.discoveredSpecies.includes(dino.speciesId)) {
    game.discoveredSpecies.push(dino.speciesId);
  }
}

function addLog(text) {
  game.huntLogs.unshift(text);
  game.huntLogs = game.huntLogs.slice(0, 100);
}

// 1回・10回交配の共通実行処理
function executeBreed(times = 1) {
  if (!canAct()) return;

  if (!selectedMale || !selectedFemale) {
    alert("オスとメスを選択してください");
    return;
  }

  const parentA = game.dinos.find(d => d.uid === selectedMale);
  const parentB = game.dinos.find(d => d.uid === selectedFemale);
  if (!parentA || !parentB) return;

  const requiredPerOne = getRequiredCrystals(parentA, parentB);
  const totalRequired = requiredPerOne * times;

  if ((game.items?.breedCrystal ?? 0) < totalRequired) {
    alert(`💎「生命の結晶」が足りません！（必要数: ${totalRequired}個）\n探索や遠征で結晶を集めてください。`);
    return;
  }

  // 必要数ぶん消費
  game.items.breedCrystal -= totalRequired;
  game.breedingEggs ??= [];

  const hatchMult = currentHatchMult();
  const rarityCounts = { white: 0, blue: 0, purple: 0, rainbow: 0 };
  let specialCount = 0;
  let mutantCount = 0;
  let lastChildName = "";

  for (let i = 0; i < times; i++) {
    const child = breed(parentA, parentB);
    const egg = createBreedingEgg(child, hatchMult);
    game.breedingEggs.push(egg);
    game.stats.breedsDone++;

    lastChildName = child.name;
    rarityCounts[child.rarityType] = (rarityCounts[child.rarityType] ?? 0) + 1;
    if (child.mutant) mutantCount++;
    if (SPECIAL_BREEDS.some(b => b.result.id === child.speciesId)) {
      specialCount++;
    }
  }

  selectedMale = null;
  selectedFemale = null;

  if (times === 1) {
    if (specialCount > 0) {
      alert(`✨ 特殊交配成功！\n「${lastChildName}」が誕生予定です！`);
      addLog(`✨ 特殊交配成功！「${lastChildName}」の卵を獲得した！`);
    } else {
      alert("交配卵ができました！");
    }
  } else {
    // 10回交配の結果サマリーを作成
    const summaryParts = [];
    if (rarityCounts.rainbow > 0) summaryParts.push(`🌈 虹卵×${rarityCounts.rainbow}`);
    if (rarityCounts.purple > 0) summaryParts.push(`🟣 紫卵×${rarityCounts.purple}`);
    if (rarityCounts.blue > 0) summaryParts.push(`🔵 青卵×${rarityCounts.blue}`);
    if (rarityCounts.white > 0) summaryParts.push(`⚪ 白卵×${rarityCounts.white}`);

    const bonusLines = [];
    if (specialCount > 0) bonusLines.push(`✨ 特殊交配成立：${specialCount}個`);
    if (mutantCount > 0) bonusLines.push(`🧬 突然変異（MUTANT）確定：${mutantCount}個`);
    const bonusText = bonusLines.length > 0 ? `\n\n${bonusLines.join("\n")}` : "";

    addLog(`🥚 【${times}回連続交配】${summaryParts.join("・")} の交配卵を作成した！`);
    alert(`🥚 ${times}回連続交配が完了しました！\n\n内訳：${summaryParts.join(" / ")}${bonusText}`);
  }

  update();
}

// 手持ちの恐竜も卵も0になった場合の救済措置（スターター卵の再選択を有効化）
function rescueIfSoftlocked() {
  const noDinos = (game.dinos?.length ?? 0) === 0;
  const noWildEggs = (game.wildEggs?.length ?? 0) === 0;
  const noBreedingEggs = (game.breedingEggs?.length ?? 0) === 0;

  if (noDinos && noWildEggs && noBreedingEggs && game.starterSelected) {
    game.starterEgg = rollStarterEgg();
    game.starterSelected = false;
    addLog(`🥚 手持ちの恐竜と卵がすべてなくなったため、新しい「スターター卵」が支給されました！`);
  }
}

function getUnlockedExpeditionLevels() {
  const allLevels = AREA_EXPEDITIONS.map(e => e.areaLevel);
  if ((game.worldLoop ?? 1) > 1) return allLevels;
  return allLevels.filter(lv => (game.areaProgress?.[lv] ?? 0) >= 100);
}

// 現在の孵化時間倍率を取得するヘルパー
function currentHatchMult() {
  return getFacilityBonuses(game.facility).hatchTimeMult;
}

// 拠点（孵化設備）のアップグレード処理
function handleUpgradeIncubator() {
  if (!canAct()) return;

  game.facility ??= { incubatorLevel: 0 };
  const currentLv = game.facility.incubatorLevel;
  if (currentLv >= MAX_INCUBATOR_LEVEL) return;

  const nextPlan = INCUBATOR_LEVELS.find(item => item.level === currentLv + 1);
  if (!nextPlan) return;

  // お肉の所持数チェック
  for (const [type, needed] of Object.entries(nextPlan.cost)) {
    if ((game.foods[type] ?? 0) < needed) {
      alert(`お肉が足りません！\n必要素材：${nextPlan.costText}`);
      return;
    }
  }

  // 素材のお肉を消費してレベルアップ
  for (const [type, needed] of Object.entries(nextPlan.cost)) {
    game.foods[type] -= needed;
  }
  game.facility.incubatorLevel = nextPlan.level;

  const percent = Math.round(nextPlan.reduction * 100);
  addLog(`⛺ 【拠点強化】孵化設備が Lv.${nextPlan.level} になった！（孵化時間 ${percent}% 短縮）`);
  update();
}

// 秒数を「〇時間〇分」の読みやすい文字に変換するヘルパー
function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}時間${minutes}分`;
  if (minutes > 0) return `${minutes}分${seconds}秒`;
  return `${seconds}秒`;
}

// 放置（オフライン）進行の計算処理
function processOfflineProgress() {
  const now = Date.now();
  const lastSaved = game.lastSavedAt ?? now;
  const rawElapsedSec = Math.floor((now - lastSaved) / 1000);

  // 30秒未満の短い再読み込み時はスキップ
  if (rawElapsedSec < 30) return;

  // 放置時間の上限は24時間（86,400秒）に設定
  const MAX_OFFLINE_SEC = 86400;
  const effectiveSec = Math.min(rawElapsedSec, MAX_OFFLINE_SEC);

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

    // 育成中の恐竜は対象外（待機メンバーのみ進行）
    if (dino.uid === game.activeDinoId) return;

    // 1. HP自動回復（毎秒 最大HPの1%、最低1回復 × 経過秒数）
    if (dino.currentHp < stats.hp) {
      const healPerSec = Math.max(1, stats.hp * 0.01);
      dino.currentHp = Math.min(stats.hp, dino.currentHp + healPerSec * effectiveSec);
      healedCount++;
    }

    // 2. 秘宝による待機EXP付与
    if (passiveExpGain > 0) {
      const prevLv = dino.level;
      addExp(dino, passiveExpGain);
      if (dino.level > prevLv) {
        leveledUpCount++;
      }
    }
  });

  // 3. 孵化可能になった卵の数をチェック
  const readyBreeding = (game.breedingEggs ?? []).filter(e => e.hatchAt <= now).length;
  const readyWild = (game.wildEggs ?? []).filter(e => (e.hatchAt ?? 0) <= now).length;
  const totalReadyEggs = readyBreeding + readyWild;

  // ログとアラートで報告
  const timeText = formatDuration(effectiveSec);
  const summaryLines = [];

  if (healedCount > 0) {
    summaryLines.push(`・待機恐竜 ${healedCount}体 のHPが回復`);
  }
  if (passiveExpGain > 0) {
    summaryLines.push(`・秘宝効果で待機恐竜全員が EXP +${passiveExpGain} 獲得（${leveledUpCount}体がレベルアップ！）`);
  }
  if (totalReadyEggs > 0) {
    summaryLines.push(`・🥚 ${totalReadyEggs}個 の卵が孵化可能になりました！`);
  }

  addLog(`💤 【おかえりなさい！】${timeText} の放置進行が完了しました`);
  summaryLines.forEach(line => addLog(line));

  if (summaryLines.length > 0) {
    alert(`💤 おかえりなさい！（不在時間: ${timeText}）\n\n` + summaryLines.join("\n"));
  }
}

// 実績の達成チェック＆報酬付与
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
          // raw / good / premium（お肉系）
          game.foods[type] = (game.foods[type] ?? 0) + amount;
        }
      }
      addLog(`🏆 【実績解除】「${ach.title}」を達成！報酬：${ach.rewardText}`);
      unlockedAny = true;
    }
  });

  return unlockedAny;
}

// --- アクション処理（ボタンから呼ばれる機能） ---

function canAct(cooldownMs = 250) {
  const now = Date.now();
  if (now - lastActionTime < cooldownMs) {
    return false;
  }
  lastActionTime = now;
  return true;
}

// レア度とレベルに応じたお別れ報酬を計算
function getReleaseReward(dino) {
  const levelBonus = Math.floor(dino.level / 5);

  switch (dino.rarityType) {
    case "rainbow":
      return { type: "premium", label: "✨ 極上肉", amount: 3 + levelBonus };
    case "purple":
      return { type: "premium", label: "✨ 極上肉", amount: 1 + levelBonus };
    case "blue":
      return { type: "good", label: "🥩 上質肉", amount: 2 + levelBonus };
    default:
      return { type: "raw", label: "🍖 生肉", amount: 2 + levelBonus };
  }
}

function handleRelease(dinoId) {
  if (game.dinos.length <= 1) {
    alert("最後の1体は逃がせません！");
    return;
  }

  if (dinoId === game.activeDinoId) {
    alert("育成中の恐竜は逃がせません！先に別の恐竜をメインに設定してください。");
    return;
  }

  const index = game.dinos.findIndex(d => d.uid === dinoId);
  if (index === -1) return;

  const dino = game.dinos[index]; // 👈 必ずチェックより先に定義する

  if (dino.locked) {
    alert(`🔒「${dino.name}」は保護ロック中のためお別れできません！\n先に🔒ボタンを押してロックを解除してください。`);
    return;
  }

  if (getBusyExpeditionDinoIds().has(dino.uid)) {
    alert("🏕️ 遠征中の恐竜とはお別れできません！");
    return;
  }

  if (game.expedition?.active && game.expedition.memberIds.includes(dino.uid)) return false;

  const reward = getReleaseReward(dino);

  // ミュータントや虹色の場合は警告を強める
  const warning = (dino.mutant || dino.color !== "normal" || dino.rarityType === "rainbow")
    ? "⚠️ 【注意】レア個体・特殊個体の可能性があります！\n"
    : "";

  const ok = confirm(
    `${warning}「${dino.name}（Lv.${dino.level}）」とお別れしますか？\n` +
    `獲得アイテム：${reward.label} ×${reward.amount}`
  );

  if (!ok) return;

  // 交配相手に選ばれていた場合は選択を解除
  if (selectedMale === dinoId) selectedMale = null;
  if (selectedFemale === dinoId) selectedFemale = null;

  // リストから削除して報酬を付与
  game.dinos.splice(index, 1);
  game.foods[reward.type] = (game.foods[reward.type] ?? 0) + reward.amount;

  addLog(`👋 ${dino.name}（Lv.${dino.level}）とお別れし、${reward.label} ×${reward.amount} を手に入れた`);
  game.stats.dinosReleased++;
  update();
}

// レアリティの最低保証を適用する関数
function rollAreaEgg(minRarity) {
  const rank = { white: 1, blue: 2, purple: 3, rainbow: 4 };
  const egg = rollStarterEgg();

  if (rank[egg.rarity] < rank[minRarity]) {
    egg.rarity = minRarity;
  }
  return egg;
}

// 1回の探索での戦闘回数を抽選（1〜3回）
function rollBattleCount() {
  const r = Math.random();
  if (r < 0.50) return 1; // 50%: 通常（1戦）
  if (r < 0.85) return 2; // 35%: 2連戦
  return 3;               // 15%: 3連戦（大当たり）
}

async function handleExplore(isAuto = false) {
  if (!isAuto && !canAct(300)) return;

  const activeDino = game.dinos.find(d => d.uid === game.activeDinoId);
  if (!activeDino) return;

  const initialStats = calculateStats(activeDino);
  const currentHp = Math.floor(activeDino.currentHp);
  const maxHp = Math.floor(initialStats.hp);

  // 出発時点で瀕死状態（HP 20%以下）かどうかを記録
  const wasCriticalAtStart = activeDino.currentHp <= initialStats.hp * 0.2;

  // 瀕死状態での出発は「死亡リスクあり」の警告ダイアログを表示
  if (wasCriticalAtStart) {
    const ok = confirm(
      `☠️ 【命の危険】${activeDino.name} は現在「瀕死状態」です！（HP: ${currentHp} / ${maxHp}）\n` +
      `この状態で探索に敗北すると、二度と戻ってきません（死亡ロスト）。\n\n` +
      `本当にこのまま探索に出発しますか？`
    );
    if (!ok) return;
  }

  const areaLevel = game.selectedAreaLevel;
  const area = AREAS.find(a => a.level === areaLevel) ?? AREAS[0];
  const totalBattles = rollBattleCount();
  const battleRecords = [];

  // 特性のドロップ率ボーナスを取得（経験値は戦闘勝利ごとにループ内で計算）
  const activeTraitEffect = getTraitData(activeDino.trait).effect;
  const dropBonus = activeTraitEffect.dropBonus ?? 0;

  addLog(`==============================`);
  addLog(`🧭 ${activeDino.name} が ${area.name} の探索へ出発！（${totalBattles > 1 ? `🔥 ${totalBattles}連戦の予感！` : "単独探索"}）`);

  let winStreak = 0;
  let isDefeated = false;

  for (let i = 1; i <= totalBattles; i++) {
    // 2戦目以降の開始前チェック
    if (i > 1) {
      const latestStats = calculateStats(activeDino);
      if (activeDino.currentHp <= latestStats.hp * 0.15) {
        addLog(`🏃 体力が限界に近づいたため、${i}戦目を回避して安全に帰還した！`);
        break;
      }
      addLog(`🔥 【${i} / ${totalBattles}戦目】さらなる敵が襲いかかってきた！`);
    }

    const stats = calculateStats(activeDino);
    const isCritical = activeDino.currentHp <= stats.hp * 0.2;
    const rawEnemy = getEnemyForArea(areaLevel);
    const loopMult = getLoopStatMultiplier();
    const loopPrefix = (game.worldLoop ?? 1) > 1 ? `[${game.worldLoop}周目] ` : "";
    const enemy = {
      ...rawEnemy,
      name: `${loopPrefix}${rawEnemy.name}`,
      baseAtk: Math.floor(rawEnemy.baseAtk * loopMult),
      baseHp: Math.floor(rawEnemy.baseHp * loopMult),
      baseSpd: Math.floor(rawEnemy.baseSpd * (1 + ((game.worldLoop ?? 1) - 1) * 0.35))
    };

    const result = battle(activeDino, stats, enemy, isCritical, addLog, Boolean(area.isSea));
    battleRecords.push({ enemy, win: result.win, isBoss: false });

    if (!result.win) {
      isDefeated = true;
      break;
    }

    winStreak++;
    game.stats.exploreWins++;

    // 💖 親密度（+2 / 上限100） ＆ 📊 努力値ポイント（+2 / 上限100）の獲得
    activeDino.affection = Math.min(100, (activeDino.affection ?? 0) + 2);
    activeDino.evEarned = Math.min(100, (activeDino.evEarned ?? 0) + 2);

    // 連戦ボーナス倍率 ＋ 特性「早熟」ボーナスを反映して経験値計算
    const streakMult = i === 1 ? 1.0 : i === 2 ? 1.2 : 1.5;
    const baseGainedExp = (area.expBonus + activeDino.level) * streakMult;
    const fBonus = getFacilityBonuses(game.facility);
    const gainedExp = Math.floor(
      baseGainedExp * (activeTraitEffect.allExpMult ?? 1) * (1 + fBonus.expMult) * getLoopExpMultiplier()
    );
    addLog(`✅ ${enemy.name} を倒した！（EXP +${gainedExp}${i > 1 ? ` / 連戦ボーナス×${streakMult}` : ""}）`);
    addExp(activeDino, gainedExp);

    // 探索率の上昇
    const prevProgress = game.areaProgress[areaLevel] ?? 0;
    const nextProgress = Math.min(100, prevProgress + area.progressPerWin);
    game.areaProgress[areaLevel] = nextProgress;

    if (prevProgress < 100) {
      addLog(`🗺️ ${area.name} の探索率が ${nextProgress}% になった！`);
    }

    // 初回100%達成ボーナス ＆ エリアボス出現
    if (nextProgress >= 100 && !game.areaCleared[areaLevel]) {
      game.areaCleared[areaLevel] = true;

      const reward = area.firstClearReward;
      if (reward) {
        if (reward.egg) {
          game.wildEggs.push(createWildEgg(reward.egg.size, reward.egg.rarity, currentHatchMult()));
        }
        if (reward.foods) {
          for (const [type, amount] of Object.entries(reward.foods)) {
            game.foods[type] = (game.foods[type] ?? 0) + amount;
          }
        }
        addLog(`🏆 【初回探索100%達成ボーナス】${reward.message} を獲得！`);
      }

      const areaBoss = AREA_BOSSES.find(b => b.areaLevel === areaLevel);
      if (areaBoss) {
        addLog(`🔥 【ボス出現！】このエリアの守護者「${areaBoss.name}」への挑戦が可能になった！`);
        if (!isAuto) {
          alert(
            `🏆 ${area.name} の探索率が 100% に到達！\n` +
            `初回ボーナス：${reward.message} を獲得！\n\n` +
            `🔥 守護ボス「${areaBoss.name}」が出現しました！\n撃破すると次のエリアが解放されます！`
          );
        }
      }
    }

    // 卵ドロップ判定（孵化設備の短縮倍率も適用）
    if (Math.random() < (area.eggChance + dropBonus)) {
      const egg = rollAreaEgg(area.eggMinRarity);
      game.wildEggs.push(createWildEgg(egg.size, egg.rarity, currentHatchMult()));
      addLog(`🥚 卵を持ち帰った！（${getEggRarityLabel(egg.rarity)} / ${getSizeLabel(egg.size)}）`);
    }

    // エサドロップ判定
    const roll = Math.random();
    const { premium, good } = area.foodRates;

    if (roll < premium) {
      game.foods.premium++;
      addLog(`✨ ${enemy.name} から極上肉獲得`);
    } else if (roll < premium + good) {
      game.foods.good++;
      addLog(`🥩 ${enemy.name} から上質肉獲得`);
    } else {
      game.foods.raw++;
      addLog(`🍖 ${enemy.name} から生肉獲得`);
    }

    // 生命の結晶ドロップ判定
    if (Math.random() < ((area.crystalChance ?? 0.3) + dropBonus)) {
      game.items.breedCrystal = (game.items.breedCrystal ?? 0) + 1;
      game.stats.crystalsEarned = (game.stats.crystalsEarned ?? 0) + 1;
      addLog(`💎 ${enemy.name} から「生命の結晶」を獲得した！`);
    }

    // エリア秘宝のドロップ判定
    const areaTreasure = TREASURES.find(t => t.areaLevel === areaLevel);
    if (areaTreasure && Math.random() < (areaTreasure.dropChance + dropBonus)) {
      game.treasures ??= {};
      const currentLv = game.treasures[areaTreasure.id] ?? 0;

      if (currentLv === 0) {
        game.treasures[areaTreasure.id] = 1;
        syncTreasures(game.treasures);
        const desc = getTreasureDesc(areaTreasure, 1);
        addLog(`🏺 【秘宝発見！】「${areaTreasure.icon} ${areaTreasure.name} (Lv.1)」を手に入れた！（${desc}）`);
        if (!isAuto) {
          alert(`🏺 伝説の秘宝を発見しました！\n\n「${areaTreasure.icon} ${areaTreasure.name}」\n効果：${desc}`);
        }
      } else if (currentLv < MAX_TREASURE_LEVEL) {
        const nextLv = currentLv + 1;
        game.treasures[areaTreasure.id] = nextLv;
        syncTreasures(game.treasures);
        const desc = getTreasureDesc(areaTreasure, nextLv);
        addLog(`⬆️ 【秘宝強化！】「${areaTreasure.icon} ${areaTreasure.name}」が Lv.${nextLv} に上がった！（${desc}）`);
      } else {
        game.foods.premium = (game.foods.premium ?? 0) + 1;
        addLog(`🏺 「${areaTreasure.name}」は既にLv.MAXのため、✨ 極上肉×1 に変換された！`);
      }
    }
  }

  const exploreBtn = document.getElementById("exploreBtn");
  const bossBtn = document.getElementById("bossBtn");
  if (exploreBtn) exploreBtn.disabled = true;
  if (bossBtn) bossBtn.disabled = true;

  await playExploreSequence(activeDino, areaLevel, battleRecords);

  // --- 探索終了後の生死・帰還判定 ---
  if (isDefeated) {
    if (wasCriticalAtStart) {
      const lostIndex = game.dinos.findIndex(d => d.uid === activeDino.uid);
      if (lostIndex !== -1) {
        game.dinos.splice(lostIndex, 1);
      }

      if (selectedMale === activeDino.uid) selectedMale = null;
      if (selectedFemale === activeDino.uid) selectedFemale = null;
      game.activeDinoId = game.dinos.length > 0 ? game.dinos[0].uid : null;

      game.stats.dinosLost = (game.stats.dinosLost ?? 0) + 1;

      game.items.breedCrystal = (game.items.breedCrystal ?? 0) + 1;
      game.foods.premium = (game.foods.premium ?? 0) + 1;

      addLog(`🪦 ${activeDino.name}（Lv.${activeDino.level}）は力尽き、帰らぬ恐竜となった…`);
      addLog(`💐 形見として「💎 生命の結晶×1」と「✨ 極上肉×1」が残された`);

      rescueIfSoftlocked();

      const rescueMsg = !game.starterSelected
        ? `\n\n🥚 恐竜がいなくなったため、画面上部に新しい「スターター卵」が用意されました！`
        : "";

      alert(
        `🪦 ${activeDino.name} は瀕死の傷がもとで力尽きました…\n` +
        `形見として「💎 生命の結晶×1」「✨ 極上肉×1」を手に入れました。` +
        rescueMsg
      );
    } else {
      activeDino.currentHp = 1;
      addLog(`⚠️ ${activeDino.name} は致命傷を負い、HP1（瀕死状態）でなんとか拠点へ逃げ帰った！`);
      addLog(`❗ 回復せずにこのまま再出発すると命を落とす危険があります！`);
    }
  } else if (winStreak > 1) {
    addLog(`🎊 探索終了！見事 ${winStreak}連勝 を達成して帰還した！`);
  } else {
    addLog(`🏕️ 探索終了！無事に拠点へ帰還した！`);
  }

  addLog(`==============================`);
  update();
}

async function handleToggleAutoExplore() {
  if (isAutoExploring) {
    // 停止ボタンを押したとき
    isAutoExploring = false;
    addLog(`⏹️ オート周回を停止しました（現在の探索完了後に終了します）`);
    update();
    return;
  }

  const activeDino = game.dinos.find(d => d.uid === game.activeDinoId);
  if (!activeDino) return;

  const stats = calculateStats(activeDino);
  if (activeDino.currentHp <= stats.hp * 0.2) {
    alert("⚠️ 瀕死状態（HP 20%以下）のためオート周回を開始できません！\nエサを与えてHPを回復してください。");
    return;
  }

  isAutoExploring = true;
  addLog(`🔄 【オート周回開始】瀕死になるか停止ボタンを押すまで探索を繰り返します！`);
  update();

  let loopCount = 0;

  while (isAutoExploring) {
    const currentDino = game.dinos.find(d => d.uid === game.activeDinoId);
    if (!currentDino) {
      isAutoExploring = false;
      break;
    }

    const latestStats = calculateStats(currentDino);
    // 瀕死（HP 20%以下）になったら自動停止
    if (currentDino.currentHp <= latestStats.hp * 0.2) {
      isAutoExploring = false;
      addLog(`🛑 【オート周回終了】${currentDino.name} が瀕死状態になったため自動停止しました（計 ${loopCount}周）`);
      update();
      break;
    }

    loopCount++;
    await handleExplore(true);

    // 1周ごとの小休止（0.4秒）
    if (isAutoExploring) {
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
}

function handleFeed(dinoId, foodType) {
  if (!canAct()) return;

  const dino = game.dinos.find(d => d.uid === dinoId);
  if (!dino) return;

  if ((game.foods[foodType] ?? 0) <= 0) return;

  const foodConfig = {
    raw: { healRate: 0.20, minHeal: 10, exp: 10 },
    good: { healRate: 0.50, minHeal: 30, exp: 30 },
    premium: { healRate: 1.00, minHeal: 0, exp: 100 }
  };

  const config = foodConfig[foodType];
  if (!config) return;

  const stats = calculateStats(dino);

  // 割合回復量の計算（最低保証あり・極上肉は全快）
  const fBonus = getFacilityBonuses(game.facility);
  const finalHealRate = Math.min(1.0, config.healRate + fBonus.healBonus);
  const healAmount = finalHealRate >= 1.0
    ? stats.hp
    : Math.max(config.minHeal, Math.floor(stats.hp * finalHealRate));

  dino.currentHp = Math.min(stats.hp, dino.currentHp + healAmount);

  // 特性（大食い・早熟）の経験値倍率を適用
  const traitEffect = getTraitData(dino.trait).effect;
  const expMult = (traitEffect.feedExpMult ?? 1) * (traitEffect.allExpMult ?? 1) * (1 + fBonus.foodExpMult);
  const finalExp = Math.floor(config.exp * expMult);

  game.foods[foodType]--;
  dino.affection = Math.min(100, (dino.affection ?? 0) + 1);

  addExp(dino, finalExp);

  update();
}

// 種族IDから本来の種族名を取得するヘルパー
function getDefaultSpeciesName(speciesId) {
  const normal = DINO_SPECIES.find(d => d.id === speciesId);
  if (normal) return normal.name;

  const special = SPECIAL_BREEDS.find(b => b.result.id === speciesId);
  return special ? special.result.name : speciesId;
}

function handleRename(dinoId) {
  const dino = game.dinos.find(d => d.uid === dinoId);
  if (!dino) return;

  const defaultName = getDefaultSpeciesName(dino.speciesId);
  const input = prompt(
    `新しいニックネームを入力してください（最大15文字）\n※空欄でOKを押すと「${defaultName}」に戻ります`,
    dino.name
  );

  // キャンセルが押された場合は何もしない
  if (input === null) return;

  const trimmed = input.trim();
  if (trimmed === "") {
    dino.name = defaultName;
  } else {
    dino.name = trimmed.slice(0, 15);
  }

  update();
}

function handleHatchAllWildEggs() {
  if (!canAct()) return;

  const now = Date.now();
  const readyEggs = game.wildEggs.filter(egg => (egg.hatchAt ?? 0) <= now);
  if (readyEggs.length === 0) return;

  const count = readyEggs.length;
  const hatchedNames = {};
  const newSpeciesNames = [];

  readyEggs.forEach(egg => {
    const dino = hatchStarterEgg(egg);
    const isNew = !game.discoveredSpecies.includes(dino.speciesId);

    game.dinos.push(dino);
    if (!game.activeDinoId) {
      game.activeDinoId = dino.uid;
    }

    discoverSpecies(dino);
    game.stats.eggsHatched++;

    hatchedNames[dino.name] = (hatchedNames[dino.name] ?? 0) + 1;
    if (isNew && !newSpeciesNames.includes(dino.name)) {
      newSpeciesNames.push(dino.name);
    }
  });

  // 孵化した卵だけを取り除き、まだカウントダウン中の卵は残す
  game.wildEggs = game.wildEggs.filter(egg => (egg.hatchAt ?? 0) > now);

  const summary = Object.entries(hatchedNames)
    .map(([name, num]) => `${name}×${num}`)
    .join("、");

  addLog(`🐣 野生の卵を${count}個まとめて孵化！（${summary}）`);

  if (newSpeciesNames.length > 0) {
    addLog(`📖 【図鑑新規登録】${newSpeciesNames.join("、")} を発見！`);
    alert(`🐣 ${count}個の卵が孵化しました！\n\n✨ 図鑑に新しく「${newSpeciesNames.join("、")}」が登録されました！`);
  }

  update();
}

function handleBulkRelease() {
  if (!canAct()) return;

  const condition = document.getElementById("bulkReleaseCondition")?.value ?? "white_f0";
  const isF0Only = condition.endsWith("_f0");

  const allowedRarities = condition.startsWith("purple")
    ? ["white", "blue", "purple"]
    : condition.startsWith("blue")
      ? ["white", "blue"]
      : ["white"];

  const busyIds = getBusyExpeditionDinoIds();

  // 対象となる恐竜を抽出（保護対象はすべて除外）
  const targets = game.dinos.filter(dino => {
    if (dino.uid === game.activeDinoId) return false;
    if (dino.locked) return false;
    if (busyIds.has(dino.uid)) return false;
    if (dino.uid === selectedMale || dino.uid === selectedFemale) return false;
    if (dino.mutant) return false;
    if (dino.color && dino.color !== "normal") return false;

    if (isF0Only && (dino.generation ?? 0) !== 0) return false;

    const r = dino.rarityType ?? "white";
    return allowedRarities.includes(r);
  });

  if (targets.length === 0) {
    alert("条件に合う整理対象の恐竜がいません。\n（育成中・遠征中・ロック中・ミュータント・特殊体色は保護されています）");
    return;
  }

  const labelMap = {
    white_f0: "⚪ 白レア ＆ F0のみ",
    white_all: "⚪ 白レアすべて（全世代）",
    blue_f0: "🔵 青レア以下 ＆ F0のみ",
    blue_all: "🔵 青レア以下すべて（全世代）",
    purple_f0: "🟣 紫レア以下 ＆ F0のみ",
    purple_all: "🟣 紫レア以下すべて（全世代）"
  };

  const ok = confirm(
    `🧹 【一括お別れ確認】\n` +
    `対象条件：${labelMap[condition]}\n` +
    `対象数：${targets.length} 体\n\n` +
    `本当にお別れしてエサ（お肉）に変換しますか？`
  );
  if (!ok) return;

  let rawGain = 0;
  let goodGain = 0;
  let premiumGain = 0;

  targets.forEach(dino => {
    const r = dino.rarityType ?? "white";
    if (r === "purple") {
      premiumGain += 1;
    } else if (r === "blue") {
      goodGain += 1;
    } else {
      rawGain += 1;
    }
  });

  const targetIds = new Set(targets.map(d => d.uid));
  game.dinos = game.dinos.filter(d => !targetIds.has(d.uid));

  game.foods.raw = (game.foods.raw ?? 0) + rawGain;
  game.foods.good = (game.foods.good ?? 0) + goodGain;
  game.foods.premium = (game.foods.premium ?? 0) + premiumGain;

  const gainTexts = [];
  if (rawGain > 0) gainTexts.push(`🍖 生肉×${rawGain}`);
  if (goodGain > 0) gainTexts.push(`🥩 上質肉×${goodGain}`);
  if (premiumGain > 0) gainTexts.push(`✨ 極上肉×${premiumGain}`);

  addLog(`👋 【一括お別れ】${targets.length} 体の恐竜とお別れし、${gainTexts.join("・")} を手に入れた！`);
  update();
}

// 虹レア1体あたりの結晶還元数を計算（基本5個 ＋ 世代数、最大15個）
function getRainbowCrystalReturn(dino) {
  const gen = dino.generation ?? 0;
  return 5 + Math.min(10, gen);
}

// 虹レア個別選択モードの切り替え
function handleToggleRainbowMode() {
  isRainbowSelectMode = !isRainbowSelectMode;
  selectedRainbowIds.clear();
  update();
}

// 虹レア個体の選択トグル
function handleToggleRainbowPick(dinoId) {
  if (!isRainbowSelectMode) return;
  if (selectedRainbowIds.has(dinoId)) {
    selectedRainbowIds.delete(dinoId);
  } else {
    selectedRainbowIds.add(dinoId);
  }
  update();
}

// 表示中の対象虹レアを一括で選択状態にする
function handleSelectAllFilteredRainbows(targetIds = []) {
  if (!isRainbowSelectMode) return;
  targetIds.forEach(id => selectedRainbowIds.add(id));
  update();
}

// 選択中の虹レアをすべて解除する
function handleClearRainbowPicks() {
  if (!isRainbowSelectMode) return;
  selectedRainbowIds.clear();
  update();
}

// 選択した虹レアを生命の結晶へ還元実行
function handleExecuteRainbowConvert() {
  if (!canAct()) return;
  if (selectedRainbowIds.size === 0) return;

  const busyIds = getBusyExpeditionDinoIds();

  // 保護対象が混ざっていないか最終チェック
  const validTargets = game.dinos.filter(d => {
    if (!selectedRainbowIds.has(d.uid)) return false;
    if ((d.rarityType ?? "white") !== "rainbow") return false;
    if (d.uid === game.activeDinoId) return false;
    if (d.locked || d.mutant) return false;
    if (d.color && d.color !== "normal") return false;
    if (busyIds.has(d.uid)) return false;
    if (d.uid === selectedMale || d.uid === selectedFemale) return false;
    return true;
  });

  if (validTargets.length === 0) {
    selectedRainbowIds.clear();
    update();
    return;
  }

  // 最後の1体は残す安全チェック
  if (game.dinos.length - validTargets.length < 1) {
    alert("最後の1体は還元できません！");
    return;
  }

  const totalCrystals = validTargets.reduce((sum, d) => sum + getRainbowCrystalReturn(d), 0);
  const nameList = validTargets.map(d => `・${d.name}（F${d.generation ?? 0} / Lv.${d.level}）`).join("\n");

  const ok = confirm(
    `💎 【虹レア結晶還元の最終確認】\n` +
    `以下の ${validTargets.length}体 とお別れして「💎 生命の結晶 ×${totalCrystals}個」に還元しますか？\n\n` +
    `${nameList}`
  );
  if (!ok) return;

  const removeSet = new Set(validTargets.map(d => d.uid));
  game.dinos = game.dinos.filter(d => !removeSet.has(d.uid));

  game.items.breedCrystal = (game.items.breedCrystal ?? 0) + totalCrystals;
  game.stats.crystalsEarned = (game.stats.crystalsEarned ?? 0) + totalCrystals;
  game.stats.dinosReleased = (game.stats.dinosReleased ?? 0) + validTargets.length;

  selectedRainbowIds.clear();
  isRainbowSelectMode = false;

  addLog(`💎 【結晶還元】虹レア ${validTargets.length}体 を還元し、「💎 生命の結晶 ×${totalCrystals}個」を獲得した！`);
  alert(`💎 還元完了！\n「生命の結晶 ×${totalCrystals}個」を手に入れました！`);
  update();
}

// ロック（お気に入り）の切り替え
function handleToggleLock(dinoId) {
  const dino = game.dinos.find(d => d.uid === dinoId);
  if (!dino) return;

  dino.locked = !dino.locked;
  update();
}

async function handleBossBattle() {
  if (!canAct(300)) return;

  const activeDino = game.dinos.find(d => d.uid === game.activeDinoId);
  if (!activeDino) return;

  const areaLevel = game.selectedAreaLevel;
  if ((game.areaProgress[areaLevel] ?? 0) < 100) return;

  const boss = AREA_BOSSES.find(b => b.areaLevel === areaLevel);
  if (!boss) return;

  const stats = calculateStats(activeDino);
  const wasCriticalAtStart = activeDino.currentHp <= stats.hp * 0.2;

  if (wasCriticalAtStart) {
    const ok = confirm(
      `☠️ 【命の危険】${activeDino.name} は現在「瀕死状態」です！\n` +
      `強大なエリアボス「${boss.name}」に負けると死亡ロストします。\n\n本当に挑みますか？`
    );
    if (!ok) return;
  }

  addLog(`==============================`);
  addLog(`🔥 【エリアボス戦】${activeDino.name} が「${boss.name}」に挑んだ！`);

  // 元のボスデータを書き換えないようコピーして戦闘
  const loopMult = getLoopStatMultiplier();
  const loopPrefix = (game.worldLoop ?? 1) > 1 ? `[${game.worldLoop}周目] ` : "";
  const bossEnemy = {
    ...boss,
    name: `${loopPrefix}${boss.name}`,
    baseAtk: Math.floor(boss.baseAtk * loopMult),
    baseHp: Math.floor(boss.baseHp * loopMult),
    baseSpd: Math.floor(boss.baseSpd * (1 + ((game.worldLoop ?? 1) - 1) * 0.35))
  };

const area = AREAS.find(a => a.level === areaLevel) ?? AREAS[0];
const result = battle(activeDino, stats, bossEnemy, wasCriticalAtStart, addLog, Boolean(area.isSea));

  await playExploreSequence(activeDino, areaLevel, [{ enemy: bossEnemy, win: result.win, isBoss: true }]);

  if (!result.win) {
    if (wasCriticalAtStart) {
      // 瀕死出撃で敗北 → 死亡ロスト
      const lostIndex = game.dinos.findIndex(d => d.uid === activeDino.uid);
      if (lostIndex !== -1) game.dinos.splice(lostIndex, 1);

      if (selectedMale === activeDino.uid) selectedMale = null;
      if (selectedFemale === activeDino.uid) selectedFemale = null;
      game.activeDinoId = game.dinos.length > 0 ? game.dinos[0].uid : null;

      game.stats.dinosLost = (game.stats.dinosLost ?? 0) + 1;
      game.items.breedCrystal = (game.items.breedCrystal ?? 0) + 1;
      game.foods.premium = (game.foods.premium ?? 0) + 1;

      addLog(`🪦 ${activeDino.name} はボス「${boss.name}」の前に力尽きた…`);
      addLog(`💐 形見として「💎 生命の結晶×1」と「✨ 極上肉×1」が残された`);

      rescueIfSoftlocked();

      const rescueMsg = !game.starterSelected
        ? `\n\n🥚 恐竜がいなくなったため、画面上部に新しい「スターター卵」が用意されました！`
        : "";

      alert(
        `🪦 ${activeDino.name} はボスに敗れ力尽きました…\n` +
        `形見として「💎 生命の結晶×1」「✨ 極上肉×1」を手に入れました。` +
        rescueMsg
      );
    } else {
      // 健康出撃で敗北 → HP1で生還
      activeDino.currentHp = 1;
      addLog(`⚠️ ボス「${boss.name}」の圧倒的な力の前に敗北…HP1でなんとか撤退した！`);
    }
    addLog(`==============================`);
    update();
    return;
  }

  // --- ボス勝利時の処理 ---
  game.stats.bossWins = (game.stats.bossWins ?? 0) + 1;
  const traitEffect = getTraitData(activeDino.trait).effect;
  const fBonus = getFacilityBonuses(game.facility);
  const gainedExp = Math.floor(
    boss.expReward * (traitEffect.allExpMult ?? 1) * (1 + fBonus.expMult) * getLoopExpMultiplier()
  );

  addLog(`👑 【ボス撃破！】「${boss.name}」を打ち倒した！（EXP +${gainedExp}）`);
  addExp(activeDino, gainedExp);

  game.bossCleared ??= {};
  const isFirstClear = !game.bossCleared[areaLevel];

  if (isFirstClear) {
    game.bossCleared[areaLevel] = true;
    const r = boss.firstReward;

    if (r.egg) {
      game.wildEggs.push(createWildEgg(r.egg.size, r.egg.rarity));
    }
    game.items.breedCrystal = (game.items.breedCrystal ?? 0) + r.crystals;
    game.stats.crystalsEarned = (game.stats.crystalsEarned ?? 0) + r.crystals;
    game.foods.premium = (game.foods.premium ?? 0) + r.premiumMeat;

    addLog(`🏆 【ボス初回撃破ボーナス】${r.text} を獲得！`);
    const nextArea = AREAS.find(a => a.level === areaLevel + 1);
    let unlockText = "";
    if (nextArea && game.unlockedAreaLevel < nextArea.level) {
      game.unlockedAreaLevel = nextArea.level;
      addLog(`🎉 新しいエリア「${nextArea.name}」が解放されました！`);
      unlockText = `\n\n🎉 新しいエリア「${nextArea.name}」が解放されました！`;
    }
    alert(`👑 エリアボス「${boss.name}」を初撃破！\n\n初回報酬：${r.text}`);
  } else {
    const r = boss.repeatReward;
    game.items.breedCrystal = (game.items.breedCrystal ?? 0) + r.crystals;
    game.stats.crystalsEarned = (game.stats.crystalsEarned ?? 0) + r.crystals;
    game.foods.premium = (game.foods.premium ?? 0) + r.premiumMeat;

    addLog(`🎁 【ボス討伐報酬】${r.text} を獲得！`);
  }

  addLog(`==============================`);
  update();
}

// --- ③ 血統書表示 ---
function handleShowPedigree(dinoId) {
  const dino = game.dinos.find(d => d.uid === dinoId);
  if (!dino) return;

  const gen = dino.generation ?? 0;

  if (!dino.parents) {
    if (gen === 0) {
      alert(`📜 【血統書】${dino.name}（F0）\n\n野生の卵（またはスターター卵）から生まれた初代個体です。`);
    } else {
      alert(`📜 【血統書】${dino.name}（F${gen}）\n\n交配で誕生した個体です（※血統記録機能より前に誕生したため両親データは残っていません）。`);
    }
    return;
  }

  const f = dino.parents.father;
  const m = dino.parents.mother;

  alert(
    `📜 【血統書】${dino.name}（F${dino.generation ?? 0}）\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `♂️ 父：${f.name}（${f.speciesName} / F${f.generation}）\n` +
    `♀️ 母：${m.name}（${m.speciesName} / F${m.generation}）`
  );
}

// --- ② 遠征隊の操作 ---
// 現在遠征中の恐竜ID一覧をSetで取得するヘルパー
function getBusyExpeditionDinoIds() {
  const set = new Set();
  (game.expeditions ?? []).forEach(exp => {
    exp.memberIds.forEach(id => set.add(id));
  });
  return set;
}

function handleToggleExpDraftMember(dinoId) {
  game.expeditionDraft ??= { areaLevel: 1, memberIds: [] };
  const busyIds = getBusyExpeditionDinoIds();

  if (dinoId === game.activeDinoId || busyIds.has(dinoId)) return;

  const idx = game.expeditionDraft.memberIds.indexOf(dinoId);
  if (idx !== -1) {
    game.expeditionDraft.memberIds.splice(idx, 1);
  } else {
    if (game.expeditionDraft.memberIds.length >= 3) {
      alert("1チームあたりの編成上限は3体までです！");
      return;
    }
    game.expeditionDraft.memberIds.push(dinoId);
  }
  update();
}

function handleSelectExpArea(areaLevel) {
  game.expeditionDraft ??= { areaLevel: 1, memberIds: [] };
  game.expeditionDraft.areaLevel = areaLevel;
  update();
}

function handleAutoSelectExpMembers() {
  game.expeditionDraft ??= { areaLevel: 1, memberIds: [] };
  const busyIds = getBusyExpeditionDinoIds();

  // 派遣可能な待機恐竜を抽出
  const candidates = game.dinos.filter(
    d => d.uid !== game.activeDinoId && !busyIds.has(d.uid)
  );

  if (candidates.length === 0) {
    alert("派遣できる待機恐竜がいません！");
    return;
  }

  const rarityRank = { rainbow: 4, purple: 3, blue: 2, white: 1 };

  // 1. 幸運持ち ＞ 2. レア度が高い順 ＞ 3. レベルが低い順 で並べ替え
  const sorted = [...candidates].sort((a, b) => {
    const luckyA = a.trait === "hunter" ? 1 : 0;
    const luckyB = b.trait === "hunter" ? 1 : 0;
    if (luckyA !== luckyB) return luckyB - luckyA;

    const rA = rarityRank[a.rarityType] ?? 1;
    const rB = rarityRank[b.rarityType] ?? 1;
    if (rA !== rB) return rB - rA;

    return a.level - b.level;
  });

  // 上位3体を選択状態にセット
  game.expeditionDraft.memberIds = sorted.slice(0, 3).map(d => d.uid);
  update();
}

function handleStartExpedition() {
  if (!canAct()) return;

  const unlockedLevels = getUnlockedExpeditionLevels();
  const maxTeams = unlockedLevels.length;
  game.expeditions ??= [];

  if (maxTeams === 0) {
    alert("遠征可能なエリアがまだ解放されていません！");
    return;
  }

  if (game.expeditions.length >= maxTeams) {
    alert(`同時に派遣できるチーム上限（${maxTeams}部隊）に達しています！`);
    return;
  }

  const defaultLevel = unlockedLevels.at(0) ?? 1;
  if (!game.expeditionDraft || typeof game.expeditionDraft.areaLevel !== "number") {
    game.expeditionDraft = { areaLevel: defaultLevel, memberIds: [] };
  }

  const busyIds = getBusyExpeditionDinoIds();
  const validMembers = (game.expeditionDraft.memberIds ?? []).filter(
    id => id !== game.activeDinoId && !busyIds.has(id) && game.dinos.some(d => d.uid === id)
  );

  if (validMembers.length === 0) {
    alert("遠征に出す待機恐竜を1〜3体選んでください！");
    return;
  }

  const targetLevel = unlockedLevels.includes(game.expeditionDraft.areaLevel)
    ? game.expeditionDraft.areaLevel
    : defaultLevel;

  const course = AREA_EXPEDITIONS.find(c => c.areaLevel === targetLevel) ?? AREA_EXPEDITIONS.at(0);
  if (!course) return;

  game.expeditions.push({
    id: crypto.randomUUID(),
    areaLevel: course.areaLevel,
    memberIds: validMembers,
    endAt: Date.now() + course.durationMs
  });

  if (validMembers.includes(selectedMale)) selectedMale = null;
  if (validMembers.includes(selectedFemale)) selectedFemale = null;
  game.expeditionDraft.memberIds = [];

  addLog(`🏕️ 遠征隊（${validMembers.length}体）が「${course.name}」へ出発した！`);
  update();
}

function handleClaimExpedition(expId) {
  if (!canAct()) return;
  game.expeditions ??= [];
  const index = game.expeditions.findIndex(e => e.id === expId);
  if (index === -1) return;

  const exp = game.expeditions[index];
  if (Date.now() < exp.endAt) return;

  const course = AREA_EXPEDITIONS.find(c => c.areaLevel === exp.areaLevel) ?? AREA_EXPEDITIONS[0];
  const members = exp.memberIds
    .map(id => game.dinos.find(d => d.uid === id))
    .filter(Boolean);

  // チーム戦力と特性「幸運」から報酬倍率を計算
  let totalPower = 0;
  let luckyCount = 0;
  members.forEach(d => {
    const s = calculateStats(d);
    totalPower += (s.atk + s.hp * 0.2 + s.spd);
    if (d.trait === "hunter") luckyCount++;
  });

  const powerMult = Math.min(2.5, 1 + Math.floor(totalPower / 450) * 0.25);
  const luckBonus = luckyCount * 0.10; // 1体ごとに +10%（3体で +30% 重複）
  const rewards = [];

  game.materials ??= { wood: 0, stone: 0, ore: 0 };

  if (course.areaLevel === 1) {
    const wood = Math.floor((2 + Math.floor(Math.random() * 3)) * powerMult);
    const raw = Math.floor((5 + Math.floor(Math.random() * 4)) * powerMult);
    const good = Math.floor((2 + (Math.random() < 0.4 + luckBonus ? 1 : 0)) * powerMult);
    game.materials.wood += wood;
    game.foods.raw += raw;
    game.foods.good += good;
    rewards.push(`🪵 古代の木材×${wood}`, `🍖 生肉×${raw}`, `🥩 上質肉×${good}`);
  } else if (course.areaLevel === 2) {
    const wood = Math.floor((3 + Math.floor(Math.random() * 3)) * powerMult);
    const stone = Math.floor((1 + Math.floor(Math.random() * 3)) * powerMult);
    const crystal = Math.max(2, Math.floor((2 + (Math.random() < 0.4 + luckBonus ? 1 : 0)) * (powerMult >= 1.5 ? 1.5 : 1)));
    game.materials.wood += wood;
    game.materials.stone += stone;
    game.items.breedCrystal = (game.items.breedCrystal ?? 0) + crystal;
    game.stats.crystalsEarned = (game.stats.crystalsEarned ?? 0) + crystal;
    rewards.push(`🪵 木材×${wood}`, `🪨 神秘の石材×${stone}`, `💎 結晶×${crystal}`);
  } else if (course.areaLevel === 3) {
    const stone = Math.floor((3 + Math.floor(Math.random() * 3)) * powerMult);
    const wood = Math.floor((3 + Math.floor(Math.random() * 2)) * powerMult);
    const rarity = Math.random() < (0.45 + luckBonus) ? "purple" : "blue";
    const size = Math.random() < 0.35 ? "large" : "normal";
    game.materials.stone += stone;
    game.materials.wood += wood;
    game.wildEggs.push(createWildEgg(size, rarity, currentHatchMult()));
    const prem = Math.max(2, Math.floor(2 * (powerMult >= 1.75 ? 1.5 : 1)));
    game.foods.premium += prem;
    rewards.push(`🪨 石材×${stone}`, `🪵 木材×${wood}`, `🥚 野生卵(${getEggRarityLabel(rarity)})`, `✨ 極上肉×${prem}`);
  } else if (course.areaLevel === 4) {
    const ore = Math.floor((1 + Math.floor(Math.random() * 3)) * powerMult);
    const stone = Math.floor((4 + Math.floor(Math.random() * 3)) * powerMult);
    const crystal = Math.floor(3 * (powerMult >= 1.5 ? 1.5 : 1));
    game.materials.ore += ore;
    game.materials.stone += stone;
    game.items.breedCrystal = (game.items.breedCrystal ?? 0) + crystal;
    game.stats.crystalsEarned = (game.stats.crystalsEarned ?? 0) + crystal;
    rewards.push(`🔮 星屑の鉱石×${ore}`, `🪨 石材×${stone}`, `💎 結晶×${crystal}`);
    if (Math.random() < (0.50 + luckBonus)) {
      game.wildEggs.push(createWildEgg("large", "purple", currentHatchMult()));
      rewards.push(`🥚 野生卵(🟣 紫卵)`);
    }
  } else if (course.areaLevel === 5) {
    // Lv.5 総力遠征
    const ore = Math.floor((3 + Math.floor(Math.random() * 3)) * powerMult);
    const stone = Math.floor((5 + Math.floor(Math.random() * 3)) * powerMult);
    const crystal = Math.floor(5 * (powerMult >= 1.5 ? 1.5 : 1));
    const prem = Math.floor(4 * (powerMult >= 1.5 ? 1.5 : 1));
    const rarity = Math.random() < (0.45 + luckBonus) ? "rainbow" : "purple";
    const size = Math.random() < 0.45 ? "giant" : "large";
    game.materials.ore += ore;
    game.materials.stone += stone;
    game.items.breedCrystal = (game.items.breedCrystal ?? 0) + crystal;
    game.stats.crystalsEarned = (game.stats.crystalsEarned ?? 0) + crystal;
    game.foods.premium += prem;
    game.wildEggs.push(createWildEgg(size, rarity, currentHatchMult()));
    rewards.push(`🔮 鉱石×${ore}`, `🪨 石材×${stone}`, `🥚 野生卵(${getEggRarityLabel(rarity)})`, `💎 結晶×${crystal}`, `✨ 極上肉×${prem}`);
  } else if (course.areaLevel === 6) {
    // Lv.6 深海神殿の宝物遠征
    const ore = Math.floor((5 + Math.floor(Math.random() * 4)) * powerMult);
    const stone = Math.floor((6 + Math.floor(Math.random() * 4)) * powerMult);
    const crystal = Math.floor(8 * (powerMult >= 1.5 ? 1.5 : 1));
    const prem = Math.floor(6 * (powerMult >= 1.5 ? 1.5 : 1));
    const rarity = Math.random() < (0.65 + luckBonus) ? "rainbow" : "purple";
    const size = Math.random() < 0.60 ? "giant" : "large";
    game.materials.ore += ore;
    game.materials.stone += stone;
    game.items.breedCrystal = (game.items.breedCrystal ?? 0) + crystal;
    game.stats.crystalsEarned = (game.stats.crystalsEarned ?? 0) + crystal;
    game.foods.premium += prem;
    game.wildEggs.push(createWildEgg(size, rarity, currentHatchMult()));
    rewards.push(`🔮 鉱石×${ore}`, `🪨 石材×${stone}`, `🥚 野生卵(${getEggRarityLabel(rarity)})`, `💎 結晶×${crystal}`, `✨ 極上肉×${prem}`);
  }

  // 参加メンバーへの経験値付与
  const baseMemberExp = Math.floor((course.durationMs / 1000) * 0.5); // 3分で90EXP 〜 40分で1200EXP
  const fBonus = getFacilityBonuses(game.facility);
  const levelUpNotices = [];

  members.forEach(d => {
    const prevLv = d.level;
    const traitEffect = getTraitData(d.trait).effect;
    const finalExp = Math.floor(
      baseMemberExp * (traitEffect.allExpMult ?? 1) * (1 + fBonus.expMult)
    );
    addExp(d, finalExp);

    if (d.level > prevLv) {
      levelUpNotices.push(`${d.name} (Lv.${prevLv}→Lv.${d.level})`);
    }
  });

  game.expeditions.splice(index, 1);
  game.stats.expeditionsDone = (game.stats.expeditionsDone ?? 0) + 1;

  const rewardText = rewards.join("、");
  const luckLogText = luckyCount > 0 ? ` / 🍀幸運+${luckyCount * 10}%` : "";
  const lvUpText = levelUpNotices.length > 0
    ? `\n🎉 レベルアップ：${levelUpNotices.join("、")}`
    : "";

  addLog(`🏕️ 【${course.name} 帰還】${rewardText} を獲得！（参加メンバー基本 EXP +${baseMemberExp}${luckLogText}）`);

  alert(
    `🏕️ 遠征隊が帰還しました！\n\n` +
    `獲得報酬：${rewardText}\n` +
    `参加メンバー経験値：基本 EXP +${baseMemberExp}${lvUpText}`
  );

  update();
}

function handleUpgradeFacility(facilityKey) {
  if (!canAct()) return;

  const facilityDef = FACILITIES.find(f => f.key === facilityKey);
  if (!facilityDef) return;

  game.facility ??= { incubatorLevel: 0, trainingLevel: 0, kitchenLevel: 0 };
  game.materials ??= { wood: 0, stone: 0, ore: 0 };

  const currentLv = game.facility[facilityKey] ?? 0;
  if (currentLv >= MAX_FACILITY_LEVEL) return;

  const nextPlan = facilityDef.levels.find(l => l.level === currentLv + 1);
  if (!nextPlan) return;

  // 素材とお肉の所持数チェック
  for (const [itemKey, needed] of Object.entries(nextPlan.cost)) {
    const owned = ["wood", "stone", "ore"].includes(itemKey)
      ? (game.materials[itemKey] ?? 0)
      : (game.foods[itemKey] ?? 0);

    if (owned < needed) {
      alert(`素材が足りません！\n必要素材：${nextPlan.costText}`);
      return;
    }
  }

  // 消費してレベルアップ
  for (const [itemKey, needed] of Object.entries(nextPlan.cost)) {
    if (["wood", "stone", "ore"].includes(itemKey)) {
      game.materials[itemKey] -= needed;
    } else {
      game.foods[itemKey] -= needed;
    }
  }
  game.facility[facilityKey] = nextPlan.level;

  addLog(`⛺ 【設備強化】「${facilityDef.icon} ${facilityDef.name}」が Lv.${nextPlan.level} になった！（${nextPlan.effectText}）`);
  update();
}

// 🗿 古代のモニュメント（無限強化）
function handleUpgradeMonument() {
  if (!canAct()) return;

  const isAllMax = FACILITIES.every(f => (game.facility?.[f.key] ?? 0) >= MAX_FACILITY_LEVEL);
  if (!isAllMax) {
    alert("基本の4施設すべてを Lv.MAX にすると解放されます！");
    return;
  }

  game.facility ??= { incubatorLevel: 0, trainingLevel: 0, kitchenLevel: 0, arenaLevel: 0, monumentLevel: 0 };
  game.materials ??= { wood: 0, stone: 0, ore: 0 };

  const currentLv = game.facility.monumentLevel ?? 0;
  const plan = getMonumentUpgradeCost(currentLv);

  if ((game.materials.wood ?? 0) < plan.wood || (game.materials.stone ?? 0) < plan.stone || (game.materials.ore ?? 0) < plan.ore) {
    alert(`素材が足りません！\n必要素材：${plan.costText}`);
    return;
  }

  game.materials.wood -= plan.wood;
  game.materials.stone -= plan.stone;
  game.materials.ore -= plan.ore;
  game.facility.monumentLevel = plan.nextLv;

  const totalBonus = plan.nextLv * 2;
  addLog(`🗿 【無限強化】「古代のモニュメント」が Lv.${plan.nextLv} に到達！（全ステータス +${totalBonus}%）`);
  update();
}

// 🔨 古代工房でのアイテムクラフト
function handleCraftItem(recipeId) {
  if (!canAct()) return;

  const isAllMax = FACILITIES.every(f => (game.facility?.[f.key] ?? 0) >= MAX_FACILITY_LEVEL);
  if (!isAllMax) {
    alert("基本の4施設すべてを Lv.MAX にすると解放されます！");
    return;
  }

  const recipe = CRAFT_RECIPES.find(r => r.id === recipeId);
  if (!recipe) return;

  game.materials ??= { wood: 0, stone: 0, ore: 0 };
  game.items ??= {};

  // 素材チェック
  for (const [key, needed] of Object.entries(recipe.cost)) {
    const owned = ["wood", "stone", "ore"].includes(key)
      ? (game.materials[key] ?? 0)
      : (game.foods[key] ?? 0);
    if (owned < needed) {
      alert(`素材が足りません！\n必要素材：${recipe.costText}`);
      return;
    }
  }

  // 素材消費
  for (const [key, needed] of Object.entries(recipe.cost)) {
    if (["wood", "stone", "ore"].includes(key)) {
      game.materials[key] -= needed;
    } else {
      game.foods[key] -= needed;
    }
  }

  let newTotal = 0;
  let itemLabel = "";

  // アイテム付与
  if (recipeId === "craft_crystal") {
    game.items.breedCrystal = (game.items.breedCrystal ?? 0) + 3;
    game.stats.crystalsEarned = (game.stats.crystalsEarned ?? 0) + 3;
    newTotal = game.items.breedCrystal;
    itemLabel = "💎 生命の結晶";
  } else if (recipeId === "craft_premium_meat") {
    game.foods.premium = (game.foods.premium ?? 0) + 5;
    newTotal = game.foods.premium;
    itemLabel = "✨ 極上肉";
  } else if (recipeId === "craft_trait_fruit") {
    game.items.traitFruit = (game.items.traitFruit ?? 0) + 1;
    newTotal = game.items.traitFruit;
    itemLabel = "🎲 特性変更の果実";
  } else if (recipeId === "craft_iv_elixir") {
    game.items.ivElixir = (game.items.ivElixir ?? 0) + 1;
    newTotal = game.items.ivElixir;
    itemLabel = "💉 個体値強化の秘薬";
  } else if (recipeId === "craft_size_potion") {
    game.items.sizePotion = (game.items.sizePotion ?? 0) + 1;
    newTotal = game.items.sizePotion;
    itemLabel = "📏 体格変化の薬";
  }

  game.stats.itemsCrafted = (game.stats.itemsCrafted ?? 0) + 1;

  addLog(`🔨 【古代工房】「${recipe.icon} ${recipe.name}」を作成した！（所持数: ${newTotal}個）`);
  alert(`🔨 クラフト完了！\n\n「${recipe.icon} ${recipe.name}」を作成しました！\n現在の${itemLabel}の所持数：${newTotal} 個`);
  update();

}

// 🎲 特性変更の果実を使用
function handleUseTraitFruit(targetDinoId = game.activeDinoId) {
  if (!canAct()) return;
  if ((game.items?.traitFruit ?? 0) <= 0) return;

  const targetDino = game.dinos.find(d => d.uid === targetDinoId);
  if (!targetDino) return;

  const rawTraits = traitModule.TRAITS ?? traitModule.default ?? {};
  const traitList = Array.isArray(rawTraits) ? rawTraits : Object.values(rawTraits);
  const candidates = traitList.filter(t => t.id !== targetDino.trait);
  if (candidates.length === 0) return;

  const oldTrait = getTraitData(targetDino.trait);
  const nextTrait = candidates[Math.floor(Math.random() * candidates.length)];

  const ok = confirm(
    `⚠️ 【貴重品の使用確認】\n` +
    `「🎲 特性変更の果実」を 1個 消費して、${targetDino.name} の特性を変更しますか？\n\n` +
    `現在の特性：${oldTrait.icon} ${oldTrait.name}（${oldTrait.desc}）\n` +
    `※別のランダムな特性へ上書きされます`
  );
  if (!ok) return;

  game.items.traitFruit--;
  game.stats.itemsUsed = (game.stats.itemsUsed ?? 0) + 1;
  targetDino.trait = nextTrait.id;

  const newStats = calculateStats(targetDino);
  targetDino.currentHp = Math.min(newStats.hp, targetDino.currentHp);

  addLog(`🎲 【特性変化】${targetDino.name} の特性が「${oldTrait.name}」から「${nextTrait.icon} ${nextTrait.name}」に変化した！`);
  alert(`🎲 特性が変化しました！\n\n新しい特性：${nextTrait.icon} ${nextTrait.name}\n効果：${nextTrait.desc}`);
  update();
}

// 💉 個体値強化の秘薬を使用（通常個体：上限100 ／ ミュータント：上限150）
function handleUseIvElixir(targetDinoId = game.activeDinoId) {
  if (!canAct()) return;
  if ((game.items?.ivElixir ?? 0) <= 0) return;

  const targetDino = game.dinos.find(d => d.uid === targetDinoId);
  if (!targetDino) return;

  // ミュータントなら上限150、通常個体は上限100
  const maxIv = targetDino.mutant ? 150 : 100;

  if (targetDino.atkIv >= maxIv && targetDino.hpIv >= maxIv && targetDino.spdIv >= maxIv) {
    const extraHint = !targetDino.mutant ? "\n（※突然変異個体【MUTANT】のみ上限150まで強化できます）" : "";
    alert(`${targetDino.name} の個体値（IV）はすでに上限（${maxIv}）に達しています！${extraHint}`);
    return;
  }

  const ok = confirm(
    `⚠️ 【貴重品の使用確認】\n` +
    `「💉 個体値強化の秘薬」を 1個 消費して、${targetDino.name} を強化しますか？\n\n` +
    `現在の個体値：ATK ${targetDino.atkIv} / HP ${targetDino.hpIv} / SPD ${targetDino.spdIv}\n` +
    `※すべての個体値が +10 上昇します（上限${maxIv}）`
  );
  if (!ok) return;

  game.items.ivElixir--;
  game.stats.itemsUsed = (game.stats.itemsUsed ?? 0) + 1;
  targetDino.atkIv = Math.min(maxIv, (targetDino.atkIv ?? 0) + 10);
  targetDino.hpIv = Math.min(maxIv, (targetDino.hpIv ?? 0) + 10);
  targetDino.spdIv = Math.min(maxIv, (targetDino.spdIv ?? 0) + 10);

  const newStats = calculateStats(targetDino);
  targetDino.currentHp = Math.min(newStats.hp, targetDino.currentHp + 50);

  addLog(`💉 【個体値強化】${targetDino.name} のIVが上昇！（ATK:${targetDino.atkIv} / HP:${targetDino.hpIv} / SPD:${targetDino.spdIv}）`);
  alert(`💉 個体値が強化されました！\n\nATK IV: ${targetDino.atkIv} / HP IV: ${targetDino.hpIv} / SPD IV: ${targetDino.spdIv}`);
  update();
}

// 📏 体格変化の薬を使用（確認ポップアップ付き・ランダム変化）
function handleUseSizePotion(targetDinoId = game.activeDinoId) {
  if (!canAct()) return;
  if ((game.items?.sizePotion ?? 0) <= 0) return;

  const targetDino = game.dinos.find(d => d.uid === targetDinoId);
  if (!targetDino) return;

  const allSizes = ["small", "normal", "large", "giant"];
  const candidates = allSizes.filter(s => s !== targetDino.size);
  const nextSize = candidates[Math.floor(Math.random() * candidates.length)];

  const currentLabel = getSizeLabel(targetDino.size);
  const nextLabel = getSizeLabel(nextSize);

  const ok = confirm(
    `⚠️ 【貴重品の使用確認】\n` +
    `「📏 体格変化の薬」を 1個 消費して、${targetDino.name} の体格を変化させますか？\n\n` +
    `現在の体格：${currentLabel}\n` +
    `※小型・中型・大型・巨大の中からランダムで別のサイズに変化します`
  );
  if (!ok) return;

  game.items.sizePotion--;
  game.stats.itemsUsed = (game.stats.itemsUsed ?? 0) + 1;
  targetDino.size = nextSize;

  const newStats = calculateStats(targetDino);
  targetDino.currentHp = Math.min(newStats.hp, targetDino.currentHp);

  addLog(`📏 【体格変化】${targetDino.name} の体格が「${currentLabel}」から「${nextLabel}」に変化した！`);
  alert(`📏 体格が変化しました！\n\n新しい体格：${nextLabel}`);
  update();
}

// 📊 努力値の増減処理（statKey: "atk" | "hp" | "spd", delta: -10 | -1 | +1 | +10）
function handleAdjustEv(statKey, delta) {
  const activeDino = game.dinos.find(d => d.uid === game.activeDinoId);
  if (!activeDino) return;

  activeDino.evEarned = Math.min(100, activeDino.evEarned ?? 0);
  activeDino.ev ??= { atk: 0, hp: 0, spd: 0 };

  const used = (activeDino.ev.atk ?? 0) + (activeDino.ev.hp ?? 0) + (activeDino.ev.spd ?? 0);
  const remaining = Math.max(0, activeDino.evEarned - used);
  const currentVal = activeDino.ev[statKey] ?? 0;

  if (delta > 0) {
    const add = Math.min(delta, remaining);
    if (add <= 0) return;
    activeDino.ev[statKey] = currentVal + add;
  } else if (delta < 0) {
    const sub = Math.min(-delta, currentVal);
    if (sub <= 0) return;
    activeDino.ev[statKey] = currentVal - sub;
  }

  // 最大HP変動に合わせて現在HPを上限内に収める
  const newStats = calculateStats(activeDino);
  activeDino.currentHp = Math.min(newStats.hp, activeDino.currentHp);

  update();
}

// 📊 努力値振り分けのリセット（確認ポップアップ付き）
function handleResetEv() {
  const activeDino = game.dinos.find(d => d.uid === game.activeDinoId);
  if (!activeDino || !activeDino.ev) return;

  const used = (activeDino.ev.atk ?? 0) + (activeDino.ev.hp ?? 0) + (activeDino.ev.spd ?? 0);
  if (used === 0) return;

  const ok = confirm(
    `↺ ${activeDino.name} の努力値振り分け（計 ${used}pt）をリセットしますか？\n` +
    `※獲得済みのポイントはすべて手元に戻ります`
  );
  if (!ok) return;

  activeDino.ev = { atk: 0, hp: 0, spd: 0 };
  const newStats = calculateStats(activeDino);
  activeDino.currentHp = Math.min(newStats.hp, activeDino.currentHp);

  update();
}

// 現在の周回数に応じた敵ステータス倍率（1周目:1倍, 2周目:2.2倍, 3周目:4.84倍...）
function getLoopStatMultiplier() {
  const loop = game.worldLoop ?? 1;
  return Math.pow(2.2, loop - 1);
}

// 現在の周回数に応じた経験値倍率（1周目:1倍, 2周目:1.6倍, 3周目:2.56倍...）
function getLoopExpMultiplier() {
  const loop = game.worldLoop ?? 1;
  return Math.pow(1.6, loop - 1);
}

// 🌌 次の周回へ進む処理
function handleAdvanceWorldLoop() {
  if (!canAct()) return;
  if (!game.bossCleared?.[6] || isAutoExploring) return;

  const currentLoop = game.worldLoop ?? 1;
  const nextLoop = currentLoop + 1;

  const ok = confirm(
    `🌌 【次の周回へ進む】\n` +
    `現在（${currentLoop}周目）のエリア進行度をリセットし、「${nextLoop}周目」へ進みますか？\n\n` +
    `・敵とボスの強さがさらに上昇します（初回撃破報酬も復活！）\n` +
    `・恐竜、卵、アイテム、設備、秘宝、遠征部隊枠はすべて引き継がれます`
  );
  if (!ok) return;

  game.worldLoop = nextLoop;
  game.stats.maxWorldLoop = Math.max(game.stats.maxWorldLoop ?? 1, nextLoop);

  // エリア進行状況のみリセット
  game.unlockedAreaLevel = 1;
  game.selectedAreaLevel = 1;
  game.areaProgress = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  game.areaCleared = { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
  game.bossCleared = { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };

  addLog(`==============================`);
  addLog(`🌌 【新世界到達！】「${nextLoop}周目」の冒険が幕を開けた！`);
  addLog(`==============================`);

  update();
}

// 現在のガチャ最高出現世代を計算（最低F5、所持恐竜や到達最高世代がそれ以上ならそちらを採用）
function getGachaMaxGeneration() {
  const highestOwned = game.dinos.reduce((max, d) => Math.max(max, d.generation ?? 0), 0);
  const recordMax = game.stats?.maxGeneration ?? 0;
  return Math.max(5, highestOwned, recordMax);
}

function getPremiumGachaGenRange() {
  const loop = Math.max(3, game.worldLoop ?? 1);
  const minGen = loop;
  const highestOwned = game.dinos.reduce((max, d) => Math.max(max, d.generation ?? 0), 0);
  const recordMax = game.stats?.maxGeneration ?? 0;
  const maxGen = Math.max(loop + 2, highestOwned, recordMax);
  return { minGen, maxGen };
}

// ガチャから1体の恐竜を生成するヘルパー
function rollGachaDino(isPremium = false) {
  const discoveredSet = new Set(game.discoveredSpecies ?? []);
  const normalPool = DINO_SPECIES.filter(d => discoveredSet.has(d.id));
  const specialPool = SPECIAL_BREEDS
    .filter(b => discoveredSet.has(b.result.id))
    .map(b => b.result);

  let pool = [...normalPool, ...specialPool];
  if (pool.length === 0) {
    pool = [DINO_SPECIES.at(0)];
  }

  const base = pool[Math.floor(Math.random() * pool.length)];

  // レア度抽選
  const rRoll = Math.random();
  let rarityType = "white";
  if (isPremium) {
    // 高級ガチャ：白なし（虹25% / 紫40% / 青35%）
    rarityType =
      rRoll < 0.25 ? "rainbow" :
      rRoll < 0.65 ? "purple" : "blue";
  } else {
    // 通常ガチャ（虹7% / 紫18% / 青30% / 白45%）
    rarityType =
      rRoll < 0.07 ? "rainbow" :
      rRoll < 0.25 ? "purple" :
      rRoll < 0.55 ? "blue" : "white";
  }

  // 体格抽選（高級ガチャは小型が出ない）
  const sizes = isPremium ? ["normal", "large", "giant"] : ["small", "normal", "large", "giant"];
  const size = sizes[Math.floor(Math.random() * sizes.length)];

  // 体色抽選（高級ガチャは希少体色45%）
  const cRoll = Math.random();
  const color = isPremium
    ? (cRoll < 0.12 ? "rainbow" : cRoll < 0.28 ? "gold" : cRoll < 0.45 ? "blue" : "normal")
    : (cRoll < 0.06 ? "rainbow" : cRoll < 0.16 ? "gold" : cRoll < 0.28 ? "blue" : "normal");

  // 突然変異（高級ガチャは25%、通常は12%）
  const mutant = Math.random() < (isPremium ? 0.25 : 0.12);

  // 特性抽選
  const rawTraits = traitModule.TRAITS ?? traitModule.default ?? {};
  const traitList = Array.isArray(rawTraits) ? rawTraits : Object.values(rawTraits);
  const pickedTrait = traitList.length > 0
    ? traitList[Math.floor(Math.random() * traitList.length)].id
    : "brave";

  // 世代とレベル上限ボーナスを決定
  let generation = 0;
  if (isPremium) {
    const { minGen, maxGen } = getPremiumGachaGenRange();
    generation = minGen + Math.floor(Math.random() * (maxGen - minGen + 1));
  } else {
    const maxGen = getGachaMaxGeneration();
    generation = Math.floor(Math.random() * (maxGen + 1));
  }

  const genBaseMax = 20 + generation * 5;
  const maxAllowedBonus = generation * 10;
  const bonus = isPremium
    ? maxAllowedBonus
    : Math.floor(Math.random() * (maxAllowedBonus + 1));
  const maxLevel = genBaseMax + bonus;

  const uid = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `gacha-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // 高級ガチャは最低個体値40保証
  const minIv = isPremium ? 40 : 0;
  const rollIv = () => minIv + Math.floor(Math.random() * (101 - minIv));

  const dino = {
    uid,
    speciesId: base.id,
    name: base.name,
    sex: Math.random() < 0.5 ? "male" : "female",
    level: 1,
    maxLevel,
    exp: 0,
    rarityType,
    size,
    color,
    mutant,
    trait: pickedTrait,
    generation,
    baseAtk: base.baseAtk,
    baseHp: base.baseHp,
    baseSpd: base.baseSpd,
    atkIv: rollIv(),
    hpIv: rollIv(),
    spdIv: rollIv(),
    currentHp: 1,
    locked: false
  };

  const stats = calculateStats(dino);
  dino.currentHp = stats.hp;
  return dino;
}

// 🎰 ガチャ実行処理（1回 or 10回）
function handleRollGacha(times = 1, isPremium = false) {
  if (!canAct()) return;

  if (isPremium && (game.worldLoop ?? 1) < 3) {
    alert("👑 高級ガチャは「3周目」に到達すると解放されます！");
    return;
  }

  const unitCost = isPremium ? 100 : 10;
  const cost = times * unitCost;
  const ownedCrystals = game.items?.breedCrystal ?? 0;

  if (ownedCrystals < cost) {
    alert(`💎「生命の結晶」が足りません！（必要数: ${cost}個 / 所持: ${ownedCrystals}個）`);
    return;
  }

  game.items.breedCrystal -= cost;
  game.stats.gachaRolls = (game.stats.gachaRolls ?? 0) + times;

  const results = [];
  for (let i = 0; i < times; i++) {
    const dino = rollGachaDino(isPremium);
    game.dinos.push(dino);
    if (!game.activeDinoId) game.activeDinoId = dino.uid;

    game.stats.eggsHatched++;
    if (dino.mutant) game.stats.mutantsBorn++;
    game.stats.maxGeneration = Math.max(game.stats.maxGeneration ?? 0, dino.generation);

    results.push(dino);
  }

  lastGachaResults = results;
  const label = isPremium ? "👑 高級ガチャ" : "🎰 ガチャ卵";

  if (times === 1) {
    const d = results.at(0);
    const trait = getTraitData(d.trait);
    addLog(`${label}から「${d.name}（F${d.generation} / ${getRarityLabel(d.rarityType)} / ${trait.icon}${trait.name}）」を召喚した！`);
  } else {
    const rainbowCount = results.filter(d => d.rarityType === "rainbow").length;
    const purpleCount = results.filter(d => d.rarityType === "purple").length;
    const mutantCount = results.filter(d => d.mutant).length;
    addLog(`${label}【10連】10体を召喚！（🌈虹:${rainbowCount} / 🟣紫:${purpleCount} / 🧬変異:${mutantCount}）`);
  }

  update();
}

const handlers = {
  onExplore: handleExplore,
  onSelectArea: (level) => {
    game.selectedAreaLevel = level;
    update();
  },
  onFeed: handleFeed,
  onRelease: handleRelease,
  onRename: handleRename,
  onHatchAllWildEggs: () => {
    if (!canAct()) return;
    const now = Date.now();
    const readyEggs = game.wildEggs.filter(e => (e.hatchAt ?? 0) <= now);
    if (readyEggs.length === 0) return;

    const highlights = [];
    let normalCount = 0;

    readyEggs.forEach(egg => {
      const dino = hatchStarterEgg(egg);
      const stats = calculateStats(dino);
      if (dino.currentHp == null || Number.isNaN(dino.currentHp)) {
        dino.currentHp = stats.hp;
      }

      const isNewSpecies = !game.discoveredSpecies.includes(dino.speciesId);
      discoverSpecies(dino);

      game.dinos.push(dino);
      if (!game.activeDinoId) game.activeDinoId = dino.uid;

      game.stats.eggsHatched++;
      if (dino.mutant) game.stats.mutantsBorn++;

      const trait = getTraitData(dino.trait);
      const sexMark = dino.sex === "male" ? "♂️" : "♀️";
      const rarityLabel = getRarityLabel(dino.rarityType);
      const isRareColor = dino.color && dino.color !== "normal";
      const isHighRarity = dino.rarityType === "purple" || dino.rarityType === "rainbow";

      // 当たり条件（図鑑NEW・突然変異・希少体色・紫/虹レア）に当てはまる個体だけピックアップ
      if (isNewSpecies || dino.mutant || isRareColor || isHighRarity) {
        const tags = [];
        if (isNewSpecies) tags.push("📖NEW!");
        if (dino.mutant) tags.push("🧬MUTANT");
        if (isRareColor) tags.push(getColorLabel(dino.color));
        const tagStr = tags.length > 0 ? `【${tags.join("・")}】` : "";

        highlights.push(
          `・${tagStr}${dino.name}${sexMark}（${rarityLabel} / ${getSizeLabel(dino.size)} / ${trait.icon}${trait.name}）`
        );
      } else {
        normalCount++;
      }

      // 探索ログには全個体分を記録
      addLog(
        `🐣 野生の卵から「${dino.name}（F0 / ${sexMark} / ${rarityLabel} / ${trait.icon}${trait.name}）」が誕生した！`
      );
      if (isNewSpecies) {
        addLog(`📖 【図鑑新規登録】${dino.name} を発見！`);
      }
    });

    // 孵化済みの卵をリストから除外
    game.wildEggs = game.wildEggs.filter(e => (e.hatchAt ?? 0) > now);

    // コンパクトな結果メッセージの組み立て
    const msgParts = [`🐣 ${readyEggs.length}個の野生の卵が一斉に孵化しました！`];

    if (highlights.length > 0) {
      msgParts.push(`\n✨ 【注目個体】\n${highlights.join("\n")}`);
    }
    if (normalCount > 0) {
      msgParts.push(`\n🦖 ほか ${normalCount}体 が仲間に加わりました！`);
    }

    alert(msgParts.join("\n"));
    update();
  },
  onToggleLock: handleToggleLock,
  onBossBattle: handleBossBattle,
  onUpgradeFacility: handleUpgradeFacility,
  onShowPedigree: handleShowPedigree,
  onToggleExpDraftMember: handleToggleExpDraftMember,
  onSelectExpArea: handleSelectExpArea,
  onStartExpedition: handleStartExpedition,
  onClaimExpedition: handleClaimExpedition,
  onToggleAutoExplore: handleToggleAutoExplore,
  onAdvanceWorldLoop: handleAdvanceWorldLoop,
  onAutoSelectExpMembers: handleAutoSelectExpMembers,
  onUpgradeMonument: handleUpgradeMonument,
  onToggleRainbowMode: handleToggleRainbowMode,
  onToggleRainbowPick: handleToggleRainbowPick,
  onExecuteRainbowConvert: handleExecuteRainbowConvert,
  onSelectAllFilteredRainbows: handleSelectAllFilteredRainbows,
  onClearRainbowPicks: handleClearRainbowPicks,
  onCraftItem: handleCraftItem,
  onAdjustEv: handleAdjustEv,
  onResetEv: handleResetEv,
  onRollGacha: (times, isPremium = false) => handleRollGacha(times, isPremium),
  onUseTraitFruit: (dinoId) => handleUseTraitFruit(typeof dinoId === "string" ? dinoId : game.activeDinoId),
  onUseIvElixir: (dinoId) => handleUseIvElixir(typeof dinoId === "string" ? dinoId : game.activeDinoId),
  onUseSizePotion: (dinoId) => handleUseSizePotion(typeof dinoId === "string" ? dinoId : game.activeDinoId),
  onSetActive: (dinoId) => {
    if (getBusyExpeditionDinoIds().has(dinoId)) {
      alert("🏕️ 遠征中の恐竜は育成パートナーに設定できません！帰還を待ってください。");
      return;
    }

    // 遠征の編成下書き（出発前）に入っていたら外す
    if (game.expeditionDraft?.memberIds) {
      game.expeditionDraft.memberIds = game.expeditionDraft.memberIds.filter(id => id !== dinoId);
    }

    game.activeDinoId = dinoId;
    isAutoExploring = false;
    update();
  },
  onSelectBreed: (dinoId) => {
    if (getBusyExpeditionDinoIds().has(dinoId)) return;

    const dino = game.dinos.find(d => d.uid === dinoId);
    if (!dino) return;

    if (dino.sex === "male") {
      selectedMale = selectedMale === dinoId ? null : dinoId;
    } else if (dino.sex === "female") {
      selectedFemale = selectedFemale === dinoId ? null : dinoId;
    }

    update();
  },
  onHatchBreedingEgg: (eggId) => {
    if (!canAct()) return;
    const index = game.breedingEggs.findIndex(e => e.id === eggId);
    if (index === -1) return;

    const egg = game.breedingEggs[index];
    const child = egg.child;

    // currentHp が未設定・NaN の場合は最大HPで初期化
    const stats = calculateStats(child);
    if (child.currentHp == null || Number.isNaN(child.currentHp)) {
      child.currentHp = stats.hp;
    }

    // 図鑑未登録かチェックしてから登録
    const isNewSpecies = !game.discoveredSpecies.includes(child.speciesId);
    discoverSpecies(child);

    game.dinos.push(child);
    if (!game.activeDinoId) game.activeDinoId = child.uid;

    game.stats.eggsHatched++;
    if (child.mutant) game.stats.mutantsBorn++;
    game.stats.maxGeneration = Math.max(game.stats.maxGeneration, child.generation ?? 0);

    game.breedingEggs.splice(index, 1);

    // 誕生メッセージの組み立て
    const trait = getTraitData(child.trait);
    const sexLabel = child.sex === "male" ? "♂️ オス" : "♀️ メス";
    const rarityLabel = getRarityLabel(child.rarityType);
    const sizeLabel = getSizeLabel(child.size);
    const colorLabel = getColorLabel(child.color);

    const highlights = [];
    if (isNewSpecies) highlights.push("📖 【図鑑新規登録！】");
    if (child.mutant) highlights.push("🧬 【突然変異（MUTANT）誕生！】");
    if (child.color && child.color !== "normal") highlights.push(`✨ 【希少体色：${colorLabel}】`);

    const highlightText = highlights.length > 0 ? `\n${highlights.join("\n")}\n` : "";

    addLog(
      `🐣 交配卵から「${child.name}（F${child.generation ?? 0} / ${sexLabel} / ${rarityLabel} / ${trait.icon}${trait.name}）」が誕生した！`
    );
    if (isNewSpecies) {
      addLog(`📖 【図鑑新規登録】${child.name} を発見！`);
    }

    alert(
      `🐣 交配卵が孵化しました！\n` +
      `${highlightText}\n` +
      `・種族：${child.name}（F${child.generation ?? 0} / ${sexLabel}）\n` +
      `・レア度：${rarityLabel} ／ レベル上限：Lv.${child.maxLevel}\n` +
      `・体格：${sizeLabel} ／ 体色：${colorLabel}\n` +
      `・特性：${trait.icon} ${trait.name}（${trait.desc}）\n` +
      `・個体値：ATK ${child.atkIv} / HP ${child.hpIv} / SPD ${child.spdIv}`
    );

    update();
  },
  onHatchWildEgg: (eggId) => {
    if (!canAct()) return;
    const index = game.wildEggs.findIndex(e => e.id === eggId);
    if (index === -1) return;

    const egg = game.wildEggs[index];
    if ((egg.hatchAt ?? 0) > Date.now()) return;

    const dino = hatchStarterEgg(egg);
    const stats = calculateStats(dino);
    if (dino.currentHp == null || Number.isNaN(dino.currentHp)) {
      dino.currentHp = stats.hp;
    }

    const isNewSpecies = !game.discoveredSpecies.includes(dino.speciesId);
    discoverSpecies(dino);

    game.dinos.push(dino);
    if (!game.activeDinoId) game.activeDinoId = dino.uid;

    game.stats.eggsHatched++;
    if (dino.mutant) game.stats.mutantsBorn++;

    game.wildEggs.splice(index, 1);

    // 詳細メッセージの組み立て
    const trait = getTraitData(dino.trait);
    const sexLabel = dino.sex === "male" ? "♂️ オス" : "♀️ メス";
    const rarityLabel = getRarityLabel(dino.rarityType);
    const sizeLabel = getSizeLabel(dino.size);
    const colorLabel = getColorLabel(dino.color);
    const maxLv = dino.maxLevel ?? 20;

    const highlights = [];
    if (isNewSpecies) highlights.push("📖 【図鑑新規登録！】");
    if (dino.mutant) highlights.push("🧬 【突然変異（MUTANT）誕生！】");
    if (dino.color && dino.color !== "normal") highlights.push(`✨ 【希少体色：${colorLabel}】`);

    const highlightText = highlights.length > 0 ? `\n${highlights.join("\n")}\n` : "";

    addLog(
      `🐣 野生の卵から「${dino.name}（F0 / ${sexLabel} / ${rarityLabel} / ${trait.icon}${trait.name}）」が誕生した！`
    );
    if (isNewSpecies) {
      addLog(`📖 【図鑑新規登録】${dino.name} を発見！`);
    }

    alert(
      `🐣 野生の卵が孵化しました！\n` +
      `${highlightText}\n` +
      `・種族：${dino.name}（F0 / ${sexLabel}）\n` +
      `・レア度：${rarityLabel} ／ レベル上限：Lv.${maxLv}\n` +
      `・体格：${sizeLabel} ／ 体色：${colorLabel}\n` +
      `・特性：${trait.icon} ${trait.name}（${trait.desc}）\n` +
      `・個体値：ATK ${dino.atkIv} / HP ${dino.hpIv} / SPD ${dino.spdIv}`
    );

    update();
  },
  onHatchAllBreedingEggs: () => {
    if (!canAct()) return;
    const now = Date.now();
    const readyEggs = game.breedingEggs.filter(e => (e.hatchAt ?? 0) <= now);
    if (readyEggs.length === 0) return;

    const highlights = [];
    let normalCount = 0;

    readyEggs.forEach(egg => {
      const child = egg.child;
      const stats = calculateStats(child);
      if (child.currentHp == null || Number.isNaN(child.currentHp)) {
        child.currentHp = stats.hp;
      }

      const isNewSpecies = !game.discoveredSpecies.includes(child.speciesId);
      discoverSpecies(child);

      game.dinos.push(child);
      if (!game.activeDinoId) game.activeDinoId = child.uid;

      game.stats.eggsHatched++;
      if (child.mutant) game.stats.mutantsBorn++;
      game.stats.maxGeneration = Math.max(game.stats.maxGeneration, child.generation ?? 0);

      const trait = getTraitData(child.trait);
      const sexMark = child.sex === "male" ? "♂️" : "♀️";
      const rarityLabel = getRarityLabel(child.rarityType);
      const isRareColor = child.color && child.color !== "normal";
      const isRainbow = child.rarityType === "rainbow";

      // 図鑑NEW・突然変異・希少体色・虹レアをピックアップ表示
      if (isNewSpecies || child.mutant || isRareColor || isRainbow) {
        const tags = [];
        if (isNewSpecies) tags.push("📖NEW!");
        if (child.mutant) tags.push("🧬MUTANT");
        if (isRareColor) tags.push(getColorLabel(child.color));
        const tagStr = tags.length > 0 ? `【${tags.join("・")}】` : "";

        highlights.push(
          `・${tagStr}${child.name}(F${child.generation ?? 0})${sexMark}（${rarityLabel} / ${getSizeLabel(child.size)} / ${trait.icon}${trait.name}）`
        );
      } else {
        normalCount++;
      }

      addLog(
        `🐣 交配卵から「${child.name}（F${child.generation ?? 0} / ${sexMark} / ${rarityLabel} / ${trait.icon}${trait.name}）」が誕生した！`
      );
      if (isNewSpecies) {
        addLog(`📖 【図鑑新規登録】${child.name} を発見！`);
      }
    });

    // 孵化済みの交配卵を除外
    game.breedingEggs = game.breedingEggs.filter(e => (e.hatchAt ?? 0) > now);

    const msgParts = [`🐣 ${readyEggs.length}個の交配卵が一斉に孵化しました！`];
    if (highlights.length > 0) {
      msgParts.push(`\n✨ 【注目個体】\n${highlights.join("\n")}`);
    }
    if (normalCount > 0) {
      msgParts.push(`\n🦖 ほか ${normalCount}体 が仲間に加わりました！`);
    }

    alert(msgParts.join("\n"));
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
  }
};

// 画面更新とセーブをまとめて行う関数
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
      gachaMaxGen: getGachaMaxGeneration(),
      premiumGachaRange: getPremiumGachaGenRange(),
      isRainbowSelectMode,
      selectedRainbowIds,
      getRainbowCrystalReturn,
    },
    handlers
  );
  saveGame(game);
}

// --- 固定ボタンのイベント登録 ---

document.getElementById("breedBtn")?.addEventListener("click", () => executeBreed(1));
document.getElementById("breed10Btn")?.addEventListener("click", () => executeBreed(10));

// タブ切り替え処理
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    // すべてのボタンとパネルから active を外す
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));

    // クリックされたタブと対応するパネルに active を付ける
    btn.classList.add("active");
    const targetPanel = document.getElementById(btn.dataset.tab);
    if (targetPanel) {
      targetPanel.classList.add("active");
    }
  });
});

document.getElementById("filterType")?.addEventListener("change", (e) => {
  filterType = e.target.value;
  update();
});

document.getElementById("resetSave")?.addEventListener("click", () => {
  localStorage.clear();
  location.reload();
});

document.getElementById("filterSpecies")?.addEventListener("change", (e) => {
  filterSpecies = e.target.value;
  update();
});

document.getElementById("filterSex")?.addEventListener("change", (e) => {
  filterSex = e.target.value;
  update();
});

document.getElementById("filterRarity")?.addEventListener("change", (e) => {
  filterRarity = e.target.value;
  update();
});

document.getElementById("filterGen")?.addEventListener("change", (e) => {
  filterGen = e.target.value;
  update();
});

document.getElementById("filterLock")?.addEventListener("change", (e) => {
  filterLock = e.target.value;
  update();
});

document.getElementById("filterAchievement")?.addEventListener("change", (e) => {
  filterAchievement = e.target.value;
  update();
});

document.getElementById("filterDex")?.addEventListener("change", (e) => {
  filterDex = e.target.value;
  update();
});

document.getElementById("filterDexType")?.addEventListener("change", (e) => {
  filterDexType = e.target.value;
  update();
});

document.getElementById("sortBy")?.addEventListener("change", (e) => {
  sortBy = e.target.value;
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

  // 画面上の入力欄・セレクトボックスの見た目も初期値に戻す
  const nameInput = document.getElementById("filterName");
  const speciesSelect = document.getElementById("filterSpecies");
  const sexSelect = document.getElementById("filterSex");
  const typeSelect = document.getElementById("filterType");
  const raritySelect = document.getElementById("filterRarity");
  const genSelect = document.getElementById("filterGen");
  const lockSelect = document.getElementById("filterLock");
  const sortSelect = document.getElementById("sortBy");

  if (nameInput) nameInput.value = "";
  if (speciesSelect) speciesSelect.value = "all";
  if (sexSelect) sexSelect.value = "all";
  if (typeSelect) typeSelect.value = "all";
  if (raritySelect) raritySelect.value = "all";
  if (genSelect) genSelect.value = "all";
  if (lockSelect) lockSelect.value = "all";
  if (sortSelect) sortSelect.value = "default";

  update();
});

document.getElementById("filterName")?.addEventListener("input", (e) => {
  filterName = e.target.value;
  update();
});

// 探索ログのクリアボタン
document.getElementById("clearLogBtn")?.addEventListener("click", () => {
  if (game.huntLogs.length === 0) return;
  game.huntLogs = [];
  update();
});

// 一括お別れボタン
document.getElementById("bulkReleaseBtn")?.addEventListener("click", handleBulkRelease);

// セーブ・ロード用モーダル制御
const backupModal = document.getElementById("backupModal");
const backupTitle = document.getElementById("backupModalTitle");
const backupDesc = document.getElementById("backupModalDesc");
const backupTextArea = document.getElementById("backupTextArea");
const backupCopyBtn = document.getElementById("backupCopyBtn");
const backupExecLoadBtn = document.getElementById("backupExecLoadBtn");

// 📤 セーブ（書き出し）ボタン
document.getElementById("exportSaveBtn")?.addEventListener("click", () => {
  try {
    saveGame(game);
    // ログ履歴を除いてデータサイズをコンパクト化
    const exportObj = { ...game, huntLogs: [] };
    const jsonStr = JSON.stringify(exportObj);
    const bytes = new TextEncoder().encode(jsonStr);
    let binStr = "";
    bytes.forEach(b => { binStr += String.fromCharCode(b); });
    const encoded = btoa(binStr);

    backupTitle.textContent = "📤 セーブデータの書き出し";
    backupDesc.textContent = "下の文字列をすべてコピーして、メモ帳や別の端末に貼り付けてください。";
    backupTextArea.value = encoded;
    backupTextArea.readOnly = true;

    backupCopyBtn.style.display = "inline-block";
    backupExecLoadBtn.style.display = "none";
    backupModal.style.display = "flex";

    backupTextArea.focus();
    backupTextArea.select();
  } catch (e) {
    alert("❌ セーブデータの書き出しに失敗しました。");
    console.error(e);
  }
});

// 📋 モーダル内のコピーボタン
backupCopyBtn?.addEventListener("click", async () => {
  backupTextArea.select();
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(backupTextArea.value);
    } else {
      document.execCommand("copy");
    }
    alert("📋 クリップボードにコピーしました！");
  } catch {
    alert("テキストを選択状態にしました。手動でコピー（Ctrl+C / 長押しコピー）してください。");
  }
});

// 📥 ロード（読み込み）ボタン
document.getElementById("importSaveBtn")?.addEventListener("click", () => {
  backupTitle.textContent = "📥 セーブデータの読み込み";
  backupDesc.textContent = "書き出したセーブ文字列を下の枠に貼り付けて「このデータで復元する」を押してください。";
  backupTextArea.value = "";
  backupTextArea.readOnly = false;

  backupCopyBtn.style.display = "none";
  backupExecLoadBtn.style.display = "inline-block";
  backupModal.style.display = "flex";
  backupTextArea.focus();
});

// ✅ 復元実行ボタン
backupExecLoadBtn?.addEventListener("click", () => {
  const rawInput = backupTextArea.value.trim();
  if (!rawInput) {
    alert("セーブ文字列が入力されていません。");
    return;
  }

  try {
    // 改行や空白が混ざっていても除去して復元
    const cleanBase64 = rawInput.replace(/\s+/g, "");
    const binStr = atob(cleanBase64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(jsonStr);

    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.dinos)) {
      alert("❌ 無効なセーブデータです。文字列がすべて貼り付けられているか確認してください。");
      return;
    }

    const ok = confirm(
      `⚠️ 現在のデータを上書きして復元しますか？\n（復元データの所持恐竜数: ${parsed.dinos.length}体）`
    );
    if (!ok) return;

    // 👇 メモリ上の game 変数の中身も復元データに丸ごと入れ替える（自動保存による上書き防止）
    Object.keys(game).forEach(key => delete game[key]);
    Object.assign(game, parsed);

    saveGame(game);
    alert("✅ セーブデータを復元しました！画面を再読み込みします。");
    location.reload();

  } catch (e) {
    alert("❌ 読み込みに失敗しました。\n古い形式の文字列か、途中で文字列が欠けている可能性があります。");
    console.error(e);
  }
});

// 閉じるボタン
document.getElementById("backupCloseBtn")?.addEventListener("click", () => {
  backupModal.style.display = "none";
});

// 特性バッジをタップしたときに効果説明を表示（スマホ対応）
document.addEventListener("click", (e) => {
  const badge = e.target.closest(".badge-trait[data-trait-desc]");
  if (!badge) return;

  e.stopPropagation();
  alert(`【特性】${badge.dataset.traitName}\n\n効果：${badge.dataset.traitDesc}`);
});

// 📊 タイプ相性ボタンのポップアップ表示（スマホ・PC共通）
document.getElementById("typeChartBtn")?.addEventListener("click", () => {
  alert(
    `📊 【タイプ相性 ＆ 地形ルール】\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔄 三すくみ相性\n` +
    `🍖 肉食 ＞ 🌿 草食 ＞ 🦅 翼竜 ＞ 🍖 肉食\n\n` +
    `・有利タイプ：与ダメージ 1.3倍 ＆ 被ダメージ 40%軽減\n` +
    `・不利タイプ：与ダメージ 0.6倍 ＆ 被ダメージ 1.3倍\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🌊 海生タイプ ＆ 海エリア補正\n` +
    `・🌊 海生タイプは三すくみの影響を受けません\n` +
    `・海エリア：🌊 海生は能力 1.35倍 ／ 海生以外は 0.75倍\n` +
    `・陸エリア：🌊 海生は能力 0.75倍`
  );
});

// 世代バッジ・レア度バッジをタップしたときに詳細を表示（スマホ・PC共通）
document.addEventListener("click", (e) => {
  const badge = e.target.closest("[data-badge-desc]");
  if (!badge) return;

  e.stopPropagation();
  alert(`${badge.dataset.badgeTitle}\n━━━━━━━━━━━━━━━━━━━━\n${badge.dataset.badgeDesc}`);
});

// 📖 早見表モーダル制御（特性一覧 ＆ 特殊交配レシピ）
const guideModal = document.getElementById("guideModal");
const guideModalTitle = document.getElementById("guideModalTitle");
const guideModalBody = document.getElementById("guideModalBody");

function openGuideModal(title, html) {
  if (!guideModal || !guideModalTitle || !guideModalBody) return;
  guideModalTitle.textContent = title;
  guideModalBody.innerHTML = html;
  guideModalBody.scrollTop = 0;
  guideModal.style.display = "flex";
}

// 💡 汎用Tipsデータ（ここにキーを追加するだけでどの画面でも使い回せます）
const TIPS_DATA = {
  dinos_guide: {
    title: "💡 恐竜一覧・保護ロック・結晶還元の仕組み",
    items: [
      {
        title: "1. 保護ロック（🔒）と自動保護ルール",
        desc: "🔒ボタンを押してロックした恐竜は、個別のお別れ・一括整理・虹レア還元のすべてから保護されます。また、育成中・遠征中・交配選択中・ミュータント・希少体色も自動で保護されます。"
      },
      {
        title: "2. 貴重品（🎲 果実 ／ 💉 秘薬）の直接強化",
        desc: "各カードの下部ボタンから、メイン交代なしで直接「特性変更の果実」や「個体値強化の秘薬（通常上限100 / 変異体上限150）」を使えます。"
      },
      {
        title: "3. 余った虹レアの結晶還元",
        desc: "「💎 虹レアを選んで還元する」を押すと還元モードになり、不要な虹レアを「💎 生命の結晶（5〜15個）」へ変換できます。絞り込み後の「☑️ 表示中を一括選択」も便利です。"
      }
    ]
  },

  facility_guide: {
    title: "💡 拠点設備・モニュメント・古代工房の仕組み",
    items: [
      {
        title: "1. 基本4施設のアップグレード効果",
        desc: "遠征で集めた建築素材（木材・石材・鉱石）とお肉を納品すると、孵化時間短縮・待機EXP増加・エサ回復量UP・全ステータス強化などの永続バフが得られます。"
      },
      {
        title: "2. 🗿 古代のモニュメント（無限強化）",
        desc: "基本の4施設すべてを Lv.MAX にすると解放されます。素材を捧げるたびに全恐竜の攻撃・HP・素早さが +2% ずつ上限なしで上昇します。"
      },
      {
        title: "3. 🔨 古代工房（素材クラフト）",
        desc: "同じく4施設すべてが Lv.MAX で解放されます。余った素材から「生命の結晶」「極上肉」「特性変更の果実」「個体値強化の秘薬」を作成できます。"
      },
      {
        title: "4. 🏺 古代の秘宝（永続パッシブ効果）",
        desc: "各エリアの探索中に低確率でドロップする伝説の秘宝です。所持しているだけで全恐竜に永続バフがかかり、同じ秘宝を再度拾うと自動的にレベルアップ（最大Lv.MAX）します。"
      }
    ]
  },

  gacha_guide: {
    title: "💡 生命の結晶ガチャ・高級ガチャの仕組み",
    items: [
      {
        title: "1. 出現する種族のプール",
        desc: "すでに「📖 恐竜図鑑」に登録済みの種族（通常種＋発見済みの特殊交配種）の中からランダムで召喚されます。図鑑を埋めるほど強力なハイブリッドもガチャから直接狙えます。"
      },
      {
        title: "2. 出現世代（F）とレベル上限",
        desc: "通常ガチャ（結晶10個）は「F0 〜 最高世代（最低F5保証、所持MAXがそれ以上ならその世代まで）」の範囲でランダム出現します。"
      },
      {
        title: "3. 👑 高級ガチャ（3周目以降で解放）",
        desc: "3周目に到達すると解放（結晶100個）。白レアなし・個体値IV40以上保証・さらに「レベル上限ボーナスMAX確定」で、F[周回数]〜F[周回数+2]以上の高世代が排出されます。"
      }
    ]
  },

  dex_guide: {
    title: "💡 恐竜図鑑と特殊交配のヒント",
    items: [
      {
        title: "1. 図鑑登録のタイミングとメリット",
        desc: "スターター卵・野生卵・交配卵が孵化した瞬間に図鑑へ登録されます。一度図鑑に登録された種族は、特殊交配種であっても「🎰 ガチャ卵」の排出対象に加わります。"
      },
      {
        title: "2. 特殊交配レシピのヒント",
        desc: "未発見の特殊交配枠には、親となる2種族の組み合わせヒントが表示されます。交配タブの「🧬 特殊レシピ」一覧からも全17種の組み合わせを確認できます。"
      },
      {
        title: "3. ステータス表示について",
        desc: "図鑑のステータス数値は「F0・白レア・個体値0・Lv.1時点」の基礎種族値です。同じ種族でも体格やレア度、世代を重ねることで大きく成長します。"
      }
    ]
  },
  expedition_guide: {
    title: "💡 遠征の仕組みと報酬アップのコツ",
    items: [
      {
        title: "1. 同時派遣できる部隊枠の増やし方",
        desc: "探索率が 100% に到達したエリアの数だけ、同時に派遣できる部隊枠が増えます（最大6部隊）。2周目以降は最初から全6枠が解放されます。"
      },
      {
        title: "2. チーム戦力による報酬倍率アップ",
        desc: "派遣する1〜3体の合計ステータス（攻撃・HP・素早さ）が高いほど、持ち帰る建築素材や生命の結晶の獲得量が最大 2.5倍 まで増加します。"
      },
      {
        title: "3. 特性「🍀 幸運」の重複ボーナス",
        desc: "特性「🍀 幸運」を持つ恐竜を編成すると、1体につきレア卵や上質素材のドロップ率が +10% 上昇します（3体編成で最大 +30%）。"
      },
      {
        title: "4. 待機メンバーの経験値育成",
        desc: "遠征時間に応じて参加メンバー全員が経験値を獲得します。低レベルの恐竜を戦力の高い恐竜と一緒に派遣すると安全にレベル上げができます。"
      }
    ]
  },

  records_guide: {
    title: "💡 実績・周回・エンドコンテンツの案内",
    items: [
      {
        title: "1. 実績の達成と自動報酬",
        desc: "条件を満たすと自動で実績が解除され、報酬のお肉や結晶・貴重品アイテムが在庫へ直接加算されます。"
      },
      {
        title: "2. 周回（ワールドループ）の仕組み",
        desc: "エリア6のボス「深海竜王オケアノス」を倒すと次の周回へ進めます。敵の強さが 2.2倍・獲得経験値が 1.6倍 になり、各エリアのボス初回撃破報酬（虹卵・結晶）が復活します。"
      },
      {
        title: "3. やり込み要素の解放条件",
        desc: "・基本の4施設すべてを Lv.MAX にすると「🗿 古代のモニュメント（無限強化）」と「🔨 古代工房（厳選アイテム作成）」が解放されます。\n・3周目に到達するとガチャ卵タブで「👑 高級ガチャ」が解放されます。"
      }
    ]
  },
  explore_battle: {
    title: "💡 バトル・相性・体格の仕組み",
    items: [
      {
        title: "1. 三すくみタイプ相性",
        desc: "🍖 肉食 ＞ 🌿 草食 ＞ 🦅 翼竜 ＞ 🍖 肉食 の関係です。有利タイプには「与ダメージ 1.3倍 ＆ 被ダメージ 40%軽減」、不利タイプには「与ダメージ 0.6倍」になります。"
      },
      {
        title: "2. 海生タイプ ＆ 地形補正",
        desc: "🌊 海生タイプは三すくみの影響を受けません。海エリアでは「🌊 海生は能力 1.35倍 ／ 海生以外は 0.75倍」になり、陸エリアでは「🌊 海生は 0.75倍」に低下します。"
      },
      {
        title: "3. 恐竜のサイズ（体格）補正",
        desc: "体格は「小型 ＜ 中型 ＜ 大型 ＜ 巨大」の4段階です。\n・大きい側：相手より1段階大きいごとに与ダメージ +15%（最大 +45%）\n・小さい側：与ダメージは1段階ごとに -15% になりますが、身軽なため相手より1段階小さいごとに回避率が +5%（最大 +15%）上昇します！"
      },
      {
        title: "4. 💖 親密度ボーナス（最大 +20%）",
        desc: "探索の戦闘勝利（+2）やエサやり（+1）で親密度が上昇します（上限 100）。親密度が上がるほど相棒の与ダメージが増加し、MAX 100 で与ダメージが +20%（1.2倍）になります。"
      },
      {
        title: "5. 📊 努力値（自由振り分け IVボーナス）",
        desc: "探索の戦闘勝利ごとに努力値ポイントが +2 ずつ貯まります（上限 100）。獲得したポイントは相棒カードの「-10 / -1 / +1 / +10」ボタンで攻撃・HP・素早さのIVにいつでも自由に振り分け・リセットができます。"
      }
    ]
  },
  breeding_level: {
    title: "💡 交配とレベル上限の仕組み",
    items: [
      {
        title: "1. 生まれる世代（F）の決まり方",
        desc: "両親のうち「低い方の世代 ＋ 1」になります。（例：F2 × F0 → F1 ／ F2 × F2 → F3）"
      },
      {
        title: "2. 世代ごとの基本レベル上限",
        desc: "F0は Lv.20 から始まり、1世代進むごとに基本上限が +5 ずつ増えます。（F1: Lv.25 / F2: Lv.30 / F3: Lv.35…）"
      },
      {
        title: "3. 親の育成ボーナス（最大 +10）",
        desc: "親のレベルを最大上限まで育ててから交配すると、子供にボーナスが加算されます。（片親MAXで +5、両親MAXで +10）"
      },
      {
        title: "4. 継承ボーナスと世代上限キャップ",
        desc: "両親がすでに持つボーナス（高い方）も引き継がれます。ただし、1世代で持てるボーナス上限は「世代数 × 10」までです。（例：F1は最大+10、F2は最大+20）"
      },
      {
        title: "5. サイズ（体格）の遺伝と変異",
        desc: "両親のサイズ（小型・中型・大型・巨大）の平均をもとに遺伝します。さらに誕生時に「10%で1段階大きく・5%で1段階小さく」サイズ変異が起きるため、大型同士から巨大種を狙うこともできます。"
      }
    ]
  }
};

// 💡 汎用Tipsボタンのクリック処理（静的HTML・動的描画のどちらでも動作）
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".js-open-tip[data-tip-id]");
  if (!btn) return;

  const tip = TIPS_DATA[btn.dataset.tipId];
  if (!tip) return;

  const html = tip.items.map(item => `
    <div class="guide-item">
      <div class="guide-item-title"><strong>${item.title}</strong></div>
      <div class="guide-item-desc">${item.desc}</div>
    </div>
  `).join("");

  openGuideModal(tip.title, html);
});

// ✨ 特性一覧ボタン（探索タブ・交配タブ共通）
document.querySelectorAll(".js-open-traits").forEach(btn => {
  btn.addEventListener("click", () => {
    const rawTraits = traitModule.TRAITS ?? traitModule.default ?? {};
    const traitList = Array.isArray(rawTraits) ? rawTraits : Object.values(rawTraits);

    const listHtml = traitList.map(t => `
      <div class="guide-item">
        <div class="guide-item-title">${t.icon ?? "✨"} <strong>${t.name}</strong></div>
        <div class="guide-item-desc">${t.desc}</div>
      </div>
    `).join("");

    openGuideModal(`✨ 特性一覧（全${traitList.length}種）`, listHtml);
  });
});

// 🧬 特殊交配レシピボタン
document.getElementById("recipeListBtn")?.addEventListener("click", () => {
  const discovered = game.discoveredSpecies ?? [];
  const foundCount = SPECIAL_BREEDS.filter(b => discovered.includes(b.result.id)).length;

  const listHtml = SPECIAL_BREEDS.map((b, idx) => {
    const parent1 = getDefaultSpeciesName(b.parents[0]);
    const parent2 = getDefaultSpeciesName(b.parents[1]);
    const isFound = discovered.includes(b.result.id);
    const resultName = isFound ? `✨ ${b.result.name}` : "❔ 未発見の特殊種";

    return `
      <div class="guide-item ${isFound ? "is-discovered" : ""}">
        <div class="guide-recipe-row">
          <span class="guide-no">#${String(idx + 1).padStart(2, "0")}</span>
          <span class="guide-parents"><strong>${parent1}</strong> × <strong>${parent2}</strong></span>
        </div>
        <div class="guide-result">➡ <strong>${resultName}</strong></div>
      </div>
    `;
  }).join("");

  openGuideModal(
    `🧬 特殊交配レシピ（発見済: ${foundCount} / ${SPECIAL_BREEDS.length}種）`,
    listHtml
  );
});

// 早見表モーダルを閉じる（閉じるボタン ＆ 背景タップ）
document.getElementById("guideCloseTopBtn")?.addEventListener("click", () => {
  if (guideModal) guideModal.style.display = "none";
});

guideModal?.addEventListener("click", (e) => {
  if (e.target === guideModal) {
    guideModal.style.display = "none";
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

    if (givePassiveExp) {
      addExp(dino, totalStandbyExp);
    }
  });
  renderTick(game, handlers);
  saveGame(game);
}, 1000);


// 初回描画
update();
