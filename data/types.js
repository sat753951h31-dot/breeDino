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
