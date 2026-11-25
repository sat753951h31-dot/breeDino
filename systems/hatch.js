import { DINO_SPECIES } from "../data/dinos.js";

function randomIV() {
  return Math.floor(Math.random() * 101);
}

function rollColor() {
  const r = Math.random();

  if (r < 0.005) {
    return "rainbow";
  }

  if (r < 0.02) {
    return "gold";
  }

  if (r < 0.05) {
    return "blue";
  }

  return "normal";
}

export function hatchEgg() {
  const species =
    DINO_SPECIES[
      Math.floor(
        Math.random() * DINO_SPECIES.length
      )
    ];

  return {
    uid: crypto.randomUUID(),

    speciesId: species.id,
    name: species.name,
    
    rarity: species.rarity,
    color: rollColor(),
    generation: 0,
    mutant: false,

    sex: rollSex(),
    
    baseAtk: species.baseAtk,
    baseHp: species.baseHp,
    baseSpd: species.baseSpd,
  
    level: 1,
    exp: 0,
    
    generation:
      Math.max(
        parentA.generation,
        parentB.generation
      ) + 1,

    atkIv: randomIV(),
    hpIv: randomIV(),
    spdIv: randomIV()
  };
}

function rollSex() {

  return Math.random() < 0.5
    ? "male"
    : "female";
}