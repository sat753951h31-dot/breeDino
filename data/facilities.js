export const FACILITY_MATERIALS = [
  { id: "wood", icon: "🪵", name: "古代の木材", desc: "遠征 Lv.1〜3 で入手" },
  { id: "stone", icon: "🪨", name: "神秘の石材", desc: "遠征 Lv.2〜4 で入手" },
  { id: "ore", icon: "🔮", name: "星屑の鉱石", desc: "遠征 Lv.4〜5 で入手" }
];

export const FACILITIES = [
  {
    key: "incubatorLevel",
    icon: "🥚",
    name: "孵化設備",
    baseDesc: "インキュベーターを改良し、卵の孵化時間を短縮する",
    levels: [
      { level: 1, effectText: "孵化時間 10% 短縮", val: 0.10, cost: { wood: 5, raw: 15 }, costText: "🪵 木材×5 ＋ 🍖 生肉×15" },
      { level: 2, effectText: "孵化時間 20% 短縮", val: 0.20, cost: { wood: 12, stone: 4, good: 10 }, costText: "🪵 木材×12 ＋ 🪨 石材×4 ＋ 🥩 上質肉×10" },
      { level: 3, effectText: "孵化時間 30% 短縮", val: 0.30, cost: { wood: 25, stone: 10, good: 25 }, costText: "🪵 木材×25 ＋ 🪨 石材×10 ＋ 🥩 上質肉×25" },
      { level: 4, effectText: "孵化時間 40% 短縮", val: 0.40, cost: { stone: 20, ore: 5, premium: 10 }, costText: "🪨 石材×20 ＋ 🔮 鉱石×5 ＋ ✨ 極上肉×10" },
      { level: 5, effectText: "孵化時間 50% 短縮", val: 0.50, cost: { stone: 40, ore: 15, premium: 25 }, costText: "🪨 石材×40 ＋ 🔮 鉱石×15 ＋ ✨ 極上肉×25" }
    ]
  },
  {
    key: "trainingLevel",
    icon: "⚔️",
    name: "訓練所",
    baseDesc: "拠点の鍛錬場を整備し、待機育成と獲得経験値を底上げする",
    levels: [
      { level: 1, effectText: "待機EXP +2(5秒毎) ＆ 獲得EXP +10%", standbyExp: 2, expMult: 0.10, cost: { wood: 6 }, costText: "🪵 古代の木材×6" },
      { level: 2, effectText: "待機EXP +4(5秒毎) ＆ 獲得EXP +20%", standbyExp: 4, expMult: 0.20, cost: { wood: 15, stone: 5 }, costText: "🪵 木材×15 ＋ 🪨 石材×5" },
      { level: 3, effectText: "待機EXP +6(5秒毎) ＆ 獲得EXP +30%", standbyExp: 6, expMult: 0.30, cost: { wood: 30, stone: 12 }, costText: "🪵 木材×30 ＋ 🪨 石材×12" },
      { level: 4, effectText: "待機EXP +8(5秒毎) ＆ 獲得EXP +40%", standbyExp: 8, expMult: 0.40, cost: { stone: 25, ore: 6 }, costText: "🪨 石材×25 ＋ 🔮 鉱石×6" },
      { level: 5, effectText: "待機EXP +10(5秒毎) ＆ 獲得EXP +50%", standbyExp: 10, expMult: 0.50, cost: { stone: 45, ore: 18 }, costText: "🪨 石材×45 ＋ 🔮 鉱石×18" }
    ]
  },
  {
    key: "kitchenLevel",
    icon: "🍳",
    name: "調理場",
    baseDesc: "お肉の調理技術を磨き、エサの経験値と回復量を高める",
    levels: [
      { level: 1, effectText: "エサEXP +20% ＆ 回復量 +5%", foodExpMult: 0.20, healBonus: 0.05, cost: { wood: 5, raw: 20 }, costText: "🪵 木材×5 ＋ 🍖 生肉×20" },
      { level: 2, effectText: "エサEXP +40% ＆ 回復量 +10%", foodExpMult: 0.40, healBonus: 0.10, cost: { wood: 12, stone: 5, good: 15 }, costText: "🪵 木材×12 ＋ 🪨 石材×5 ＋ 🥩 上質肉×15" },
      { level: 3, effectText: "エサEXP +60% ＆ 回復量 +15%", foodExpMult: 0.60, healBonus: 0.15, cost: { wood: 25, stone: 12, good: 30 }, costText: "🪵 木材×25 ＋ 🪨 石材×12 ＋ 🥩 上質肉×30" },
      { level: 4, effectText: "エサEXP +80% ＆ 回復量 +20%", foodExpMult: 0.80, healBonus: 0.20, cost: { stone: 22, ore: 5, premium: 12 }, costText: "🪨 石材×22 ＋ 🔮 鉱石×5 ＋ ✨ 極上肉×12" },
      { level: 5, effectText: "エサEXP +100% ＆ 回復量 +25%", foodExpMult: 1.00, healBonus: 0.25, cost: { stone: 40, ore: 15, premium: 30 }, costText: "🪨 石材×40 ＋ 🔮 鉱石×15 ＋ ✨ 極上肉×30" }
    ]
  },
  {
    key: "arenaLevel",
    icon: "🏟️",
    name: "古代の闘技場",
    baseDesc: "模擬戦を行う闘技場を建設し、全恐竜の基礎戦闘力を高める",
    levels: [
      { level: 1, effectText: "全ステータス +5%", statMult: 0.05, cost: { wood: 8, stone: 4 }, costText: "🪵 木材×8 ＋ 🪨 石材×4" },
      { level: 2, effectText: "全ステータス +10%", statMult: 0.10, cost: { wood: 16, stone: 10 }, costText: "🪵 木材×16 ＋ 🪨 石材×10" },
      { level: 3, effectText: "全ステータス +15%", statMult: 0.15, cost: { stone: 20, ore: 4 }, costText: "🪨 石材×20 ＋ 🔮 鉱石×4" },
      { level: 4, effectText: "全ステータス +20%", statMult: 0.20, cost: { stone: 35, ore: 10 }, costText: "🪨 石材×35 ＋ 🔮 鉱石×10" },
      { level: 5, effectText: "全ステータス +25%", statMult: 0.25, cost: { stone: 50, ore: 20, premium: 15 }, costText: "🪨 石材×50 ＋ 🔮 鉱石×20 ＋ ✨ 極上肉×15" }
    ]
  }
];

// 🔨 古代工房のクラフトレシピ
export const CRAFT_RECIPES = [
  {
    id: "craft_crystal",
    icon: "💎",
    name: "生命の結晶 ×3",
    desc: "生命の結晶を精製する",
    cost: { wood: 15, stone: 8 },
    costText: "🪵 木材×15 ＋ 🪨 石材×8"
  },
  {
    id: "craft_premium_meat",
    icon: "✨",
    name: "極上肉 ×5",
    desc: "余った木材と生肉を燻製して極上肉に仕上げる",
    cost: { wood: 10, raw: 20 },
    costText: "🪵 木材×10 ＋ 🍖 生肉×20"
  },
  {
    id: "craft_trait_fruit",
    icon: "🎲",
    name: "特性変更の果実 ×1",
    desc: "恐竜の「特性」をランダムに再抽選する",
    cost: { stone: 20, ore: 5 },
    costText: "🪨 石材×20 ＋ 🔮 鉱石×5"
  },
  {
    id: "craft_iv_elixir",
    icon: "💉",
    name: "個体値強化の秘薬 ×1",
    desc: "相棒の個体値（ATK・HP・SPD IV）をすべて +10 する（通常上限100 / 変異体上限150）",
    cost: { stone: 25, ore: 10 },
    costText: "🪨 石材×25 ＋ 🔮 鉱石×10"
  },
  {
    id: "craft_size_potion",
    icon: "📏",
    name: "体格変化の薬 ×1",
    desc: "相棒の体格（小型・中型・大型・巨大）をランダムで別のサイズへ変化させる",
    cost: { wood: 15, ore: 5 },
    costText: "🪵 木材×15 ＋ 🔮 鉱石×5"
  }
];

// 🗿 古代のモニュメント（無限強化）の次の強化コスト計算
export function getMonumentUpgradeCost(currentLv = 0) {
  const nextLv = currentLv + 1;
  return {
    nextLv,
    wood: 15 + currentLv * 5,
    stone: 10 + currentLv * 4,
    ore: 3 + Math.floor(currentLv * 1.5),
    costText: `🪵 木材×${15 + currentLv * 5} ＋ 🪨 石材×${10 + currentLv * 4} ＋ 🔮 鉱石×${3 + Math.floor(currentLv * 1.5)}`
  };
}

export const MAX_FACILITY_LEVEL = 5;

// 現在の設備ボーナスをまとめて取得するヘルパー
export function getFacilityBonuses(facility = {}) {
  const incDef = FACILITIES.find(f => f.key === "incubatorLevel");
  const trnDef = FACILITIES.find(f => f.key === "trainingLevel");
  const kitDef = FACILITIES.find(f => f.key === "kitchenLevel");
  const arnDef = FACILITIES.find(f => f.key === "arenaLevel");

  const incInfo = incDef?.levels.find(l => l.level === (facility.incubatorLevel ?? 0));
  const trnInfo = trnDef?.levels.find(l => l.level === (facility.trainingLevel ?? 0));
  const kitInfo = kitDef?.levels.find(l => l.level === (facility.kitchenLevel ?? 0));
  const arnInfo = arnDef?.levels.find(l => l.level === (facility.arenaLevel ?? 0));

  const monumentLv = facility.monumentLevel ?? 0;

  return {
    hatchTimeMult: incInfo ? Math.max(0.1, 1 - incInfo.val) : 1.0,
    standbyExp: trnInfo ? trnInfo.standbyExp : 0,
    expMult: trnInfo ? trnInfo.expMult : 0,
    foodExpMult: kitInfo ? kitInfo.foodExpMult : 0,
    healBonus: kitInfo ? kitInfo.healBonus : 0,
    // 闘技場（最大+25%） ＋ モニュメント（Lv1ごとに+2%・上限なし）
    statMult: (arnInfo ? arnInfo.statMult : 0) + (monumentLv * 0.02)
  };
}

