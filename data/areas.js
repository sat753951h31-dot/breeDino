export const AREAS = [
  {
    level: 1,
    name: "🌿 はじまりの草原",
    huntLevel: 1,
    enemyTypes: ["herbivore"],
    enemyDesc: "🌿 草食恐竜のみ",
    recommendDesc: "🍖 肉食タイプ（相性有利 1.3倍！） ※海生は 0.75倍 に低下",
    enemyScale: 1.0,
    expBonus: 15,
    progressPerWin: 20,
    eggChance: 0.25,
    eggMinRarity: "white",
    crystalChance: 0.30,
    foodRates: { premium: 0.02, good: 0.23 },
    firstClearReward: {
      egg: { size: "normal", rarity: "blue" },
      foods: { good: 3 },
      message: "🔵 青卵 ＋ 🥩 上質肉×3"
    }
  },
  {
    level: 2,
    name: "🌲 深い密林",
    huntLevel: 2,
    enemyTypes: ["carnivore"],
    enemyDesc: "🍖 肉食恐竜のみ",
    recommendDesc: "🦅 翼竜タイプ（相性有利 1.3倍！） ※海生は 0.75倍 に低下",
    enemyScale: 1.0,
    expBonus: 30,
    progressPerWin: 15,
    eggChance: 0.28,
    eggMinRarity: "white",
    crystalChance: 0.35,
    foodRates: { premium: 0.05, good: 0.30 },
    firstClearReward: {
      egg: { size: "large", rarity: "blue" },
      foods: { good: 5 },
      message: "🔵 青卵（大）＋ 🥩 上質肉×5"
    }
  },
  {
    level: 3,
    name: "🌋 灼熱の火山地帯",
    huntLevel: 3,
    enemyTypes: ["pterosaur"],
    enemyDesc: "🦅 翼竜のみ",
    recommendDesc: "🌿 草食タイプ（相性有利 1.3倍！） ※海生は 0.75倍 に低下",
    enemyScale: 1.0,
    expBonus: 55,
    progressPerWin: 15,
    eggChance: 0.30,
    eggMinRarity: "blue",
    crystalChance: 0.40,
    foodRates: { premium: 0.10, good: 0.35 },
    firstClearReward: {
      egg: { size: "normal", rarity: "purple" },
      foods: { premium: 2 },
      message: "🟣 紫卵 ＋ ✨ 極上肉×2"
    }
  },
  {
    level: 4,
    name: "🌫️ 古代の魔境",
    huntLevel: 4,
    enemyTypes: ["carnivore", "herbivore", "pterosaur"],
    enemyDesc: "🍖 肉食・🌿 草食・🦅 翼竜（海生以外）",
    recommendDesc: "🌊 海生以外（相手に合わせて相性有利を狙おう）",
    enemyScale: 1.1,
    expBonus: 85,
    progressPerWin: 10,
    eggChance: 0.32,
    eggMinRarity: "blue",
    crystalChance: 0.45,
    foodRates: { premium: 0.15, good: 0.40 },
    firstClearReward: {
      egg: { size: "large", rarity: "purple" },
      foods: { premium: 3 },
      message: "🟣 紫卵（大）＋ ✨ 極上肉×3"
    }
  },
  {
    level: 5,
    name: "👑 竜王の聖域",
    huntLevel: 5,
    enemyTypes: ["carnivore", "herbivore", "pterosaur"],
    enemyDesc: "🍖 肉食・🌿 草食・🦅 翼竜（海生以外）",
    recommendDesc: "🌊 海生以外（育成した最強エースで挑もう）",
    enemyScale: 1.25,
    expBonus: 120,
    progressPerWin: 10,
    eggChance: 0.35,
    eggMinRarity: "purple",
    crystalChance: 0.50,
    foodRates: { premium: 0.20, good: 0.45 },
    firstClearReward: {
      egg: { size: "giant", rarity: "rainbow" },
      foods: { premium: 5 },
      message: "🌈 虹卵（巨大）＋ ✨ 極上肉×5"
    }
  },
  {
    level: 6,
    name: "🌊 太古の深海（海エリア）",
    huntLevel: 6,
    isSea: true,
    enemyTypes: ["marine"],
    enemyDesc: "🌊 海生爬虫類のみ",
    recommendDesc: "🌊 海生タイプ（能力 1.35倍！ ※海生以外は 0.75倍 に低下）",
    enemyScale: 1.35,
    expBonus: 160,
    progressPerWin: 10,
    eggChance: 0.35,
    eggMinRarity: "purple",
    crystalChance: 0.55,
    foodRates: { premium: 0.25, good: 0.45 },
    firstClearReward: {
      egg: { size: "giant", rarity: "rainbow" },
      foods: { premium: 5 },
      message: "🌈 虹卵（巨大）＋ ✨ 極上肉×5"
    }
  }
];
