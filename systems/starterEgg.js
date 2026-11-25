import { DINO_SPECIES }
from "../data/dinos.js";
import { calculateStats }
from "./stats.js";
import { rollTrait } from "../data/traits.js";

export function hatchStarterEgg(egg) {

  const candidates =
    DINO_SPECIES.filter(
      d => d.size === egg.size
    );

  const species =
    candidates[
      Math.floor(
        Math.random() * candidates.length
      )
    ];

    const dino = {

      uid: crypto.randomUUID(),

      speciesId: species.id,
      name: species.name,

      size: species.size,

      rarityType: egg.rarity,

      level: 1,
      maxLevel: 20,
      exp: 0,

      sex:
        Math.random() < 0.5
          ? "male"
          : "female",

      generation: 0,
      mutant: false,

      baseAtk: species.baseAtk,
      baseHp: species.baseHp,
      baseSpd: species.baseSpd,

      atkIv: Math.floor(Math.random() * 101),
      hpIv: Math.floor(Math.random() * 101),
      spdIv: Math.floor(Math.random() * 101),

      color: "normal",
      trait: rollTrait()
    };

    const stats =
      calculateStats(dino);

    dino.currentHp =
      stats.hp;

    return dino;
}

export function rollStarterEgg() {

  return {
    size: rollSize(),
    rarity: rollRarity()
  };
}

function rollSize() {

  const r = Math.random();

  if (r < 0.40) return "small";
  if (r < 0.75) return "normal";
  if (r < 0.95) return "large";

  return "giant";
}

function rollRarity() {

  const r = Math.random();

  if (r < 0.70) return "white";
  if (r < 0.90) return "blue";
  if (r < 0.98) return "purple";

  return "rainbow";
}

export function createWildEgg(size, rarity, timeMult = 1.0) {
  const hatchTimeMap = {
    white: 15000,
    blue: 30000,
    purple: 60000,
    rainbow: 120000
  };

  const baseTime = hatchTimeMap[rarity] ?? 15000;
  const finalTime = Math.floor(baseTime * timeMult);

  return {
    id: crypto.randomUUID(),
    size,
    rarity,
    createdAt: Date.now(),
    hatchAt: Date.now() + finalTime
  };
}
