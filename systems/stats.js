import { TREASURES } from "../data/treasures.js";
import { getTraitData } from "../data/traits.js";
import { getFacilityBonuses } from "../data/facilities.js";

let activeTreasures = {};
let activeFacility = {};

function getGenerationMultiplier(generation) {
  return 1 + (generation * 0.02);
}

function getRarityMultiplier(rarity) {
  switch (rarity) {
    case "blue":
      return 1.2;
    case "purple":
      return 1.5;
    case "rainbow":
      return 2.0;
    default:
      return 1.0;
  }
}

// 👇 サイズごとのステータス倍率
function getSizeMultipliers(size) {
  switch (size) {
    case "small":
      return { atk: 0.90, hp: 0.85, spd: 1.25 };
    case "large":
      return { atk: 1.10, hp: 1.15, spd: 0.90 };
    case "giant":
      return { atk: 1.20, hp: 1.35, spd: 0.80 };
    default: // normal
      return { atk: 1.00, hp: 1.00, spd: 1.00 };
  }
}

export function calculateStats(dino) {
  const rarityBonus = getRarityMultiplier(dino.rarityType);
  const generationBonus = getGenerationMultiplier(dino.generation ?? 0);
  const mutantBonus = dino.mutant ? 1.15 : 1;
  const sizeBonus = getSizeMultipliers(dino.size);
  const tBonus = getTreasureBonuses();
  const fBonus = getFacilityBonuses(activeFacility); // 👈 設備ボーナスを取得
  const traitEffect = getTraitData(dino.trait).effect;

  const commonMult = rarityBonus * generationBonus * mutantBonus;

  return {
    atk: (
      dino.baseAtk +
      dino.level * 2 +
      dino.atkIv * 0.3
    ) * commonMult * sizeBonus.atk * (1 + tBonus.atkMult + fBonus.statMult + (traitEffect.atkMult ?? 0)),

    hp: (
      dino.baseHp +
      dino.level * 5 +
      dino.hpIv * 0.5
    ) * commonMult * sizeBonus.hp * (1 + tBonus.hpMult + fBonus.statMult + (traitEffect.hpMult ?? 0)),

    spd: (
      dino.baseSpd +
      dino.level +
      dino.spdIv * 0.3
    ) * commonMult * sizeBonus.spd * (1 + tBonus.spdMult + fBonus.statMult + (traitEffect.spdMult ?? 0))
  };
}

// 所持している秘宝リストをステータス計算機に同期する
export function syncTreasures(treasuresObj = {}) {
  activeTreasures = treasuresObj;
}

// 秘宝による合計ボーナスを計算
export function getTreasureBonuses() {
  const bonus = { atkMult: 0, hpMult: 0, spdMult: 0, standbyExp: 0 };

  for (const [id, level] of Object.entries(activeTreasures)) {
    const lv = Number(level) || 0;
    if (lv <= 0) continue;

    const t = TREASURES.find(item => item.id === id);
    if (!t) continue;

    bonus.atkMult += (t.effect.atkMult ?? 0) * lv;
    bonus.hpMult += (t.effect.hpMult ?? 0) * lv;
    bonus.spdMult += (t.effect.spdMult ?? 0) * lv;
    bonus.standbyExp += (t.effect.standbyExp ?? 0) * lv;
  }

  return bonus;
}

export function syncFacilities(facilityObj = {}) {
  activeFacility = facilityObj ?? {};
}