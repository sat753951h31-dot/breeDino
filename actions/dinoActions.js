import { calculateStats } from "../systems/stats.js";
import { addExp } from "../systems/level.js";
import { getSizeLabel } from "../ui/labels.js";
import * as traitModule from "../data/traits.js";
import { getFacilityBonuses } from "../data/facilities.js";
import { getDinoType, getTypePassive } from "../data/types.js";

const { getTraitData } = traitModule;

export function createDinoActions(ctx) {
  const {
    game,
    update,
    addLog,
    canAct,
    getDefaultSpeciesName,
    getBusyExpeditionDinoIds,
    getSelectedMale,
    getSelectedFemale,
    clearSelectedBreedParent,
    getIsRainbowSelectMode,
    setIsRainbowSelectMode,
    selectedRainbowIds
  } = ctx;

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

  // 個別お別れ
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

    const dino = game.dinos[index];

    if (dino.locked) {
      alert(`🔒「${dino.name}」は保護ロック中のためお別れできません！\n先に🔒ボタンを押してロックを解除してください。`);
      return;
    }

    if (getBusyExpeditionDinoIds().has(dino.uid)) {
      alert("🏕️ 遠征中の恐竜とはお別れできません！");
      return;
    }

    const reward = getReleaseReward(dino);
    const warning = (dino.mutant || dino.color !== "normal" || dino.rarityType === "rainbow")
      ? "⚠️ 【注意】レア個体・特殊個体の可能性があります！\n"
      : "";

    const ok = confirm(
      `${warning}「${dino.name}（Lv.${dino.level}）」とお別れしますか？\n` +
      `獲得アイテム：${reward.label} ×${reward.amount}`
    );
    if (!ok) return;

    clearSelectedBreedParent(dinoId);
    game.dinos.splice(index, 1);
    game.foods[reward.type] = (game.foods[reward.type] ?? 0) + reward.amount;

    addLog(`👋 ${dino.name}（Lv.${dino.level}）とお別れし、${reward.label} ×${reward.amount} を手に入れた`);
    game.stats.dinosReleased++;
    update();
  }

  // エサやり
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
    const fBonus = getFacilityBonuses(game.facility);
    const dinoTypeId = getDinoType(dino.speciesId, dino.name).id;
    const foodHealTypeBonus = getTypePassive(dinoTypeId).foodHealBonus ?? 0;

    const finalHealRate = Math.min(1.0, config.healRate + fBonus.healBonus + foodHealTypeBonus);
    const healAmount = finalHealRate >= 1.0
      ? stats.hp
      : Math.max(config.minHeal, Math.floor(stats.hp * finalHealRate));

    dino.currentHp = Math.min(stats.hp, dino.currentHp + healAmount);

    const traitEffect = getTraitData(dino.trait).effect;
    const expMult = (traitEffect.feedExpMult ?? 1) * (traitEffect.allExpMult ?? 1) * (1 + fBonus.foodExpMult);
    const finalExp = Math.floor(config.exp * expMult);

    game.foods[foodType]--;
    dino.affection = Math.min(100, (dino.affection ?? 0) + 1);

    addExp(dino, finalExp);
    update();
  }

  // 名前変更
  function handleRename(dinoId) {
    const dino = game.dinos.find(d => d.uid === dinoId);
    if (!dino) return;

    const defaultName = getDefaultSpeciesName(dino.speciesId);
    const input = prompt(
      `新しいニックネームを入力してください（最大15文字）\n※空欄でOKを押すと「${defaultName}」に戻ります`,
      dino.name
    );
    if (input === null) return;

    const trimmed = input.trim();
    dino.name = trimmed === "" ? defaultName : trimmed.slice(0, 15);
    update();
  }

  // 保護ロック切り替え
  function handleToggleLock(dinoId) {
    const dino = game.dinos.find(d => d.uid === dinoId);
    if (!dino) return;

    dino.locked = !dino.locked;
    update();
  }

  // 血統書表示
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

  // 一括お別れ
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
    const selectedMale = getSelectedMale();
    const selectedFemale = getSelectedFemale();

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
      if (r === "purple") premiumGain += 1;
      else if (r === "blue") goodGain += 1;
      else rawGain += 1;
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

  // 虹レア結晶還元計算
  function getRainbowCrystalReturn(dino) {
    const gen = dino.generation ?? 0;
    return 5 + Math.min(10, gen);
  }

  function handleToggleRainbowMode() {
    setIsRainbowSelectMode(!getIsRainbowSelectMode());
    selectedRainbowIds.clear();
    update();
  }

  function handleToggleRainbowPick(dinoId) {
    if (!getIsRainbowSelectMode()) return;
    if (selectedRainbowIds.has(dinoId)) {
      selectedRainbowIds.delete(dinoId);
    } else {
      selectedRainbowIds.add(dinoId);
    }
    update();
  }

  function handleSelectAllFilteredRainbows(targetIds = []) {
    if (!getIsRainbowSelectMode()) return;
    targetIds.forEach(id => selectedRainbowIds.add(id));
    update();
  }

  function handleClearRainbowPicks() {
    if (!getIsRainbowSelectMode()) return;
    selectedRainbowIds.clear();
    update();
  }

  // 選択した虹レアを生命の結晶へ還元実行
  function handleExecuteRainbowConvert() {
    if (!canAct()) return;
    if (selectedRainbowIds.size === 0) return;

    const busyIds = getBusyExpeditionDinoIds();
    const selectedMale = getSelectedMale();
    const selectedFemale = getSelectedFemale();

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
    setIsRainbowSelectMode(false);

    addLog(`💎 【結晶還元】虹レア ${validTargets.length}体 を還元し、「💎 生命の結晶 ×${totalCrystals}個」を獲得した！`);
    alert(`💎 還元完了！\n「生命の結晶 ×${totalCrystals}個」を手に入れました！`);
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

    const activeEl = document.getElementById("activeDino");
    if (activeEl) activeEl.dataset.renderedUid = "";
    update();
  }

  // 💉 個体値強化の秘薬を使用（通常100 / 変異150 / 超過IV切り下げ防止）
  function handleUseIvElixir(targetDinoId = game.activeDinoId) {
    if (!canAct()) return;
    if ((game.items?.ivElixir ?? 0) <= 0) return;

    const targetDino = game.dinos.find(d => d.uid === targetDinoId);
    if (!targetDino) return;

    const maxIv = targetDino.mutant ? 150 : 100;
    const curAtk = targetDino.atkIv ?? 0;
    const curHp = targetDino.hpIv ?? 0;
    const curSpd = targetDino.spdIv ?? 0;

    if (curAtk >= maxIv && curHp >= maxIv && curSpd >= maxIv) {
      const extraHint = !targetDino.mutant ? "\n（※突然変異個体【MUTANT】のみ上限150まで強化できます）" : "";
      alert(`${targetDino.name} の個体値（IV）はすでに上限（${maxIv}）に達しています！${extraHint}`);
      return;
    }

    const ok = confirm(
      `⚠️ 【貴重品の使用確認】\n` +
      `「💉 個体値強化の秘薬」を 1個 消費して、${targetDino.name} を強化しますか？\n\n` +
      `現在の個体値：ATK ${curAtk} / HP ${curHp} / SPD ${curSpd}\n` +
      `※上限（${maxIv}）未満の個体値が +10 上昇します（すでに${maxIv}以上の数値は維持されます）`
    );
    if (!ok) return;

    game.items.ivElixir--;
    game.stats.itemsUsed = (game.stats.itemsUsed ?? 0) + 1;

    targetDino.atkIv = Math.max(curAtk, Math.min(maxIv, curAtk + 10));
    targetDino.hpIv = Math.max(curHp, Math.min(maxIv, curHp + 10));
    targetDino.spdIv = Math.max(curSpd, Math.min(maxIv, curSpd + 10));

    const newStats = calculateStats(targetDino);
    targetDino.currentHp = Math.min(newStats.hp, targetDino.currentHp + 50);

    addLog(`💉 【個体値強化】${targetDino.name} のIVが上昇！（ATK:${targetDino.atkIv} / HP:${targetDino.hpIv} / SPD:${targetDino.spdIv}）`);
    alert(`💉 個体値が強化されました！\n\nATK IV: ${targetDino.atkIv} / HP IV: ${targetDino.hpIv} / SPD IV: ${targetDino.spdIv}`);

    const activeEl = document.getElementById("activeDino");
    if (activeEl) activeEl.dataset.renderedUid = "";
    update();
  }

  // 📏 体格変化の薬を使用
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

    const activeEl = document.getElementById("activeDino");
    if (activeEl) activeEl.dataset.renderedUid = "";
    update();
  }

  // 📊 努力値の増減処理
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

  return {
    handleRelease,
    handleFeed,
    handleRename,
    handleToggleLock,
    handleShowPedigree,
    handleBulkRelease,
    getRainbowCrystalReturn,
    handleToggleRainbowMode,
    handleToggleRainbowPick,
    handleSelectAllFilteredRainbows,
    handleClearRainbowPicks,
    handleExecuteRainbowConvert,
    handleUseTraitFruit,
    handleUseIvElixir,
    handleUseSizePotion,
    handleAdjustEv,
    handleResetEv
  };
}
