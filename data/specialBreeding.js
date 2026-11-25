export const SPECIAL_BREEDS = [
  // 1. 小型スピード特化（回避アタッカー向け）
  {
    parents: ["raptor", "compy"],
    result: {
      id: "shadowraptor",
      name: "シャドウラプトル",
      type: "carnivore",
      archetype: "theropod",
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
      type: "herbivore",
      archetype: "ceratopsian",
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
      type: "carnivore",
      archetype: "dragon",
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
      type: "carnivore",
      archetype: "theropod",
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
      type: "herbivore",
      archetype: "sauropod",
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
      type: "carnivore",
      archetype: "dragon",
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
      type: "herbivore",
      archetype: "armored",
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
      type: "herbivore",
      archetype: "armored",
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
      type: "pterosaur",
      archetype: "dragon",
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
      type: "carnivore",
      archetype: "dragon",
      size: "giant",
      rarity: 6,
      baseAtk: 350,
      baseHp: 980,
      baseSpd: 85
    }
  },

  // 11. 草食突撃ハイブリッド（パキケファロ × トリケラトプス）
  {
    parents: ["pachy", "triceratops"],
    result: {
      id: "ceratops_king",
      name: "ケラトプスキング",
      type: "herbivore",
      archetype: "ceratopsian",
      size: "large",
      rarity: 4,
      baseAtk: 135,
      baseHp: 340,
      baseSpd: 36
    }
  },

  // 12. 翼竜ハイブリッド（プテラノドン × ケツァルコアトルス）
  {
    parents: ["pteranodon", "quetzal"],
    result: {
      id: "storm_wyvern",
      name: "ストームワイバーン",
      type: "pterosaur",
      archetype: "pterosaur",
      size: "giant",
      rarity: 5,
      baseAtk: 215,
      baseHp: 490,
      baseSpd: 82
    }
  },

  // 13. 鋭爪の草食ハイブリッド（テリジノサウルス × アンキロサウルス）
  {
    parents: ["therizino", "ankylo"],
    result: {
      id: "scythe_titan",
      name: "サイスタイタン",
      type: "herbivore",
      archetype: "armored",
      size: "giant",
      rarity: 5,
      baseAtk: 245,
      baseHp: 680,
      baseSpd: 44
    }
  },

  // 14. 高速肉食ハイブリッド（カルノタウルス × スピノサウルス）
  {
    parents: ["carno", "spino"],
    result: {
      id: "inferno_rex",
      name: "インフェルノレックス",
      type: "carnivore",
      archetype: "theropod",
      size: "giant",
      rarity: 5,
      baseAtk: 230,
      baseHp: 470,
      baseSpd: 68
    }
  },

  // 15. 海生ハイブリッド第1段階（プレシオサウルス × モササウルス）
  {
    parents: ["plesio", "mosasaurus"],
    result: {
      id: "kronosaurus",
      name: "クロノサウルス",
      type: "marine",
      archetype: "theropod",
      size: "giant",
      rarity: 5,
      baseAtk: 185,
      baseHp: 560,
      baseSpd: 52
    }
  },

  // 16. 海生ハイブリッド頂点（クロノサウルス × リヴァイアサン）
  {
    parents: ["kronosaurus", "leviathan"],
    result: {
      id: "abyss_leviathan",
      name: "アビスリヴァイアサン",
      type: "marine",
      archetype: "dragon",
      size: "giant",
      rarity: 6,
      baseAtk: 310,
      baseHp: 890,
      baseSpd: 76
    }
  },

  // 17. 天空の翼竜頂点（ストームワイバーン × スカイオーバーロード）
  {
    parents: ["storm_wyvern", "sky_overlord"],
    result: {
      id: "tempest_dragon",
      name: "テンペストドラゴン",
      type: "pterosaur",
      archetype: "dragon",
      size: "giant",
      rarity: 6,
      baseAtk: 335,
      baseHp: 860,
      baseSpd: 95
    }
  }
];
