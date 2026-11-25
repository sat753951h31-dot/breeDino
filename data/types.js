export const DINO_TYPES = {
  carnivore: { id: "carnivore", icon: "🍖", name: "肉食", desc: "草食に強く、翼竜に弱い" },
  herbivore: { id: "herbivore", icon: "🌿", name: "草食", desc: "翼竜に強く、肉食に弱い" },
  pterosaur: { id: "pterosaur", icon: "🦅", name: "翼竜", desc: "肉食に強く、草食に弱い" },
  marine:    { id: "marine",    icon: "🌊", name: "海生", desc: "海エリアで非常に強く、陸エリアでは弱い" }
};

// 種族IDごとのタイプマッピング
const SPECIES_TYPE_MAP = {
  // 🍖 肉食
  compy: "carnivore",
  raptor: "carnivore",
  shadowraptor: "carnivore",
  trex: "carnivore",
  spino: "carnivore",
  giganoto: "carnivore",
  allo: "carnivore",
  omega_rex: "carnivore",
  tyrannospino: "carnivore",
  dragonraptor: "carnivore",
  chaosdragon: "carnivore",
  genesis_dragon: "carnivore",
  boss_1: "carnivore",
  boss_2: "carnivore",
  boss_3: "carnivore",
  boss_4: "carnivore",
  boss_5: "carnivore",

  // 🌿 草食
  brachio: "herbivore",
  gigabrachio: "herbivore",
  triceratops: "herbivore",
  aegistops: "herbivore",
  stego: "herbivore",
  ankylo: "herbivore",
  armored_allo: "herbivore",
  fortress_titan: "herbivore",

  // 🦅 翼竜
  quetzal: "pterosaur",
  pteranodon: "pterosaur",
  sky_overlord: "pterosaur",

  // 🌊 海生爬虫類
  plesio: "marine",
  mosasaurus: "marine",
  leviathan: "marine",
  boss_sea: "marine"
};

// IDや名前からタイプデータを取得
export function getDinoType(speciesId = "", name = "") {
  if (SPECIES_TYPE_MAP[speciesId]) {
    return DINO_TYPES[SPECIES_TYPE_MAP[speciesId]];
  }

  const key = `${speciesId} ${name}`.toLowerCase();
  if (key.includes("mosa") || key.includes("plesio") || key.includes("sea") || key.includes("モサ") || key.includes("プレシオ") || key.includes("海") || key.includes("リヴァイアサン")) {
    return DINO_TYPES.marine;
  }
  if (key.includes("ptera") || key.includes("quetzal") || key.includes("sky") || key.includes("プテラ") || key.includes("ケツァル") || key.includes("翼")) {
    return DINO_TYPES.pterosaur;
  }
  if (key.includes("brachio") || key.includes("tricera") || key.includes("stego") || key.includes("ankylo") || key.includes("ブラキオ") || key.includes("トリケラ") || key.includes("ステゴ") || key.includes("アンキロ")) {
    return DINO_TYPES.herbivore;
  }

  return DINO_TYPES.carnivore;
}

// 三すくみ相性の攻撃倍率を返す（攻撃側タイプ vs 防御側タイプ）
export function getTypeMatchupMultiplier(attackerTypeId, defenderTypeId) {
  if (attackerTypeId === "carnivore" && defenderTypeId === "herbivore") return 1.3;
  if (attackerTypeId === "herbivore" && defenderTypeId === "pterosaur") return 1.3;
  if (attackerTypeId === "pterosaur" && defenderTypeId === "carnivore") return 1.3;

  if (attackerTypeId === "herbivore" && defenderTypeId === "carnivore") return 0.75;
  if (attackerTypeId === "pterosaur" && defenderTypeId === "herbivore") return 0.75;
  if (attackerTypeId === "carnivore" && defenderTypeId === "pterosaur") return 0.75;

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
