export function rarityStars(rarity) {
  if (rarity >= 6) return "★★★★★★👑";
  if (rarity >= 5) return "★★★★★✨";
  return "★".repeat(rarity);
}

export function getColorLabel(color) {
  switch (color) {
    case "blue": return "🔵 青色";
    case "gold": return "🟡 金色";
    case "rainbow": return "🌈 虹色";
    default: return "🌿 通常色";
  }
}

export function getSizeLabel(size) {
  switch (size) {
    case "small": return "小さい";
    case "normal": return "普通";
    case "large": return "大きい";
    case "giant": return "巨大";
    default: return size;
  }
}

export function getRarityLabel(rarity) {
  switch (rarity) {
    case "blue": return "🔵 青";
    case "purple": return "🟣 紫";
    case "rainbow": return "🌈 虹";
    default: return "⚪ 白";
  }
}

export function getEggRarityLabel(rarity) {
  switch (rarity) {
    case "blue": return "🔵 青卵";
    case "purple": return "🟣 紫卵";
    case "rainbow": return "🌈 虹卵";
    default: return "⚪ 白卵";
  }
}

export function getSexLabel(sex) {
  if (sex === "male") {
    return `<span class="sex-male">♂ オス</span>`;
  }
  if (sex === "female") {
    return `<span class="sex-female">♀ メス</span>`;
  }
  return "不明";
}