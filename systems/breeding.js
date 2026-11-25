import { SPECIAL_BREEDS } from "../data/specialBreeding.js";
import { DINO_SPECIES } from "../data/dinos.js";
import { inheritTrait } from "../data/traits.js";
import { calculateStats } from "./stats.js";
const SIZE_LIST = ["small", "normal", "large", "giant"];

const SIZE_VALUE = {
  small: 1,
  normal: 2,
  large: 3,
  giant: 4
};

export function breed(parentA, parentB) {

  const specialBreed =
    findSpecialBreed(
      parentA,
      parentB
    );
  const lvInfo = getChildMaxLevelInfo(parentA, parentB);
  const parentMaxGen = Math.max(parentA.generation ?? 0, parentB.generation ?? 0);

  const baseData =
    specialBreed
      ? specialBreed.result
      : {
          id: parentA.speciesId,
          name: resolveSpeciesName(parentA.speciesId, parentA.name),

          size: parentA.size,

          rarity:
            Math.max(
              parentA.rarity,
              parentB.rarity
            ),

          baseAtk:
            parentA.baseAtk,

          baseHp:
            parentA.baseHp,

          baseSpd:
            parentA.baseSpd
        };

  // 👇 両親のサイズから遺伝・変異させる
  const inheritedSize = inheritSize(
    parentA.size,
    parentB.size,
    specialBreed ? specialBreed.result.size : null
  );

  const child = {
    uid: crypto.randomUUID(),

    speciesId: baseData.id,
    name: baseData.name,

    size: inheritedSize,

    sex: Math.random() < 0.5 ? "male" : "female",

    rarity:
      baseData.rarity,

    color: inheritColor(
      parentA.color,
      parentB.color
    ),

    trait: inheritTrait(parentA.trait, parentB.trait),

    rarityType: inheritRarity(
      parentA.rarityType,
      parentB.rarityType
    ),

    baseAtk: baseData.baseAtk,
    baseHp: baseData.baseHp,
    baseSpd: baseData.baseSpd,

    level: 1,
    maxLevel: lvInfo.totalMaxLevel,
    exp: 0,

    generation: lvInfo.nextGen,

    parents: {
      father: {
        name: parentA.name,
        speciesName: resolveSpeciesName(parentA.speciesId, parentA.name),
        generation: parentA.generation ?? 0
      },
      mother: {
        name: parentB.name,
        speciesName: resolveSpeciesName(parentB.speciesId, parentB.name),
        generation: parentB.generation ?? 0
      }
    },
    
    atkIv: inheritIv(
      parentA.atkIv,
      parentB.atkIv,
      Math.max(
        parentA.generation ?? 0,
        parentB.generation ?? 0
      )
    ),
    
    hpIv: inheritIv(
      parentA.hpIv,
      parentB.hpIv,
      Math.max(
        parentA.generation ?? 0,
        parentB.generation ?? 0
      )
    ),

    spdIv: inheritIv(
      parentA.spdIv,
      parentB.spdIv,
      Math.max(
        parentA.generation ?? 0,
        parentB.generation ?? 0
      )
    )
  };

  // 突然変異判定（個体値が1つでも120以上なら mutant = true）
  child.mutant = (
    child.atkIv >= 120 ||
    child.hpIv >= 120 ||
    child.spdIv >= 120
  );

  const stats = calculateStats(child);
  child.currentHp = stats.hp;

  return child;
}

function inheritIv(a, b, generation) {

  let value =
    Math.floor(
      ((a + b) / 2) +
      (Math.random() * 21 - 10)
    );

  const mutationRate =
    Math.min(
      0.05 + generation * 0.01,
      0.50
    );

  if (Math.random() < mutationRate) {

    const mutationAmount =
      Math.floor(
        Math.random() * 16
      ) + 10;

    value += mutationAmount;

    console.log(
      `突然変異 +${mutationAmount}`
    );
  }

  value = Math.max(0, value);
  value = Math.min(150, value);

  return value;
}

function inheritColor(a, b) {

  if (a === "rainbow" || b === "rainbow") {
    if (Math.random() < 0.3) {
      return "rainbow";
    }
  }

  if (a === "gold" || b === "gold") {
    if (Math.random() < 0.2) {
      return "gold";
    }
  }

  if (a === "blue" || b === "blue") {
    if (Math.random() < 0.15) {
      return "blue";
    }
  }

  return "normal";
}

function findSpecialBreed(
  parentA,
  parentB
) {

  const ids = [
    parentA.speciesId,
    parentB.speciesId
  ].sort();

  return SPECIAL_BREEDS.find(
    breed => {

      const parentIds =
        [...breed.parents].sort();

      return (
        parentIds[0] === ids[0] &&
        parentIds[1] === ids[1]
      );
    }
  );
}

export function createBreedingEgg(child, timeMult = 1.0) {
  const hatchTimeMap = {
    white: 30000,
    blue: 60000,
    purple: 180000,
    rainbow: 300000
  };

  const baseTime = hatchTimeMap[child.rarityType] ?? 30000;
  const finalTime = Math.floor(baseTime * timeMult);

  return {
    id: crypto.randomUUID(),
    child,
    rarity: child.rarityType,
    rarityType: child.rarityType,
    createdAt: Date.now(),
    hatchAt: Date.now() + finalTime
  };
}

const RARITY_LIST = ["white", "blue", "purple", "rainbow"];

const RARITY_VALUE = {
  white: 1,
  blue: 2,
  purple: 3,
  rainbow: 4
};

function inheritRarity(rarityA, rarityB) {
  // 未設定（undefined）の場合は安全に white(1) として扱う
  const valA = RARITY_VALUE[rarityA] ?? 1;
  const valB = RARITY_VALUE[rarityB] ?? 1;

  const minRank = Math.min(valA, valB);
  const maxRank = Math.max(valA, valB);
  const roll = Math.random();

  // 1. 両親が同じレアリティの場合（同ランク保証 ＋ 確率で1段階昇格）
  if (minRank === maxRank) {
    if (maxRank === 4) return "rainbow"; // 虹×虹は100%虹
    const upgradeChance = maxRank === 1 ? 0.30 : 0.25; // 白×白は30%、青×青・紫×紫は25%で昇格
    const finalRank = roll < upgradeChance ? maxRank + 1 : maxRank;
    return RARITY_LIST[finalRank - 1];
  }

  // 2. 両親のレアリティが異なる場合（片方が虹なら白には落ちない）
  if (maxRank === 4) {
    if (minRank === 3) {
      // 虹 × 紫
      return roll < 0.50 ? "rainbow" : "purple";
    }
    if (minRank === 2) {
      // 虹 × 青
      if (roll < 0.20) return "rainbow";
      if (roll < 0.70) return "purple";
      return "blue";
    }
    // 虹 × 白
    if (roll < 0.15) return "rainbow";
    if (roll < 0.50) return "purple";
    return "blue";
  }

  // 3. その他の異なる組み合わせ（紫×青、紫×白、青×白）
  // 低い方のランクを最低保証しつつ、50%で高い方のランクを引き継ぐ
  const inheritedRank = roll < 0.50 ? maxRank : minRank;
  return RARITY_LIST[inheritedRank - 1];
}

// サイズ遺伝と突然変異の計算
function inheritSize(sizeA, sizeB, baseSize = null) {
  const valA = SIZE_VALUE[sizeA] ?? 2;
  const valB = SIZE_VALUE[sizeB] ?? 2;

  // 特殊交配でベースサイズが指定されている場合は、ベースサイズと両親平均の中間をとる
  let avg = baseSize
    ? ((SIZE_VALUE[baseSize] ?? 2) + (valA + valB) / 2) / 2
    : (valA + valB) / 2;

  // 小数点（例: small(1) と normal(2) の平均 1.5）は50%で切り上げ/切り捨て
  let rank = Math.random() < (avg % 1)
    ? Math.ceil(avg)
    : Math.floor(avg);

  // 15%の確率でサイズ突然変異（10%で1段階大きく、5%で1段階小さく）
  const roll = Math.random();
  if (roll < 0.10) {
    rank += 1;
  } else if (roll < 0.15) {
    rank -= 1;
  }

  // 1(small) 〜 4(giant) の範囲に収める
  rank = Math.max(1, Math.min(4, rank));

  return SIZE_LIST[rank - 1];
}

function resolveSpeciesName(speciesId, fallbackName) {
  const normal = DINO_SPECIES.find(d => d.id === speciesId);
  if (normal) return normal.name;

  const special = SPECIAL_BREEDS.find(b => b.result.id === speciesId);
  return special ? special.result.name : fallbackName;
}

// 世代ごとの基本上限・血統引継・今回の育成ボーナスをすべて合算して計算
export function getChildMaxLevelInfo(parentA, parentB) {
  const genA = parentA.generation ?? 0;
  const genB = parentB.generation ?? 0;
  const nextGen = Math.min(genA, genB) + 1;

  // 1. 世代ごとの固定基本上限（F0:20, F1:25, F2:30...）
  const genBaseMax = 20 + nextGen * 5;

  const maxA = parentA.maxLevel ?? (20 + genA * 5);
  const maxB = parentB.maxLevel ?? (20 + genB * 5);

  // 2. 両親それぞれが過去の世代から持っている「累積ボーナス」を算出（高い方を継承）
  const pastBonusA = Math.max(0, maxA - (20 + genA * 5));
  const pastBonusB = Math.max(0, maxB - (20 + genB * 5));
  const inheritedBonus = Math.max(pastBonusA, pastBonusB);

  // 3. 今回の両親のレベル達成度に応じた新規ボーナス（片親MAXで+5、両親MAXで+10）
  const ratioA = Math.min(1, (parentA.level ?? 1) / maxA);
  const ratioB = Math.min(1, (parentB.level ?? 1) / maxB);
  const trainBonus = Math.floor(ratioA * 5) + Math.floor(ratioB * 5);

  return {
    nextGen,
    genBaseMax,
    inheritedBonus,
    trainBonus,
    totalMaxLevel: genBaseMax + inheritedBonus + trainBonus
  };
}

// 誕生する世代に応じた生命の結晶の必要数を計算
export function getRequiredCrystals(parentA, parentB) {
  const nextGen = Math.min(parentA.generation ?? 0, parentB.generation ?? 0) + 1;
  return 1 + Math.floor((nextGen - 1) / 2);
}

export function calculateChildMaxLevel(parentA, parentB) {
  return getChildMaxLevelInfo(parentA, parentB).totalMaxLevel;
}
