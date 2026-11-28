import { calculateStats } from "../systems/stats.js";
import { DINO_SPECIES } from "../data/dinos.js";
import { SPECIAL_BREEDS } from "../data/specialBreeding.js";
import { getRarityLabel } from "../ui/labels.js";
import * as traitModule from "../data/traits.js";
import { FACILITIES, MAX_FACILITY_LEVEL, CRAFT_RECIPES, getMonumentUpgradeCost } from "../data/facilities.js";

const { getTraitData } = traitModule;

export function createFacilityActions(ctx) {
  const { game, update, addLog, canAct, setLastGachaResults } = ctx;

  // 拠点設備のアップグレード
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

    for (const [itemKey, needed] of Object.entries(nextPlan.cost)) {
      const owned = ["wood", "stone", "ore"].includes(itemKey)
        ? (game.materials[itemKey] ?? 0)
        : (game.foods[itemKey] ?? 0);

      if (owned < needed) {
        alert(`素材が足りません！\n必要素材：${nextPlan.costText}`);
        return;
      }
    }

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

    for (const [key, needed] of Object.entries(recipe.cost)) {
      const owned = ["wood", "stone", "ore"].includes(key)
        ? (game.materials[key] ?? 0)
        : (game.foods[key] ?? 0);
      if (owned < needed) {
        alert(`素材が足りません！\n必要素材：${recipe.costText}`);
        return;
      }
    }

    for (const [key, needed] of Object.entries(recipe.cost)) {
      if (["wood", "stone", "ore"].includes(key)) {
        game.materials[key] -= needed;
      } else {
        game.foods[key] -= needed;
      }
    }

    let newTotal = 0;
    let itemLabel = "";

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

    const rRoll = Math.random();
    let rarityType = "white";
    if (isPremium) {
      rarityType =
        rRoll < 0.25 ? "rainbow" :
        rRoll < 0.65 ? "purple" : "blue";
    } else {
      rarityType =
        rRoll < 0.07 ? "rainbow" :
        rRoll < 0.25 ? "purple" :
        rRoll < 0.55 ? "blue" : "white";
    }

    const sizes = isPremium ? ["normal", "large", "giant"] : ["small", "normal", "large", "giant"];
    const size = sizes[Math.floor(Math.random() * sizes.length)];

    const cRoll = Math.random();
    const color = isPremium
      ? (cRoll < 0.12 ? "rainbow" : cRoll < 0.28 ? "gold" : cRoll < 0.45 ? "blue" : "normal")
      : (cRoll < 0.06 ? "rainbow" : cRoll < 0.16 ? "gold" : cRoll < 0.28 ? "blue" : "normal");

    const mutant = Math.random() < (isPremium ? 0.25 : 0.12);

    const rawTraits = traitModule.TRAITS ?? traitModule.default ?? {};
    const traitList = Array.isArray(rawTraits) ? rawTraits : Object.values(rawTraits);
    const pickedTrait = traitList.length > 0
      ? traitList[Math.floor(Math.random() * traitList.length)].id
      : "brave";

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

  // 🎰 ガチャ実行処理
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

    setLastGachaResults(results);
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

  return {
    handleUpgradeFacility,
    handleUpgradeMonument,
    handleCraftItem,
    getGachaMaxGeneration,
    getPremiumGachaGenRange,
    handleRollGacha
  };
}
