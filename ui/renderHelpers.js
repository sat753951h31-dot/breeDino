import { calculateStats } from "../systems/stats.js";
import { DINO_SPECIES } from "../data/dinos.js";
import { SPECIAL_BREEDS } from "../data/specialBreeding.js";
import { getRarityLabel } from "./labels.js";

export function getSpeciesName(id) {
  const dino = DINO_SPECIES.find(d => d.id === id);
  if (dino) return dino.name;

  const special = SPECIAL_BREEDS.find(b => b.result.id === id);
  return special ? special.result.name : id;
}

export function getSpeciesDetail(id) {
  const normal = DINO_SPECIES.find(d => d.id === id);
  if (normal) return normal;

  const special = SPECIAL_BREEDS.find(b => b.result.id === id);
  return special ? special.result : null;
}

export function getBloodlineBonus(dino) {
  if (!dino) return 0;
  const gen = dino.generation ?? 0;
  const maxLv = dino.maxLevel ?? (20 + gen * 5);
  return Math.max(0, maxLv - (20 + gen * 5));
}

export function renderGenBadge(dino) {
  const gen = dino.generation ?? 0;
  const genBaseMax = 20 + gen * 5;
  const maxAllowedBonus = gen * 10;
  const maxLv = dino.maxLevel ?? genBaseMax;
  const currentBonus = Math.max(0, maxLv - genBaseMax);

  const baseAtk = calculateStats({ ...dino, generation: 0 }).atk;
  const curAtk = calculateStats(dino).atk;
  const genMult = baseAtk > 0 ? (curAtk / baseAtk) : 1;
  const multPercent = Math.round((genMult - 1) * 100);
  const genDefPercent = Math.min(75, gen * 2);

  const desc =
    `・世代ステータス倍率：${genMult.toFixed(2)}倍（+${multPercent}%）\n` +
    `・血統の加護（被ダメージ軽減）：-${genDefPercent}%（1世代ごとに2%軽減 / 最大75%）\n` +
    `・現在のレベル上限：Lv.${maxLv}\n` +
    `　（F${gen}基本 Lv.${genBaseMax} ＋ 継承ボーナス +${currentBonus}）\n` +
    `・F${gen}の最大上限目安：Lv.${genBaseMax + maxAllowedBonus}（ボーナス上限 +${maxAllowedBonus}）`;

  return `<span class="badge-gen" data-badge-title="🧬 世代情報【F${gen}】" data-badge-desc="${desc}">F${gen}</span>`;
}

export function renderRarityBadge(dino) {
  const rarity = dino.rarityType ?? "white";
  const label = getRarityLabel(rarity);

  const whiteAtk = calculateStats({ ...dino, rarityType: "white" }).atk;
  const curAtk = calculateStats(dino).atk;
  const rarityMult = whiteAtk > 0 ? (curAtk / whiteAtk) : 1;
  const multPercent = Math.round((rarityMult - 1) * 100);

  const noteMap = {
    white: "最も標準的なレア度です。交配のベースや素材集めに活躍します。",
    blue: "基本能力が少し高い希少個体です。序盤〜中盤の主力に向いています。",
    purple: "非常に高い基礎能力を持つ上位個体です。交配の親としても優秀です。",
    rainbow: "最高峰のステータス倍率を誇る伝説級の個体です！"
  };

  const desc =
    `・レア度ステータス倍率：${rarityMult.toFixed(2)}倍（+${multPercent}%）\n` +
    `・特徴：${noteMap[rarity] ?? ""}`;

  return `<span class="badge-rarity" data-badge-title="✨ レア度情報【${label}】" data-badge-desc="${desc}">${label}</span>`;
}

export function renderMutantBadge(dino) {
  if (!dino?.mutant) return "";

  const desc =
    `・突然変異によって誕生した希少な覚醒個体です！\n` +
    `・通常の上限（IV 100）を超える高い個体値（最大150）や特別なオーラを宿しています。\n` +
    `・交配の親にすると、その高い個体値を次世代へ引き継ぐことができます。`;

  return `<span class="badge-mutant" data-badge-title="🧬 突然変異【MUTANT】" data-badge-desc="${desc}">🧬 MUTANT</span>`;
}
