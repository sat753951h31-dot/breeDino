import { calculateStats, syncTreasures } from "../systems/stats.js";
import { addExp } from "../systems/level.js";
import { rollStarterEgg, createWildEgg } from "../systems/starterEgg.js";
import { AREAS } from "../data/areas.js";
import { getEnemyForArea, battle } from "../systems/battle.js";
import { getEggRarityLabel, getSizeLabel } from "../ui/labels.js";
import { TREASURES, MAX_TREASURE_LEVEL, getTreasureDesc } from "../data/treasures.js";
import { getTraitData } from "../data/traits.js";
import { AREA_BOSSES } from "../data/bosses.js";
import { playExploreSequence } from "../ui/battleStage.js";
import { getFacilityBonuses } from "../data/facilities.js";
import { getDinoType, getTypePassive } from "../data/types.js";

export function createExploreActions(ctx) {
  const {
    game,
    update,
    addLog,
    canAct,
    currentHatchMult,
    rescueIfSoftlocked,
    clearSelectedBreedParent,
    getIsAutoExploring,
    setIsAutoExploring
  } = ctx;

  function getLoopStatMultiplier() {
    const loop = game.worldLoop ?? 1;
    return Math.pow(2.2, loop - 1);
  }

  function getLoopExpMultiplier() {
    const loop = game.worldLoop ?? 1;
    return Math.pow(1.6, loop - 1);
  }

  function rollAreaEgg(minRarity) {
    const rank = { white: 1, blue: 2, purple: 3, rainbow: 4 };
    const egg = rollStarterEgg();

    if (rank[egg.rarity] < rank[minRarity]) {
      egg.rarity = minRarity;
    }
    return egg;
  }

  function rollBattleCount() {
    const r = Math.random();
    if (r < 0.50) return 1;
    if (r < 0.85) return 2;
    return 3;
  }

  async function handleExplore(isAuto = false) {
    if (!isAuto && !canAct(300)) return;

    const activeDino = game.dinos.find(d => d.uid === game.activeDinoId);
    if (!activeDino) return;

    const initialStats = calculateStats(activeDino);
    const currentHp = Math.floor(activeDino.currentHp);
    const maxHp = Math.floor(initialStats.hp);
    const wasCriticalAtStart = activeDino.currentHp <= initialStats.hp * 0.2;

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

    const activeTraitEffect = getTraitData(activeDino.trait).effect;
    const dropBonus = activeTraitEffect.dropBonus ?? 0;

    addLog(`==============================`);
    addLog(`🧭 ${activeDino.name} が ${area.name} の探索へ出発！（${totalBattles > 1 ? `🔥 ${totalBattles}連戦の予感！` : "単独探索"}）`);

    let winStreak = 0;
    let isDefeated = false;

    for (let i = 1; i <= totalBattles; i++) {
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

      activeDino.affection = Math.min(100, (activeDino.affection ?? 0) + 2);
      activeDino.evEarned = Math.min(100, (activeDino.evEarned ?? 0) + 2);

      const activeTypeId = getDinoType(activeDino.speciesId, activeDino.name).id;
      const typePassive = getTypePassive(activeTypeId);
      const isSeaArea = Boolean(area.isSea);

      if (typePassive.winHealRate > 0) {
        const latestStats = calculateStats(activeDino);
        const healHp = Math.max(1, Math.floor(latestStats.hp * typePassive.winHealRate));
        activeDino.currentHp = Math.min(latestStats.hp, activeDino.currentHp + healHp);
        addLog(`🌿 【草食パッシブ】戦闘後にHPが ${healHp}（10%）回復した！`);
      }

      const streakMult = i === 1 ? 1.0 : i === 2 ? 1.2 : 1.5;
      const baseGainedExp = (area.expBonus + activeDino.level) * streakMult;
      const fBonus = getFacilityBonuses(game.facility);
      const seaExpBonus = isSeaArea ? typePassive.seaExpMult : 1.0;
      const gainedExp = Math.floor(
        baseGainedExp * (activeTraitEffect.allExpMult ?? 1) * (1 + fBonus.expMult) * getLoopExpMultiplier() * seaExpBonus
      );
      addLog(`✅ ${enemy.name} を倒した！（EXP +${gainedExp}${i > 1 ? ` / 連戦ボーナス×${streakMult}` : ""}）`);
      addExp(activeDino, gainedExp);

      const prevProgress = game.areaProgress[areaLevel] ?? 0;
      const nextProgress = Math.min(100, prevProgress + area.progressPerWin);
      game.areaProgress[areaLevel] = nextProgress;

      if (prevProgress < 100) {
        addLog(`🗺️ ${area.name} の探索率が ${nextProgress}% になった！`);
      }

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

      const totalEggChance = area.eggChance + dropBonus + typePassive.eggTreasureDropBonus;
      if (Math.random() < totalEggChance) {
        const egg = rollAreaEgg(area.eggMinRarity);
        game.wildEggs.push(createWildEgg(egg.size, egg.rarity, currentHatchMult()));
        addLog(`🥚 卵を持ち帰った！（${getEggRarityLabel(egg.rarity)} / ${getSizeLabel(egg.size)}）`);
      }

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

      const seaCrystalBonus = isSeaArea ? typePassive.seaCrystalBonus : 0;
      if (Math.random() < ((area.crystalChance ?? 0.3) + dropBonus + seaCrystalBonus)) {
        game.items.breedCrystal = (game.items.breedCrystal ?? 0) + 1;
        game.stats.crystalsEarned = (game.stats.crystalsEarned ?? 0) + 1;
        addLog(`💎 ${enemy.name} から「生命の結晶」を獲得した！`);
      }

      const areaTreasure = TREASURES.find(t => t.areaLevel === areaLevel);
      const totalTreasureChance = (areaTreasure?.dropChance ?? 0) + dropBonus + typePassive.eggTreasureDropBonus;
      if (areaTreasure && Math.random() < totalTreasureChance) {
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

    if (isDefeated) {
      if (wasCriticalAtStart) {
        const lostIndex = game.dinos.findIndex(d => d.uid === activeDino.uid);
        if (lostIndex !== -1) {
          game.dinos.splice(lostIndex, 1);
        }

        clearSelectedBreedParent(activeDino.uid);
        game.activeDinoId = game.dinos.length > 0 ? game.dinos[0].uid : null;

        game.stats.dinosLost = (game.stats.dinosLost ?? 0) + 1;
        game.items.breedCrystal = (game.items.breedCrystal ?? 0) + 1;
        game.foods.premium = (game.foods.premium ?? 0) + 1;

        addLog(`🪦 ${activeDino.name}（Lv.${activeDino.level}）は力尽き、帰らぬ恐竜となった…`);
        addLog(`💐 形見として「💎 生命の結晶×1」と「✨ 極上肉×1」が残された`);

        rescueIfSoftlocked();

        const totalEggs = (game.wildEggs?.length ?? 0) + (game.breedingEggs?.length ?? 0);
        const rescueMsg = !game.starterSelected
          ? `\n\n🥚 恐竜がいなくなったため、画面上部に新しい「スターター卵」が用意されました！`
          : (game.dinos.length === 0 && totalEggs > 0)
            ? `\n\n🥚 恐竜はいなくなりましたが、手持ちの卵（${totalEggs}個）を「交配」タブから孵化させて再出発できます！`
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
    if (getIsAutoExploring()) {
      setIsAutoExploring(false);
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

    setIsAutoExploring(true);
    addLog(`🔄 【オート周回開始】瀕死になるか停止ボタンを押すまで探索を繰り返します！`);
    update();

    let loopCount = 0;

    while (getIsAutoExploring()) {
      const currentDino = game.dinos.find(d => d.uid === game.activeDinoId);
      if (!currentDino) {
        setIsAutoExploring(false);
        break;
      }

      const latestStats = calculateStats(currentDino);
      if (currentDino.currentHp <= latestStats.hp * 0.2) {
        setIsAutoExploring(false);
        addLog(`🛑 【オート周回終了】${currentDino.name} が瀕死状態になったため自動停止しました（計 ${loopCount}周）`);
        update();
        break;
      }

      loopCount++;
      await handleExplore(true);

      if (getIsAutoExploring()) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }
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
        const lostIndex = game.dinos.findIndex(d => d.uid === activeDino.uid);
        if (lostIndex !== -1) game.dinos.splice(lostIndex, 1);

        clearSelectedBreedParent(activeDino.uid);
        game.activeDinoId = game.dinos.length > 0 ? game.dinos[0].uid : null;

        game.stats.dinosLost = (game.stats.dinosLost ?? 0) + 1;
        game.items.breedCrystal = (game.items.breedCrystal ?? 0) + 1;
        game.foods.premium = (game.foods.premium ?? 0) + 1;

        addLog(`🪦 ${activeDino.name} はボス「${boss.name}」の前に力尽きた…`);
        addLog(`💐 形見として「💎 生命の結晶×1」と「✨ 極上肉×1」が残された`);

        rescueIfSoftlocked();

        const totalEggs = (game.wildEggs?.length ?? 0) + (game.breedingEggs?.length ?? 0);
        const rescueMsg = !game.starterSelected
          ? `\n\n🥚 恐竜がいなくなったため、画面上部に新しい「スターター卵」が用意されました！`
          : (game.dinos.length === 0 && totalEggs > 0)
            ? `\n\n🥚 恐竜はいなくなりましたが、手持ちの卵（${totalEggs}個）を「交配」タブから孵化させて再出発できます！`
            : "";

        alert(
          `🪦 ${activeDino.name} はボスに敗れ力尽きました…\n` +
          `形見として「💎 生命の結晶×1」「✨ 極上肉×1」を手に入れました。` +
          rescueMsg
        );
      } else {
        activeDino.currentHp = 1;
        addLog(`⚠️ ボス「${boss.name}」の圧倒的な力の前に敗北…HP1でなんとか撤退した！`);
      }
      addLog(`==============================`);
      update();
      return;
    }

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
        game.wildEggs.push(createWildEgg(r.egg.size, r.egg.rarity, currentHatchMult()));
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
      alert(`👑 エリアボス「${boss.name}」を初撃破！\n\n初回報酬：${r.text}${unlockText}`);
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

  function handleAdvanceWorldLoop() {
    if (!canAct()) return;
    if (!game.bossCleared?.[6] || getIsAutoExploring()) return;

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

  return {
    handleExplore,
    handleToggleAutoExplore,
    handleBossBattle,
    handleAdvanceWorldLoop
  };
}
