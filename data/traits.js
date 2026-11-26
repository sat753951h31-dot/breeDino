export const TRAITS = [
  {
    id: "fierce",
    icon: "🔥",
    name: "猛攻",
    desc: "攻撃力（ATK）が +15% 上昇する",
    effect: { atkMult: 0.15 }
  },
  {
    id: "sturdy",
    icon: "🛡️",
    name: "頑丈",
    desc: "最大HP が +20% 上昇する",
    effect: { hpMult: 0.20 }
  },
  {
    id: "swift",
    icon: "⚡",
    name: "神速",
    desc: "素早さ（SPD）が +20% 上昇する",
    effect: { spdMult: 0.20 }
  },
  {
    id: "evasive",
    icon: "🌀",
    name: "見切り",
    desc: "攻撃の回避率が +10% 上昇する",
    effect: { dodgeBonus: 0.10 }
  },
  {
    id: "endure",
    icon: "❤️‍🔥",
    name: "不屈",
    desc: "1回の戦闘につき1度だけ、HPが0になるダメージをHP1で耐える",
    effect: { endure: true }
  },
  {
    id: "glutton",
    icon: "🍖",
    name: "大食い",
    desc: "エサを食べたときの獲得EXPが 1.5倍 になる",
    effect: { feedExpMult: 1.5 }
  },
  {
    id: "prodigy",
    icon: "🎓",
    name: "早熟",
    desc: "探索・エサの獲得EXPが +25% 上昇する",
    effect: { allExpMult: 1.25 }
  },
  {
    id: "hunter",
    icon: "🍀",
    name: "幸運",
    desc: "探索での卵・生命の結晶・秘宝のドロップ率がそれぞれ +10% 上昇",
    effect: { dropBonus: 0.10 }
  },
  // 👇 配列形式（export const TRAITS = [ ... ]）の場合の追加コード
  {
    id: "iron_wall",
    icon: "🛡️",
    name: "鉄壁",
    desc: "受けるダメージを 25% 軽減する",
    effect: {
      damageTakenMult: 0.75
    }
  },
  {
    id: "regeneration",
    icon: "💚",
    name: "再生",
    desc: "戦闘中、毎ターン終了時に最大HPの 6% を回復する",
    effect: {
      regenRate: 0.06
    }
  },
  {
    id: "thorns",
    icon: "🦔",
    name: "棘の甲羅",
    desc: "最大HP +15% ＆ 被ダメージの 25% を相手に反射する",
    effect: {
      hpMult: 0.15,
      reflectRate: 0.25
    }
  }
];

export function getTraitData(traitId) {
  return TRAITS.find(t => t.id === traitId) ?? TRAITS;
}

// ランダムに1つ特性を抽選
export function rollTrait() {
  return TRAITS[Math.floor(Math.random() * TRAITS.length)].id;
}

// 両親の特性から子へ遺伝させる
export function inheritTrait(traitA, traitB) {
  const a = traitA ?? rollTrait();
  const b = traitB ?? rollTrait();
  const r = Math.random();

  // 両親が同じ特性なら 80% で確定継承、20% で突然変異
  if (a === b) {
    return r < 0.80 ? a : rollTrait();
  }

  // 異なる特性なら 45% で親A、45% で親B、10% で突然変異
  if (r < 0.45) return a;
  if (r < 0.90) return b;
  return rollTrait();
}
