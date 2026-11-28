import { DINO_SPECIES } from "./dinos.js";
import { SPECIAL_BREEDS } from "./specialBreeding.js";
import { AREA_BOSSES } from "./bosses.js";

export const DINO_TYPES = {
  carnivore: { id: "carnivore", icon: "🍖", name: "肉食", desc: "草食に強く、翼竜に弱い" },
  herbivore: { id: "herbivore", icon: "🌿", name: "草食", desc: "翼竜に強く、肉食に弱い" },
  pterosaur: { id: "pterosaur", icon: "🦅", name: "翼竜", desc: "肉食に強く、草食に弱い" },
  marine:    { id: "marine",    icon: "🌊", name: "海生", desc: "海エリアで非常に強く、陸エリアでは弱い" }
};

export function getDinoType(speciesId = "", name = "") {
  const normal = DINO_SPECIES.find(d => d.id === speciesId);
  if (normal?.type && DINO_TYPES[normal.type]) return DINO_TYPES[normal.type];

  const special = SPECIAL_BREEDS.find(b => b.result.id === speciesId);
  if (special?.result?.type && DINO_TYPES[special.result.type]) return DINO_TYPES[special.result.type];

  const boss = AREA_BOSSES.find(b => b.id === speciesId);
  if (boss?.type && DINO_TYPES[boss.type]) return DINO_TYPES[boss.type];

  return DINO_TYPES.carnivore;
}

// 三すくみ相性の攻撃倍率を返す（攻撃側タイプ vs 防御側タイプ）
export function getTypeMatchupMultiplier(attackerTypeId, defenderTypeId) {
  if (attackerTypeId === "carnivore" && defenderTypeId === "herbivore") return 1.3;
  if (attackerTypeId === "herbivore" && defenderTypeId === "pterosaur") return 1.3;
  if (attackerTypeId === "pterosaur" && defenderTypeId === "carnivore") return 1.3;

  if (attackerTypeId === "herbivore" && defenderTypeId === "carnivore") return 0.6;
  if (attackerTypeId === "pterosaur" && defenderTypeId === "herbivore") return 0.6;
  if (attackerTypeId === "carnivore" && defenderTypeId === "pterosaur") return 0.6;

  return 1.0;
}

// 海エリア・陸エリアの地形補正倍率を返す（海生爬虫類のみ影響）
export function getTerrainMultiplier(typeId, isSeaArea = false) {
  if (isSeaArea) {
    // 海エリア：海生は 1.35倍、海生以外は 0.75倍 に低下
    return typeId === "marine" ? 1.35 : 0.75;
  } else {
    // 陸エリア：海生は 0.75倍 に低下、海生以外は通常（1.0倍）
    return typeId === "marine" ? 0.75 : 1.0;
  }
}

// 4タイプ固有の探索・バトルパッシブを取得
export function getTypePassive(typeId) {
  switch (typeId) {
    case "herbivore":
      return {
        label: "🌿 草食パッシブ（超耐久・オート周回）",
        desc: "戦闘勝利ごとに最大HPの10%を自動回復 ＋ エサのHP回復量 +20%",
        winHealRate: 0.10,
        foodHealBonus: 0.20,
        eggTreasureDropBonus: 0,
        dodgeBonus: 0,
        seaCrystalBonus: 0,
        seaExpMult: 1.0
      };
    case "pterosaur":
      return {
        label: "🦅 翼竜パッシブ（トレジャー・高速回避）",
        desc: "卵・秘宝のドロップ率 +8% ＋ バトル中の回避率 +8%",
        winHealRate: 0,
        foodHealBonus: 0,
        eggTreasureDropBonus: 0.08,
        dodgeBonus: 0.08,
        seaCrystalBonus: 0,
        seaExpMult: 1.0
      };
    case "marine":
      return {
        label: "🌊 海生パッシブ（深海エリア特化）",
        desc: "海エリアでは全能力1.35倍に加え、獲得EXP +30% ＆ 生命の結晶ドロップ率 +15%（陸エリアでは能力0.75倍）",
        winHealRate: 0,
        foodHealBonus: 0,
        eggTreasureDropBonus: 0,
        dodgeBonus: 0,
        seaCrystalBonus: 0.15,
        seaExpMult: 1.30
      };
    default: // carnivore（肉食）
      return {
        label: "🍖 肉食パッシブ（純粋火力・ボス突破）",
        desc: "高い基礎攻撃力と豊富なドラゴン系進化ルートを持つ決戦用アタッカー",
        winHealRate: 0,
        foodHealBonus: 0,
        eggTreasureDropBonus: 0,
        dodgeBonus: 0,
        seaCrystalBonus: 0,
        seaExpMult: 1.0
      };
  }
}

// 恐竜のタイプに応じたエサ表示（草食は植物系、それ以外は肉系）を返す
export function getFoodLabelsForType(typeId) {
  if (typeId === "herbivore") {
    return {
      raw:     { icon: "🌿", name: "若葉",     shortName: "若葉" },
      good:    { icon: "🍎", name: "甘い木の実", shortName: "木の実" },
      premium: { icon: "✨", name: "黄金果実",   shortName: "黄金" }
    };
  }

  return {
    raw:     { icon: "🍖", name: "生肉",   shortName: "生肉" },
    good:    { icon: "🥩", name: "上質肉", shortName: "上質" },
    premium: { icon: "✨", name: "極上肉", shortName: "極上" }
  };
}
