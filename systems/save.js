import { rollTrait } from "../data/traits.js";

const SAVE_KEY = "dinoBreederSave";

export function loadGame() {
  const data = localStorage.getItem(SAVE_KEY);

  if (data) {

    const save = JSON.parse(data);

    save.breedingEggs ??= [];

    save.dinos.forEach(dino => {

      dino.generation ??= 0;
      dino.sex ??= Math.random() < 0.5 ? "male" : "female";
      dino.size ??= "normal";
      dino.rarityType ??= "white";
      dino.maxLevel ??= Math.max(dino.level, 20 + dino.generation * 5);
      dino.trait ??= rollTrait();

    });
    
    save.discoveredSpecies ??= [];
    save.activeDinoId ??= null;
    save.foods ??= {
      raw: 0,
      good: 0,
      premium: 0
    };

    save.wildEggs ??= [];
    save.wildEggs.forEach(egg => {
      egg.hatchAt ??= Date.now();
    });

    save.activeDinoId ??= null;

    save.breedingEggs ??= [];
    save.huntLogs ??= [];

    save.unlockedAreaLevel ??= 1;
    save.selectedAreaLevel ??= 1;
    save.areaProgress ??= { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    save.areaCleared ??= { 1: false, 2: false, 3: false, 4: false, 5: false };

    save.items ??= { breedCrystal: 1 };
    save.items.breedCrystal ??= 1;
    save.stats.crystalsEarned ??= 0;
    save.stats.dinosLost ??= 0;
    if (Array.isArray(save.treasures)) {
      // 旧データ（配列）を { id: 1 } の形式へ自動変換
      const converted = {};
      save.treasures.forEach(id => {
        converted[id] = 1;
      });
      save.treasures = converted;
    }
    save.treasures ??= [];
    save.bossCleared ??= { 1: false, 2: false, 3: false, 4: false, 5: false };
    save.stats.bossWins ??= 0;
    save.lastSavedAt ??= Date.now();
    save.facility ??= { incubatorLevel: 0 };
    save.facility.incubatorLevel ??= 0;
    save.expeditions ??= [];
    save.expeditionDraft ??= { areaLevel: 1, memberIds: [] };
    save.stats.expeditionsDone ??= 0;

    save.unlockedAchievements ??= [];
    if (!save.stats) {
      // 既存セーブデータからの引き継ぎ計算
      const maxGen = save.dinos.reduce((max, d) => Math.max(max, d.generation ?? 0), 0);
      const mutants = save.dinos.filter(d => d.mutant).length;

      save.stats = {
        exploreWins: 0,
        eggsHatched: save.dinos.length,
        breedsDone: 0,
        mutantsBorn: mutants,
        maxGeneration: maxGen,
        dinosReleased: 0,
        crystalsEarned: 0,
        dinosLost: 0
      };
    }

    return save;
  }

  return {
    dinos: [],

    breedingEggs: [],
    wildEggs: [],

    foods: {
      raw: 0,
      good: 0,
      premium: 0
    },

    activeDinoId: null,

    discoveredSpecies: [],
    huntLogs: [],

    starterEgg: null,
    starterSelected: false,

    unlockedAreaLevel: 1,
    selectedAreaLevel: 1,
    areaProgress: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    areaCleared: { 1: false, 2: false, 3: false, 4: false, 5: false },
    unlockedAchievements: [],
    treasures: [],
    bossCleared: { 1: false, 2: false, 3: false, 4: false, 5: false },
    lastSavedAt: Date.now(),
    expeditions: [],
    expeditionDraft: { areaLevel: 1, memberIds: [] },
    facility: {
      incubatorLevel: 0
    },
    items: {
      breedCrystal: 1
    },
    stats: {
      exploreWins: 0,
      eggsHatched: 0,
      breedsDone: 0,
      mutantsBorn: 0,
      maxGeneration: 0,
      dinosReleased: 0,
      bossWins: 0,
      expeditionsDone: 0,
    },

  };
}

export function saveGame(gameData) {
  gameData.lastSavedAt = Date.now();
  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify(gameData)
  );
}

function addLog(text) {

  game.huntLogs.unshift(text);

  game.huntLogs =
    game.huntLogs.slice(
      0,
      30
    );
}
