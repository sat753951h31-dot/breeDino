import { DINO_SPECIES }
from "./dinos.js";

import {
  SPECIAL_BREEDS
}
from "./specialBreeding.js";

export const DEX_SPECIES = [

  ...DINO_SPECIES.map(dino => ({
    id: dino.id,
    name: dino.name,
    special: false
  })),

  ...SPECIAL_BREEDS.map(breed => ({
    id: breed.result.id,
    name: breed.result.name,
    special: true,
    parents: breed.parents
  }))
];