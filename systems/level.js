export function requiredExp(level) {
  return level * 20;
}

export function addExp(dino, amount) {
  const maxLevel = dino.maxLevel ?? 20;

  // すでに上限レベルに達している場合は経験値を0にして止める
  if (dino.level >= maxLevel) {
    dino.level = maxLevel;
    dino.exp = 0;
    return;
  }

  dino.exp += amount;

  while (dino.exp >= requiredExp(dino.level) && dino.level < maxLevel) {
    dino.exp -= requiredExp(dino.level);
    dino.level++;
  }

  // レベルアップで上限に到達したら余剰EXPをリセット
  if (dino.level >= maxLevel) {
    dino.exp = 0;
  }
}
