export const AREAS = [
  {
    level: 1,
    name: "エリア Lv.1（始まりの草原）",
    huntLevel: 1,
    progressPerWin: 20, // 5回勝利で100%
    expBonus: 10,
    eggChance: 0.20,
    crystalChance: 0.30,
    eggMinRarity: "white",
    foodRates: { premium: 0.05, good: 0.25 }, // 残り70%が生肉
    firstClearReward: {
      egg: { size: "normal", rarity: "blue" },
      foods: { good: 3 },
      message: "🔵 青卵（普通サイズ）と上質肉×3"
    }
  },
  {
    level: 2,
    name: "エリア Lv.2（深緑の密林）",
    huntLevel: 10,
    progressPerWin: 15, // 7回勝利で100%
    expBonus: 40,
    eggChance: 0.30,
    crystalChance: 0.40,
    eggMinRarity: "blue", // Lv.2の卵は最低でも青レア以上！
    foodRates: { premium: 0.15, good: 0.45 }, // 残り40%が生肉
    firstClearReward: {
      egg: { size: "large", rarity: "purple" },
      foods: { premium: 2 },
      message: "🟣 紫卵（大きいサイズ）と極上肉×2"
    }
  },
  {
    level: 3,
    name: "エリア Lv.3（灼熱の火山）",
    huntLevel: 20,
    progressPerWin: 10, // 10回勝利で100%
    expBonus: 100,
    eggChance: 0.40,
    crystalChance: 0.50,
    eggMinRarity: "purple", // Lv.3の卵は最低でも紫レア以上！
    foodRates: { premium: 0.35, good: 0.50 }, // 残り15%が生肉
    firstClearReward: {
      egg: { size: "giant", rarity: "rainbow" },
      foods: { premium: 5 },
      message: "🌈 虹卵（巨大サイズ）と極上肉×5"
    }
  },
  // --- 既存のエリア Lv.3 の後に追加 ---

  {
    level: 4,
    name: "エリア Lv.4（古代の魔境）",
    huntLevel: 30,
    enemyScale: 1.25, // 敵のステータス1.25倍
    progressPerWin: 8, // 13回勝利で100%
    expBonus: 220,
    eggChance: 0.45,
    crystalChance: 0.60,
    eggMinRarity: "purple",
    foodRates: { premium: 0.50, good: 0.40 }, // 50%で極上肉
    firstClearReward: {
      egg: { size: "giant", rarity: "rainbow" },
      foods: { premium: 8 },
      message: "🌈 虹卵（巨大サイズ）と極上肉×8"
    }
  },
  {
    level: 5,
    name: "エリア Lv.5（竜王の聖域）",
    huntLevel: 40,
    enemyScale: 1.60, // 敵のステータス1.6倍（最終エンドコンテンツ）
    progressPerWin: 5, // 20回勝利で100%
    expBonus: 500,
    eggChance: 0.55,
    crystalChance: 0.75,
    eggMinRarity: "rainbow", // ドロップする卵がすべて虹卵確定！
    foodRates: { premium: 0.75, good: 0.25 }, // 75%で極上肉
    firstClearReward: {
      egg: { size: "giant", rarity: "rainbow" },
      foods: { premium: 15 },
      message: "🌈 虹卵（巨大サイズ）と極上肉×15"
    }
  }

];
