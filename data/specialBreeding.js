export const SPECIAL_BREEDS = [
  // 1. 小型スピード特化（回避アタッカー向け）
  {
    parents: ["raptor", "compy"],
    result: {
      id: "shadowraptor",
      name: "シャドウラプトル",
      size: "small",
      rarity: 3,
      baseAtk: 42,
      baseHp: 85,
      baseSpd: 65
    }
  },

  // 2. 中型重装甲タイプ（高HP・高攻撃の安定型）
  {
    parents: ["triceratops", "stego"],
    result: {
      id: "aegistops",
      name: "イージストプス",
      size: "normal",
      rarity: 3,
      baseAtk: 68,
      baseHp: 190,
      baseSpd: 22
    }
  },

  // 3. 定番ハイブリッド（ラプトル × ティラノサウルス）
  {
    parents: ["raptor", "trex"],
    result: {
      id: "dragonraptor",
      name: "ドラゴンラプター",
      size: "large",
      rarity: 4,
      baseAtk: 105,
      baseHp: 195,
      baseSpd: 52
    }
  },

  // 4. 大型肉食ハイブリッド（ティラノ × スピノ）
  {
    parents: ["trex", "spino"],
    result: {
      id: "tyrannospino",
      name: "ティラノスピノ",
      size: "large",
      rarity: 4,
      baseAtk: 130,
      baseHp: 250,
      baseSpd: 48
    }
  },

  // 5. 巨大種ハイブリッド（ブラキオ × ギガノト）
  {
    parents: ["brachio", "giganoto"],
    result: {
      id: "gigabrachio",
      name: "ギガブラキオ",
      size: "giant",
      rarity: 5,
      baseAtk: 155,
      baseHp: 460,
      baseSpd: 26
    }
  },

  // 6. 2段階目の特殊交配（ドラゴンラプター × ギガノトサウルス）
  {
    parents: ["dragonraptor", "giganoto"],
    result: {
      id: "chaosdragon",
      name: "カオスドラゴン",
      size: "giant",
      rarity: 5,
      baseAtk: 190,
      baseHp: 380,
      baseSpd: 60
    }
  },

  // 7. エリアLv.4ハイブリッド（アンキロサウルス × アロサウルス）
  {
    parents: ["ankylo", "allo"],
    result: {
      id: "armored_allo",
      name: "アーマードアロ",
      size: "large",
      rarity: 5,
      baseAtk: 175,
      baseHp: 520,
      baseSpd: 42
    }
  },

  // 8. 究極の超耐久ハイブリッド（アンキロサウルス × ギガブラキオ）
  {
    parents: ["ankylo", "gigabrachio"],
    result: {
      id: "fortress_titan",
      name: "フォートレスタイタン",
      size: "giant",
      rarity: 5,
      baseAtk: 210,
      baseHp: 850,
      baseSpd: 25
    }
  },

  // 9. エリアLv.5頂点ハイブリッド（ケツァルコアトルス × オメガレックス）
  {
    parents: ["quetzal", "omega_rex"],
    result: {
      id: "sky_overlord",
      name: "スカイオーバーロード",
      size: "giant",
      rarity: 5,
      baseAtk: 280,
      baseHp: 780,
      baseSpd: 75
    }
  },

  // 10. 全交配ツリーの最終到達点（カオスドラゴン × オメガレックス）
  {
    parents: ["chaosdragon", "omega_rex"],
    result: {
      id: "genesis_dragon",
      name: "ジェネシスドラゴン",
      size: "giant",
      rarity: 6,
      baseAtk: 350,
      baseHp: 980,
      baseSpd: 85
    }
  }

];
