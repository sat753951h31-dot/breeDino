import { DINO_SPECIES } from "../data/dinos.js";
import { AREAS } from "../data/areas.js";
import { getTraitData } from "../data/traits.js";

const SIZE_RANK = {
  small: 1,
  normal: 2,
  large: 3,
  giant: 4
};

export function getEnemyForArea(areaLevel) {
  const area = AREAS.find(a => a.level === areaLevel) ?? AREAS;
  const candidates = DINO_SPECIES.filter(d => d.huntLevel === area.huntLevel);

  const baseEnemy = candidates.length > 0
    ? candidates[Math.floor(Math.random() * candidates.length)]
    : DINO_SPECIES;

  const scale = area.enemyScale ?? 1.0;

  // 元の種族データを書き換えないようコピーして強化倍率を適用
  return {
    ...baseEnemy,
    name: scale > 1 ? `【凶暴】${baseEnemy.name}` : baseEnemy.name,
    baseAtk: Math.floor(baseEnemy.baseAtk * scale),
    baseHp: Math.floor(baseEnemy.baseHp * scale),
    baseSpd: Math.floor(baseEnemy.baseSpd * scale)
  };
}

function getDinoSize(dino) {
  if (dino.size) return dino.size;
  const species = DINO_SPECIES.find(d => d.id === dino.speciesId);
  return species ? species.size : "normal";
}

export function getSizeDamageMultiplier(attackerSize, defenderSize) {
  const atkRank = SIZE_RANK[attackerSize] ?? 2;
  const defRank = SIZE_RANK[defenderSize] ?? 2;
  return Math.max(0.5, 1 + (atkRank - defRank) * 0.15);
}

// 回避率計算に防御側の特性ボーナスを加算
export function getDodgeChance(defenderSpd, attackerSpd, dodgeBonus = 0) {
  const baseDodge = defenderSpd <= attackerSpd
    ? 0.03
    : Math.min(0.5, 0.03 + (defenderSpd - attackerSpd) * 0.01);

  return Math.min(0.65, baseDodge + dodgeBonus);
}

export function getEnemyForHunt(areaLevel) {
  let candidates = DINO_SPECIES.filter(
    d => d.huntLevel <= areaLevel && d.huntLevel >= areaLevel - 2
  );

  if (candidates.length === 0) {
    const available = DINO_SPECIES.filter(d => d.huntLevel <= areaLevel);
    if (available.length > 0) {
      const maxHuntLevel = Math.max(...available.map(d => d.huntLevel));
      candidates = available.filter(d => d.huntLevel === maxHuntLevel);
    } else {
      candidates = DINO_SPECIES;
    }
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

// performAttack に dodgeBonus 引数を追加
function performAttack(attackerName, atk, atkSpd, defenderName, defenderHp, defSpd, addLog, dodgeBonus = 0) {
  if (Math.random() < getDodgeChance(defSpd, atkSpd, dodgeBonus)) {
    addLog(`💨 ${defenderName} は素早く攻撃を回避した！`);
    return defenderHp;
  }

  addLog(`💥 ${attackerName} の攻撃！ ${atk}ダメージ`);
  return defenderHp - atk;
}

export function battle(player, playerStats, enemy, isCritical, addLog) {
  let playerHp = Number(player.currentHp);
  if (Number.isNaN(playerHp)) playerHp = playerStats.hp;

  let enemyHp = enemy.baseHp;

  // プレイヤーの特性効果を取得
  const playerTrait = getTraitData(player.trait);
  const playerDodgeBonus = playerTrait.effect.dodgeBonus ?? 0;
  let endureUsed = false; // 特性「不屈」の発動フラグ

  const playerSize = getDinoSize(player);
  const enemySize = getDinoSize(enemy);

  const playerSizeMult = getSizeDamageMultiplier(playerSize, enemySize);
  const enemySizeMult = getSizeDamageMultiplier(enemySize, playerSize);

  let playerAtk = Math.max(1, Math.floor(playerStats.atk * playerSizeMult));
  const enemyAtk = Math.max(1, Math.floor(enemy.baseAtk * enemySizeMult));

  if (isCritical) {
    playerAtk = Math.max(1, Math.floor(playerAtk * 0.7));
  }

  const playerFirst = playerStats.spd >= enemy.baseSpd;

  addLog(`⚔️ ${enemy.name} (Lv${enemy.huntLevel}) と遭遇`);

  if (playerSizeMult > 1) {
    addLog(`📏 体格で勝っている！（与ダメージ ${Math.round(playerSizeMult * 100)}%）`);
  } else if (playerSizeMult < 1) {
    addLog(`📏 相手の方が大きい…（与ダメージ ${Math.round(playerSizeMult * 100)}%）`);
  }

  if (isCritical) {
    addLog("⚠️ 瀕死状態のため攻撃力低下");
  }

  let turns = 0;

  while (playerHp > 0 && enemyHp > 0 && turns < 100) {
    turns++;

    if (playerFirst) {
      enemyHp = performAttack(player.name, playerAtk, playerStats.spd, enemy.name, enemyHp, enemy.baseSpd, addLog, 0);
      if (enemyHp <= 0) break;

      playerHp = performAttack(enemy.name, enemyAtk, enemy.baseSpd, player.name, playerHp, playerStats.spd, addLog, playerDodgeBonus);
      // 特性「不屈」の発動チェック
      if (playerHp <= 0 && playerTrait.effect.endure && !endureUsed) {
        playerHp = 1;
        endureUsed = true;
        addLog(`❤️‍🔥 ${player.name} は特性【不屈】で致死ダメージをHP1で耐えた！`);
      }
    } else {
      playerHp = performAttack(enemy.name, enemyAtk, enemy.baseSpd, player.name, playerHp, playerStats.spd, addLog, playerDodgeBonus);
      if (playerHp <= 0 && playerTrait.effect.endure && !endureUsed) {
        playerHp = 1;
        endureUsed = true;
        addLog(`❤️‍🔥 ${player.name} は特性【不屈】で致死ダメージをHP1で耐えた！`);
      }
      if (playerHp <= 0) break;

      enemyHp = performAttack(player.name, playerAtk, playerStats.spd, enemy.name, enemyHp, enemy.baseSpd, addLog, 0);
    }
  }

  player.currentHp = Math.max(0, playerHp);

  return {
    win: playerHp > 0,
    enemyHp: Math.max(0, enemyHp)
  };
}
