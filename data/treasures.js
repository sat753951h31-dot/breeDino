export const MAX_TREASURE_LEVEL = 5;

export const TREASURES = [
  {
    id: "amber_origin",
    areaLevel: 1,
    icon: "🟠",
    name: "始まりの琥珀",
    dropChance: 0.12,
    effect: { standbyExp: 1 }
  },
  {
    id: "jade_fang",
    areaLevel: 2,
    icon: "🦷",
    name: "密林の翡翠牙",
    dropChance: 0.10,
    effect: { atkMult: 0.10 }
  },
  {
    id: "blazing_orb",
    areaLevel: 3,
    icon: "🔮",
    name: "灼熱の竜玉",
    dropChance: 0.10,
    effect: { hpMult: 0.15 }
  },
  {
    id: "ancient_feather",
    areaLevel: 4,
    icon: "🪶",
    name: "古代の風切羽",
    dropChance: 0.08,
    effect: { spdMult: 0.15 }
  },
  {
    id: "dragon_crown",
    areaLevel: 5,
    icon: "👑",
    name: "竜王の王冠",
    dropChance: 0.08,
    effect: { atkMult: 0.10, hpMult: 0.10, spdMult: 0.10, standbyExp: 2 }
  },
  {
    id: "sea_trident",
    areaLevel: 6,
    icon: "🔱",
    name: "海神のトライデント",
    dropChance: 0.08, // 8%でドロップ（重複でLv.5まで強化）
    effect: {
      atkMult: 0.06, // Lv.1につき攻撃 +6%（Lv.5で +30%）
      hpMult: 0.06,  // Lv.1につきHP +6%（Lv.5で +30%）
      spdMult: 0.06  // Lv.1につき素早さ +6%（Lv.5で +30%）
    }
  }
];

// レベルに応じた効果説明文を生成（未所持時はLv.1の効果を表示）
export function getTreasureDesc(treasure, level = 1) {
  const lv = Math.max(1, level);
  const e = treasure.effect;
  const parts = [];

  if (e.atkMult && e.hpMult && e.spdMult && e.atkMult === e.hpMult && e.hpMult === e.spdMult) {
    parts.push(`全ステータス +${Math.round(e.atkMult * lv * 100)}%`);
  } else {
    if (e.atkMult) parts.push(`攻撃力 +${Math.round(e.atkMult * lv * 100)}%`);
    if (e.hpMult) parts.push(`最大HP +${Math.round(e.hpMult * lv * 100)}%`);
    if (e.spdMult) parts.push(`素早さ +${Math.round(e.spdMult * lv * 100)}%`);
  }

  if (e.standbyExp) {
    parts.push(`待機恐竜が5秒ごとに EXP +${e.standbyExp * lv}`);
  }

  return parts.join(" ＆ ");
}
