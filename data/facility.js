export const INCUBATOR_LEVELS = [
  {
    level: 1,
    reduction: 0.10, // 10%短縮
    cost: { raw: 15 },
    costText: "🍖 生肉 ×15"
  },
  {
    level: 2,
    reduction: 0.20, // 20%短縮
    cost: { raw: 30, good: 10 },
    costText: "🍖 生肉 ×30 ＋ 🥩 上質肉 ×10"
  },
  {
    level: 3,
    reduction: 0.30, // 30%短縮
    cost: { raw: 50, good: 25 },
    costText: "🍖 生肉 ×50 ＋ 🥩 上質肉 ×25"
  },
  {
    level: 4,
    reduction: 0.40, // 40%短縮
    cost: { good: 50, premium: 10 },
    costText: "🥩 上質肉 ×50 ＋ ✨ 極上肉 ×10"
  },
  {
    level: 5,
    reduction: 0.50, // 50%短縮（半減）
    cost: { good: 100, premium: 25 },
    costText: "🥩 上質肉 ×100 ＋ ✨ 極上肉 ×25"
  }
];

export const MAX_INCUBATOR_LEVEL = INCUBATOR_LEVELS.length;

// 現在の設備レベルに応じた孵化時間倍率を返す（例: Lv.5なら 0.5倍）
export function getHatchTimeMultiplier(level = 0) {
  if (level <= 0) return 1.0;
  const info = INCUBATOR_LEVELS.find(item => item.level === level);
  const reduction = info ? info.reduction : 0.50;
  return Math.max(0.1, 1 - reduction);
}
