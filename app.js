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
import { getTraitData } from "./data/traits.js";
import { AREA_BOSSES } from "./data/bosses.js";
import { INCUBATOR_LEVELS, MAX_INCUBATOR_LEVEL, getHatchTimeMultiplier } from "./data/facility.js";
import { AREA_EXPEDITIONS } from "./data/expeditions.js";
import { playExploreSequence } from "./ui/battleStage.js";
import { FACILITIES, MAX_FACILITY_LEVEL, getFacilityBonuses } from "./data/facilities.js";


let game = loadGame();
syncTreasures(game.treasures);
syncFacilities(game.facility);
processOfflineProgress();

if (!game.starterEgg) {
  game.starterEgg = rollStarterEgg();
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
let sortBy = "default";
let lastActionTime = 0;
let tickCounter = 0;
let isAutoExploring = false;

function discoverSpecies(dino) {
  if (!game.discoveredSpecies.includes(dino.speciesId)) {
    game.discoveredSpecies.push(dino.speciesId);
  }
}

function addLog(text) {
  game.huntLogs.unshift(text);
  game.huntLogs = game.huntLogs.slice(0, 100);
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
  const passiveExpGain = Math.floor(effectiveSec / 5) * tBonus.standbyExp;

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
        game.foods[ach.reward.type] = (game.foods[ach.reward.type] ?? 0) + ach.reward.amount;
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

  if (dino.locked) {
    alert(`🔒「${dino.name}」は保護ロック中のためお別れできません！\n先に🔒ボタンを押してロックを解除してください。`);
    return;
  }

  if (getBusyExpeditionDinoIds().has(dino.uid)) {
    alert("🏕️ 遠征中の恐竜とはお別れできません！");
    return;
  }

  if (game.expedition?.active && game.expedition.memberIds.includes(dino.uid)) return false;

  const index = game.dinos.findIndex(d => d.uid === dinoId);
  if (index === -1) return;

  const dino = game.dinos[index];
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
    const enemy = getEnemyForArea(areaLevel);

    const result = battle(activeDino, stats, enemy, isCritical, addLog);
    battleRecords.push({ enemy, win: result.win, isBoss: false });

    if (!result.win) {
      isDefeated = true;
      break;
    }

    winStreak++;
    game.stats.exploreWins++;

    // 連戦ボーナス倍率 ＋ 特性「早熟」ボーナスを反映して経験値計算
    const streakMult = i === 1 ? 1.0 : i === 2 ? 1.2 : 1.5;
    const baseGainedExp = (area.expBonus + activeDino.level) * streakMult;
    const fBonus = getFacilityBonuses(game.facility);
    const gainedExp = Math.floor(baseGainedExp * (activeTraitEffect.allExpMult ?? 1) * (1 + fBonus.expMult));

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

      if (game.dinos.length === 0 && game.wildEggs.length === 0 && game.breedingEggs.length === 0) {
        game.wildEggs.push(createWildEgg("normal", "white", currentHatchMult()));
        addLog(`🥚 拠点の隅から「救済の白卵」が見つかった！`);
      }

      alert(
        `🪦 ${activeDino.name} は瀕死の傷がもとで力尽きました…\n` +
        `形見として「💎 生命の結晶×1」「✨ 極上肉×1」を手に入れました。`
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

  const conditionEl = document.getElementById("bulkReleaseCondition");
  const condition = conditionEl ? conditionEl.value : "white_f0";

  // 1. 条件に合致し、かつ保護対象ではない恐竜を抽出
  const targets = game.dinos.filter(dino => {
    // 絶対保護ルール（育成中・ロック済み・交配選択中・ミュータント・色違いは除外）
    if (dino.locked) return false;
    if (dino.uid === game.activeDinoId) return false;
    if (dino.uid === selectedMale || dino.uid === selectedFemale) return false;
    if (dino.mutant) return false;
    if (dino.color && dino.color !== "normal") return false;
    if (getBusyExpeditionDinoIds().has(dino.uid)) return false;
    if (game.expedition?.active && game.expedition.memberIds.includes(dino.uid)) return false;

    const rarity = dino.rarityType ?? "white";
    const gen = dino.generation ?? 0;

    switch (condition) {
      case "white_f0":
        return rarity === "white" && gen === 0;
      case "white_all":
        return rarity === "white";
      case "blue_f0":
        return (rarity === "white" || rarity === "blue") && gen === 0;
      case "blue_all":
        return rarity === "white" || rarity === "blue";
      default:
        return false;
    }
  });

  if (targets.length === 0) {
    alert("条件に一致する（保護対象外の）恐竜がいませんでした。");
    return;
  }

  // 最後の1体は残す安全策（通常はactiveDinoIdで保護されているが念のため）
  if (game.dinos.length - targets.length < 1) {
    targets.pop();
  }

  // 2. 獲得できるお肉の合計を計算
  const rewardTotals = { raw: 0, good: 0, premium: 0 };
  targets.forEach(dino => {
    const reward = getReleaseReward(dino);
    rewardTotals[reward.type] = (rewardTotals[reward.type] ?? 0) + reward.amount;
  });

  const rewardSummary = [
    rewardTotals.raw > 0 ? `🍖 生肉 ×${rewardTotals.raw}` : "",
    rewardTotals.good > 0 ? `🥩 上質肉 ×${rewardTotals.good}` : "",
    rewardTotals.premium > 0 ? `✨ 極上肉 ×${rewardTotals.premium}` : ""
  ].filter(Boolean).join("、");

  // 3. 事前確認ダイアログ
  const ok = confirm(
    `条件に一致する ${targets.length}体 の恐竜とまとめてお別れしますか？\n` +
    `（育成中・選択中・ミュータント・色違いは保護されています）\n\n` +
    `獲得アイテム合計：${rewardSummary}`
  );
  if (!ok) return;

  // 4. リストから削除して報酬を付与
  const targetIds = new Set(targets.map(d => d.uid));
  game.dinos = game.dinos.filter(d => !targetIds.has(d.uid));

  game.foods.raw = (game.foods.raw ?? 0) + rewardTotals.raw;
  game.foods.good = (game.foods.good ?? 0) + rewardTotals.good;
  game.foods.premium = (game.foods.premium ?? 0) + rewardTotals.premium;

  game.stats.dinosReleased = (game.stats.dinosReleased ?? 0) + targets.length;

  addLog(`👋 ${targets.length}体の恐竜とまとめてお別れし、${rewardSummary} を獲得した！`);
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
  const bossEnemy = { ...boss };
  const result = battle(activeDino, stats, bossEnemy, wasCriticalAtStart, addLog);

  await playExploreSequence(activeDino, areaLevel, [{ enemy: bossEnemy, win: result.win, isBoss: true }]);

  if (!result.win) {
    if (wasCriticalAtStart) {
      // 瀕死出撃で敗北 → 死亡ロスト
      const lostIndex = game.dinos.findIndex(d => d.uid === activeDino.uid);
      if (lostIndex !== -1) game.dinos.splice(lostIndex, 1);

      if (selectedMale === activeDino.uid) selectedMale = null;
      if (selectedFemale === activeDino.uid) selectedFemale = null;
      game.activeDinoId = game.dinos.length > 0 ? game.dinos.uid : null;

      game.stats.dinosLost = (game.stats.dinosLost ?? 0) + 1;
      game.items.breedCrystal = (game.items.breedCrystal ?? 0) + 1;
      game.foods.premium = (game.foods.premium ?? 0) + 1;

      addLog(`🪦 ${activeDino.name} はボス「${boss.name}」の前に力尽きた…`);
      addLog(`💐 形見として「💎 生命の結晶×1」と「✨ 極上肉×1」が残された`);

      if (game.dinos.length === 0 && game.wildEggs.length === 0 && game.breedingEggs.length === 0) {
        game.wildEggs.push(createWildEgg("normal", "white"));
      }
      alert(`🪦 ${activeDino.name} はボスに敗れ力尽きました…`);
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
  const gainedExp = Math.floor(boss.expReward * (traitEffect.allExpMult ?? 1));

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

// 探索率100%達成済みのエリアレベル一覧を取得（これが遠征先＆チーム枠数になる）
function getUnlockedExpeditionLevels() {
  return [1, 2, 3, 4, 5].filter(lv => (game.areaProgress?.[lv] ?? 0) >= 100);
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

function handleStartExpedition() {
  if (!canAct()) return;

  const unlockedLevels = getUnlockedExpeditionLevels();
  const maxTeams = unlockedLevels.length;
  game.expeditions ??= [];

  if (game.expeditions.length >= maxTeams) {
    alert(`同時に派遣できるチーム上限（${maxTeams}部隊）に達しています！\n新しいエリアの探索率を100%にすると枠が増えます。`);
    return;
  }

  const draft = game.expeditionDraft ?? { areaLevel: unlockedLevels ?? 1, memberIds: [] };
  const busyIds = getBusyExpeditionDinoIds();

  // 有効な待機メンバーだけ抽出
  const validMembers = draft.memberIds.filter(
    id => id !== game.activeDinoId && !busyIds.has(id) && game.dinos.some(d => d.uid === id)
  );

  if (validMembers.length === 0) {
    alert("遠征に出す待機恐竜を1〜3体選んでください！");
    return;
  }

  const targetLevel = unlockedLevels.includes(draft.areaLevel) ? draft.areaLevel : unlockedLevels;
  const course = AREA_EXPEDITIONS.find(c => c.areaLevel === targetLevel) ?? AREA_EXPEDITIONS;

  game.expeditions.push({
    id: crypto.randomUUID(),
    areaLevel: course.areaLevel,
    memberIds: validMembers,
    endAt: Date.now() + course.durationMs
  });

  if (validMembers.includes(selectedMale)) selectedMale = null;
  if (validMembers.includes(selectedFemale)) selectedFemale = null;
  // 編成下書きをリセット
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

  const course = AREA_EXPEDITIONS.find(c => c.areaLevel === exp.areaLevel) ?? AREA_EXPEDITIONS;
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
  } else {
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

const handlers = {
  onExplore: handleExplore,
  onSelectArea: (level) => {
    game.selectedAreaLevel = level;
    update();
  },
  onFeed: handleFeed,
  onRelease: handleRelease,
  onRename: handleRename,
  onHatchAllWildEggs: handleHatchAllWildEggs,
  onToggleLock: handleToggleLock,
  onBossBattle: handleBossBattle,
  onUpgradeFacility: handleUpgradeFacility,
  onShowPedigree: handleShowPedigree,
  onToggleExpDraftMember: handleToggleExpDraftMember,
  onSelectExpArea: handleSelectExpArea,
  onStartExpedition: handleStartExpedition,
  onClaimExpedition: handleClaimExpedition,
  onToggleAutoExplore: handleToggleAutoExplore,
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

    const dino = hatchStarterEgg(game.wildEggs[index]);
    game.dinos.push(dino);
    if (!game.activeDinoId) game.activeDinoId = dino.uid;
    discoverSpecies(dino);
    game.wildEggs.splice(index, 1);

    game.stats.eggsHatched++;
    update();
  },
  onRerollStarter: () => {
    if (game.starterEgg.rarity === "rainbow") {
      if (!confirm("🌈虹レアの卵です。\n本当に選び直しますか？")) return;
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
  }
};

// 画面更新とセーブをまとめて行う関数
function update() {
  syncTreasures(game.treasures);
  syncFacilities(game.facility);
  checkAchievements();
  renderGame(
    game,
    { selectedMale, selectedFemale, filterName, filterSpecies, filterSex, sortBy, isAutoExploring },
    handlers
  );
  saveGame(game);
}

// --- 固定ボタンのイベント登録 ---

document.getElementById("breedBtn").addEventListener("click", () => {
  if (!selectedMale || !selectedFemale) {
    alert("オスとメスを選択してください");
    return;
  }

  if ((game.items?.breedCrystal ?? 0) <= 0) {
    alert("💎「生命の結晶」が足りません！\n探索に出かけて結晶を集めてください。");
    return;
  }

  const parentA = game.dinos.find(d => d.uid === selectedMale);
  const parentB = game.dinos.find(d => d.uid === selectedFemale);
  if (!parentA || !parentB) return;

  const required = getRequiredCrystals(parentA, parentB);
  if ((game.items?.breedCrystal ?? 0) < required) {
    alert(`💎「生命の結晶」が足りません！（必要数: ${required}個）\n探索に出かけて結晶を集めてください。`);
    return;
  }

  // 必要数ぶん消費
  game.items.breedCrystal -= required;

  const child = breed(parentA, parentB);
  const egg = createBreedingEgg(child, currentHatchMult());

  game.breedingEggs ??= [];
  game.breedingEggs.push(egg);
  game.stats.breedsDone++;
  selectedMale = null;
  selectedFemale = null;

  const isSpecial = SPECIAL_BREEDS.some(b => b.result.id === child.speciesId);

  if (isSpecial) {
    alert(`✨ 特殊交配成功！\n「${child.name}」が誕生予定です！`);
    addLog(`✨ 特殊交配成功！「${child.name}」の卵を獲得した！`);
  } else {
    alert("交配卵ができました！");
  }

  update();
});

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

document.getElementById("resetSave").addEventListener("click", () => {
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

document.getElementById("sortBy")?.addEventListener("change", (e) => {
  sortBy = e.target.value;
  update();
});

document.getElementById("resetFilterBtn")?.addEventListener("click", () => {
  filterName = "";
  filterSpecies = "all";
  filterSex = "all";
  sortBy = "default";

  // 画面上の入力欄・セレクトボックスの見た目も初期値に戻す
  const nameInput = document.getElementById("filterName");
  const speciesSelect = document.getElementById("filterSpecies");
  const sexSelect = document.getElementById("filterSex");
  const sortSelect = document.getElementById("sortBy");

  if (nameInput) nameInput.value = "";
  if (speciesSelect) speciesSelect.value = "all";
  if (sexSelect) sexSelect.value = "all";
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

// 1秒ごとのHP自動回復とタイマー更新
setInterval(() => {
  tickCounter++;
  const tBonus = getTreasureBonuses();
  const givePassiveExp = (tickCounter % 5 === 0) && (tBonus.standbyExp > 0);
  
  game.dinos.forEach(dino => {
    if (dino.uid === game.activeDinoId) return;
    // 待機中のHP自動回復（毎秒）
    const stats = calculateStats(dino);
    const healPerSec = Math.max(1, stats.hp * 0.01);
    dino.currentHp = Math.min(stats.hp, dino.currentHp + healPerSec);

    // 秘宝効果による待機経験値（5秒ごと）
    if (givePassiveExp) {
      addExp(dino, tBonus.standbyExp);
    }
  });
  renderTick(game, handlers);
  saveGame(game);
}, 1000);

// 初回描画
update();
