import { calculateStats } from "../systems/stats.js";
import { addExp } from "../systems/level.js";
import { createWildEgg } from "../systems/starterEgg.js";
import { getEggRarityLabel } from "../ui/labels.js";
import { getTraitData } from "../data/traits.js";
import { AREA_EXPEDITIONS } from "../data/expeditions.js";
import { getFacilityBonuses } from "../data/facilities.js";

export function createExpeditionActions(ctx) {
  const {
    game,
    update,
    addLog,
    canAct,
    currentHatchMult,
    getUnlockedExpeditionLevels,
    clearSelectedBreedParent
  } = ctx;

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

    const candidates = game.dinos.filter(
      d => d.uid !== game.activeDinoId && !busyIds.has(d.uid)
    );

    if (candidates.length === 0) {
      alert("派遣できる待機恐竜がいません！");
      return;
    }

    const rarityRank = { rainbow: 4, purple: 3, blue: 2, white: 1 };

    const sorted = [...candidates].sort((a, b) => {
      const luckyA = a.trait === "hunter" ? 1 : 0;
      const luckyB = b.trait === "hunter" ? 1 : 0;
      if (luckyA !== luckyB) return luckyB - luckyA;

      const rA = rarityRank[a.rarityType] ?? 1;
      const rB = rarityRank[b.rarityType] ?? 1;
      if (rA !== rB) return rB - rA;

      return a.level - b.level;
    });

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

    validMembers.forEach(id => clearSelectedBreedParent(id));
    game.expeditionDraft.memberIds = [];

    addLog(`🏕️ 遠征隊（${validMembers.length}体）が「${course.name}」へ出発した！`);
    update();
  }

  // 1部隊分の遠征報酬を計算・付与して結果オブジェクトを返す共通ヘルパー
  function processSingleExpeditionReward(exp) {
    const course = AREA_EXPEDITIONS.find(c => c.areaLevel === exp.areaLevel) ?? AREA_EXPEDITIONS.at(0);
    const members = exp.memberIds
      .map(id => game.dinos.find(d => d.uid === id))
      .filter(Boolean);

    let totalPower = 0;
    let luckyCount = 0;
    members.forEach(d => {
      const s = calculateStats(d);
      totalPower += (s.atk + s.hp * 0.2 + s.spd);
      if (d.trait === "hunter") luckyCount++;
    });

    const powerMult = Math.min(2.5, 1 + Math.floor(totalPower / 450) * 0.25);
    const luckBonus = luckyCount * 0.10;
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

    const baseMemberExp = Math.floor((course.durationMs / 1000) * 0.5);
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

    game.stats.expeditionsDone = (game.stats.expeditionsDone ?? 0) + 1;

    return {
      course,
      rewards,
      baseMemberExp,
      luckyCount,
      levelUpNotices
    };
  }

  // 個別受け取り
  function handleClaimExpedition(expId) {
    if (!canAct()) return;
    game.expeditions ??= [];
    const index = game.expeditions.findIndex(e => e.id === expId);
    if (index === -1) return;

    const exp = game.expeditions[index];
    if (Date.now() < exp.endAt) return;

    const res = processSingleExpeditionReward(exp);
    game.expeditions.splice(index, 1);

    const rewardText = res.rewards.join("、");
    const luckLogText = res.luckyCount > 0 ? ` / 🍀幸運+${res.luckyCount * 10}%` : "";
    const lvUpText = res.levelUpNotices.length > 0
      ? `\n🎉 レベルアップ：${res.levelUpNotices.join("、")}`
      : "";

    addLog(`🏕️ 【${res.course.name} 帰還】${rewardText} を獲得！（参加メンバー基本 EXP +${res.baseMemberExp}${luckLogText}）`);

    alert(
      `🏕️ 遠征隊が帰還しました！\n\n` +
      `獲得報酬：${rewardText}\n` +
      `参加メンバー経験値：基本 EXP +${res.baseMemberExp}${lvUpText}`
    );

    update();
  }

  // 🎁 一括受け取り ＆ 🔄 受け取って同じメンバーで再遠征（redeploy = true で再出発）
  function handleClaimAllExpeditions(redeploy = false) {
    if (!canAct()) return;
    game.expeditions ??= [];

    const now = Date.now();
    const doneExps = game.expeditions.filter(e => e.endAt <= now);
    if (doneExps.length === 0) return;

    const unlockedSet = new Set(getUnlockedExpeditionLevels());
    const summaryLines = [];
    const allLevelUps = [];
    const relaunchedList = [];

    doneExps.forEach(exp => {
      const res = processSingleExpeditionReward(exp);
      summaryLines.push(`・${res.course.icon} ${res.course.name}：${res.rewards.join("、")}`);
      allLevelUps.push(...res.levelUpNotices);

      if (redeploy) {
        const validMembers = exp.memberIds.filter(
          id => id !== game.activeDinoId && game.dinos.some(d => d.uid === id)
        );
        if (validMembers.length > 0 && unlockedSet.has(exp.areaLevel)) {
          relaunchedList.push({
            id: crypto.randomUUID(),
            areaLevel: exp.areaLevel,
            memberIds: validMembers,
            endAt: Date.now() + res.course.durationMs
          });
        }
      }
    });

    game.expeditions = [
      ...game.expeditions.filter(e => e.endAt > now),
      ...relaunchedList
    ];

    const lvUpText = allLevelUps.length > 0
      ? `\n\n🎉 レベルアップ：${allLevelUps.join("、")}`
      : "";

    const redeployMsg = redeploy
      ? `\n\n🔄 ${relaunchedList.length}部隊 が同じ遠征先へ再出発しました！`
      : "";

    addLog(
      `🏕️ 【遠征一括帰還】${doneExps.length}部隊 の報酬を一括受け取りした！` +
      (redeploy ? `（そのまま ${relaunchedList.length}部隊 が再遠征へ出発！）` : "")
    );

    alert(
      `🎁 ${doneExps.length}部隊 の遠征報酬を受け取りました！\n\n` +
      `${summaryLines.join("\n")}${lvUpText}${redeployMsg}`
    );

    update();
  }

  return {
    getBusyExpeditionDinoIds,
    handleToggleExpDraftMember,
    handleSelectExpArea,
    handleAutoSelectExpMembers,
    handleStartExpedition,
    handleClaimExpedition,
    handleClaimAllExpeditions
  };
}
