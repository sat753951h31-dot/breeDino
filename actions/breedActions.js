import { calculateStats } from "../systems/stats.js";
import { breed, createBreedingEgg, getRequiredCrystals } from "../systems/breeding.js";
import { hatchStarterEgg } from "../systems/starterEgg.js";
import { SPECIAL_BREEDS } from "../data/specialBreeding.js";
import { getSizeLabel, getRarityLabel, getColorLabel } from "../ui/labels.js";
import { getTraitData } from "../data/traits.js";

export function createBreedActions(ctx) {
  const {
    game,
    update,
    addLog,
    canAct,
    discoverSpecies,
    currentHatchMult,
    getDefaultSpeciesName,
    getBusyExpeditionDinoIds,
    getSelectedMale,
    setSelectedMale,
    getSelectedFemale,
    setSelectedFemale
  } = ctx;

  // 1回・10回交配の共通実行処理
  function executeBreed(times = 1) {
    if (!canAct()) return;

    const selectedMale = getSelectedMale();
    const selectedFemale = getSelectedFemale();

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

    setSelectedMale(null);
    setSelectedFemale(null);

    if (times === 1) {
      if (specialCount > 0) {
        alert(`✨ 特殊交配成功！\n「${lastChildName}」が誕生予定です！`);
        addLog(`✨ 特殊交配成功！「${lastChildName}」の卵を獲得した！`);
      } else {
        alert("交配卵ができました！");
      }
    } else {
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

  // 交配卵の個別孵化
  function handleHatchBreedingEgg(eggId) {
    if (!canAct()) return;
    const index = game.breedingEggs.findIndex(e => e.id === eggId);
    if (index === -1) return;

    const egg = game.breedingEggs[index];
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

    game.breedingEggs.splice(index, 1);

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
  }

  // 交配卵の一括孵化
  function handleHatchAllBreedingEggs() {
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
  }

  // 野生卵の個別孵化
  function handleHatchWildEgg(eggId) {
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
  }

  // 野生卵の一括孵化
  function handleHatchAllWildEggs() {
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

      addLog(
        `🐣 野生の卵から「${dino.name}（F0 / ${sexMark} / ${rarityLabel} / ${trait.icon}${trait.name}）」が誕生した！`
      );
      if (isNewSpecies) {
        addLog(`📖 【図鑑新規登録】${dino.name} を発見！`);
      }
    });

    game.wildEggs = game.wildEggs.filter(e => (e.hatchAt ?? 0) > now);

    const msgParts = [`🐣 ${readyEggs.length}個の野生の卵が一斉に孵化しました！`];
    if (highlights.length > 0) {
      msgParts.push(`\n✨ 【注目個体】\n${highlights.join("\n")}`);
    }
    if (normalCount > 0) {
      msgParts.push(`\n🦖 ほか ${normalCount}体 が仲間に加わりました！`);
    }

    alert(msgParts.join("\n"));
    update();
  }

  // 🔍 逆引き交配：指定種族のベストな両親を検索
  function findBestParentsForSpecies(targetSpeciesId) {
    const busyIds = getBusyExpeditionDinoIds();
    const availableDinos = game.dinos.filter(d => !busyIds.has(d.uid));
    const rarityRank = { rainbow: 4, purple: 3, blue: 2, white: 1 };

    const findBestPair = (speciesA, speciesB) => {
      const males = availableDinos.filter(d => d.sex === "male" && (d.speciesId === speciesA || d.speciesId === speciesB));
      const females = availableDinos.filter(d => d.sex === "female" && (d.speciesId === speciesA || d.speciesId === speciesB));

      let bestPair = null;

      for (const m of males) {
        for (const f of females) {
          const isValidCombo = speciesA === speciesB
            ? (m.speciesId === speciesA && f.speciesId === speciesB)
            : ((m.speciesId === speciesA && f.speciesId === speciesB) || (m.speciesId === speciesB && f.speciesId === speciesA));

          if (!isValidCombo) continue;

          const genM = m.generation ?? 0;
          const genF = f.generation ?? 0;
          const sameGen = genM === genF ? 1 : 0;
          const baseGen = Math.min(genM, genF);
          const maxGen = Math.max(genM, genF);
          const rarityScore = (rarityRank[m.rarityType] ?? 1) + (rarityRank[f.rarityType] ?? 1);
          const ivScore = (m.atkIv + m.hpIv + m.spdIv) + (f.atkIv + f.hpIv + f.spdIv);

          const candidate = { male: m, female: f, sameGen, baseGen, maxGen, rarityScore, ivScore };

          if (!bestPair) {
            bestPair = candidate;
            continue;
          }

          if (candidate.sameGen !== bestPair.sameGen) {
            if (candidate.sameGen > bestPair.sameGen) bestPair = candidate;
          } else if (candidate.baseGen !== bestPair.baseGen) {
            if (candidate.baseGen > bestPair.baseGen) bestPair = candidate;
          } else if (candidate.maxGen !== bestPair.maxGen) {
            if (candidate.maxGen > bestPair.maxGen) bestPair = candidate;
          } else if (candidate.rarityScore !== bestPair.rarityScore) {
            if (candidate.rarityScore > bestPair.rarityScore) bestPair = candidate;
          } else if (candidate.ivScore > bestPair.ivScore) {
            bestPair = candidate;
          }
        }
      }

      return bestPair;
    };

    const samePair = findBestPair(targetSpeciesId, targetSpeciesId);
    if (samePair) {
      return { ...samePair, routeType: "same", routeLabel: "同種交配" };
    }

    const specialRecipe = SPECIAL_BREEDS.find(b => b.result.id === targetSpeciesId);
    if (specialRecipe) {
      const specialPair = findBestPair(specialRecipe.parents, specialRecipe.parents);
      if (specialPair) {
        return {
          ...specialPair,
          routeType: "special",
          routeLabel: `✨ 特殊配合（${getDefaultSpeciesName(specialRecipe.parents)} × ${getDefaultSpeciesName(specialRecipe.parents)}）`
        };
      }
    }

    return null;
  }

  // 🔍 逆引き交配の適用
  function selectBestParentsForSpecies(targetSpeciesId) {
    const targetName = getDefaultSpeciesName(targetSpeciesId);
    const picked = findBestParentsForSpecies(targetSpeciesId);

    if (!picked) {
      alert(
        `🔍 逆引き交配：該当なし\n\n` +
        `「${targetName}」を交配できる適切なオス・メスのペアが待機メンバーに見つかりませんでした。\n` +
        `（※遠征中の恐竜は対象外です）`
      );
      return false;
    }

    setSelectedMale(picked.male.uid);
    setSelectedFemale(picked.female.uid);

    addLog(
      `🔍 【逆引き交配】目標「${targetName}」→ ♂${picked.male.name}(F${picked.male.generation ?? 0}) × ♀${picked.female.name}(F${picked.female.generation ?? 0}) を自動選抜！（${picked.routeLabel}）`
    );
    update();
    return true;
  }

  return {
    executeBreed,
    handleHatchBreedingEgg,
    handleHatchAllBreedingEggs,
    handleHatchWildEgg,
    handleHatchAllWildEggs,
    findBestParentsForSpecies,
    selectBestParentsForSpecies
  };
}
