import { DINO_SPECIES } from "../data/dinos.js";
import { AREAS } from "../data/areas.js";
import { getTraitData } from "../data/traits.js";
import { getDinoType, getTypeMatchupMultiplier, getTerrainMultiplier } from "../data/types.js";

const SIZE_RANK = {
  small: 1,
  normal: 2,
  large: 3,
  giant: 4
};

export function getEnemyForArea(areaLevel) {
  const area = AREAS.find(a => a.level === areaLevel) ?? AREAS[0];
  const allowedTypes = area.enemyTypes ?? ["carnivore", "herbivore", "pterosaur"];

  // 指定タイプに一致する恐竜をすべて抽出
  const typeMatched = DINO_SPECIES.filter(d =>
    allowedTypes.includes(getDinoType(d.id, d.name).id)
  );

  // その中でエリアの huntLevel に近い個体を優先（なければ同タイプ全体から選出）
  const levelMatched = typeMatched.filter(d => d.huntLevel === area.huntLevel);
  const pool = levelMatched.length > 0 ? levelMatched : (typeMatched.length > 0 ? typeMatched : DINO_SPECIES);

  const baseEnemy = pool[Math.floor(Math.random() * pool.length)];

  // 別レベル帯の種族が選ばれた場合でもエリア相応の強さに自動調整
  const baseHuntLv = baseEnemy.huntLevel ?? area.level;
  const levelAdjust = Math.max(0.55, Math.min(1.6, area.level / Math.max(1, baseHuntLv)));
  const scale = (area.enemyScale ?? 1.0) * levelAdjust;

  return {
    ...baseEnemy,
    huntLevel: area.level,
    name: (area.enemyScale ?? 1.0) > 1 ? `【凶暴】${baseEnemy.name}` : baseEnemy.name,
    baseAtk: Math.max(1, Math.floor(baseEnemy.baseAtk * scale)),
    baseHp: Math.max(10, Math.floor(baseEnemy.baseHp * scale)),
    baseSpd: Math.max(1, Math.floor(baseEnemy.baseSpd * scale))
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
export function getDodgeChance(defenderSpd, attackerSpd, dodgeBonus = 0, sizeDodgeBonus = 0) {
  const baseDodge = defenderSpd <= attackerSpd
    ? 0.03
    : Math.min(0.5, 0.03 + (defenderSpd - attackerSpd) * 0.01);

  return Math.min(0.65, baseDodge + dodgeBonus + sizeDodgeBonus);
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

function performAttack(attackerName, atk, atkSpd, defenderName, defenderHp, defSpd, addLog, dodgeBonus = 0, defMaxHp = 0, isPlayerAttack = false, sizeDodgeBonus = 0) {
  if (Math.random() < getDodgeChance(defSpd, atkSpd, dodgeBonus, sizeDodgeBonus)) {
    addLog(`💨 ${defenderName} は素早く攻撃を回避した！`);
    return defenderHp;
  }

  const nextHp = defenderHp - atk;

  // プレイヤーの攻撃時のみ、敵の残りHP割合でログに色判定用のマークを付与
  let statusMark = "";
  if (isPlayerAttack && defMaxHp > 0 && nextHp > 0) {
    const ratio = nextHp / defMaxHp;
    if (ratio <= 0.25) {
      statusMark = " 🔴"; // 残り25%以下
    } else if (ratio <= 0.50) {
      statusMark = " 🟠"; // 残り50%以下
    }
  }

  addLog(`💥 ${attackerName} の攻撃！ ${atk}ダメージ${statusMark}`);
  return nextHp;
}

export function battle(player, playerStats, enemy, isCritical, addLog, isSeaArea = false) {
  let playerHp = Number(player.currentHp);
  if (Number.isNaN(playerHp)) playerHp = playerStats.hp;

  let enemyHp = enemy.baseHp;

  // --- タイプ相性 ＆ 海エリア補正の計算 ---
  const pType = getDinoType(player.speciesId, player.name);
  const eType = getDinoType(enemy.speciesId ?? enemy.id, enemy.name);

  const pMatchup = getTypeMatchupMultiplier(pType.id, eType.id);
  const eMatchup = getTypeMatchupMultiplier(eType.id, pType.id);

  const pTerrain = getTerrainMultiplier(pType.id, isSeaArea);
  const eTerrain = getTerrainMultiplier(eType.id, isSeaArea);

  // 相性ログの表示
  if (pMatchup > 1) {
    addLog(`🔥 タイプ有利！（${pType.icon}${pType.name} ＞ ${eType.icon}${eType.name}：攻撃1.3倍 ＆ 被ダメ40%軽減！）`);
  } else if (pMatchup < 1) {
    addLog(`💧 タイプ不利…（${pType.icon}${pType.name} ＜ ${eType.icon}${eType.name}：攻撃0.6倍 ＆ 被ダメ1.3倍）`);
  }


  if (pType.id === "marine") {
    addLog(isSeaArea
      ? `🌊 【海の王者】海エリアのため ${player.name} の能力が 1.35倍 に上昇！`
      : `🏜️ 【陸上のハンデ】陸エリアのため ${player.name} の能力が 0.75倍 に低下…`
    );
  } else if (isSeaArea) {
    addLog(`🌊 【水中ペナルティ】海エリアのため ${player.name}（${pType.name}）の能力が 0.75倍 に低下…`);
  }

  if (eType.id === "marine") {
    addLog(isSeaArea
      ? `🌊 野生の ${enemy.name} が海エリアの恩恵を受けている！`
      : `🏜️ 野生の ${enemy.name} は陸上のため動きが鈍い！`
    );
  }

  // プレイヤーの特性効果を取得
  const playerTrait = getTraitData(player.trait);
  const playerDodgeBonus = playerTrait.effect.dodgeBonus ?? 0;
  const damageTakenMult = playerTrait.effect.damageTakenMult ?? 1.0;
  const regenRate = playerTrait.effect.regenRate ?? 0;
  const reflectRate = playerTrait.effect.reflectRate ?? 0;
  let endureUsed = false; // 特性「不屈」の発動フラグ

  const playerSize = getDinoSize(player);
  const enemySize = getDinoSize(enemy);

  const playerSizeMult = getSizeDamageMultiplier(playerSize, enemySize);
  const enemySizeMult = getSizeDamageMultiplier(enemySize, playerSize);

  // 相手より体格が小さい場合、1段階ごとに回避率 +5%（最大 +15%）
  const pRank = SIZE_RANK[playerSize] ?? 2;
  const eRank = SIZE_RANK[enemySize] ?? 2;
  const playerSizeDodge = Math.max(0, (eRank - pRank) * 0.05);
  const enemySizeDodge = Math.max(0, (pRank - eRank) * 0.05);
  const affection = Math.min(100, player.affection ?? 0);
  const affectionMult = 1 + affection * 0.002;
  const damageReduction = playerTrait?.effect?.damageReduction ?? 0;

  // 体格補正 × タイプ相性 × 海エリア地形補正 × 特性「鉄壁」を反映
  let playerAtk = Math.max(
    1,
    Math.floor(playerStats.atk * playerSizeMult * pMatchup * pTerrain * affectionMult)
  );
  let enemyAtk = Math.max(
    1,
    Math.floor(enemy.baseAtk * enemySizeMult * eMatchup * eTerrain * (1 - damageReduction))
  );

  // 世代による被ダメージ軽減（1世代ごとに 2% 軽減 / 最大 75% 軽減）
  const playerGen = player.generation ?? 0;
  const genDefReduction = Math.min(0.75, playerGen * 0.02);
  enemyAtk = Math.max(1, Math.floor(enemyAtk * (1 - genDefReduction)));
  
  // 素早さにも海エリア地形補正を反映
  const playerSpd = playerStats.spd * pTerrain;
  const enemySpd = enemy.baseSpd * eTerrain;
  
    if (isCritical) {
    playerAtk = Math.max(1, Math.floor(playerAtk * 0.7));
  }

  const playerFirst = playerSpd >= enemySpd;

  addLog(`⚔️ ${enemy.name} (Lv${enemy.huntLevel}) と遭遇`);
  if (genDefReduction > 0) {
    addLog(`🧬 血統の加護（F${playerGen}）：被ダメージ -${Math.round(genDefReduction * 100)}%！`);
  }
  if (affection > 0) {
    addLog(`💖 親密度ボーナス（${affection}/100）：与ダメージ +${Math.round(affection * 0.2)}%！`);
  }
  if (damageTakenMult < 1) {
    addLog(`🛡️ 特性【鉄壁】により受けるダメージを ${Math.round((1 - damageTakenMult) * 100)}% 軽減！`);
  }
  if (playerSizeMult > 1) {
    addLog(`📏 体格で勝っている！（与ダメージ ${Math.round(playerSizeMult * 100)}%）`);
  } else if (playerSizeMult < 1) {
    addLog(`📏 相手の方が大きい…（与ダメージ ${Math.round(playerSizeMult * 100)}% ／ 回避率 +${Math.round(playerSizeDodge * 100)}%）`);
  }
  if (isCritical) {
    addLog("⚠️ 瀕死状態のため攻撃力低下");
  }

  let turns = 0;

  while (playerHp > 0 && enemyHp > 0 && turns < 100) {
    turns++;

    if (playerFirst) {
      // 1. プレイヤーの攻撃
      enemyHp = performAttack(player.name, playerAtk, playerSpd, enemy.name, enemyHp, enemySpd, addLog, 0, enemy.baseHp, true, enemySizeDodge);
      if (enemyHp <= 0) break;

      // 2. 敵の攻撃
      const prevHp = playerHp;
      playerHp = performAttack(enemy.name, enemyAtk, enemySpd, player.name, playerHp, playerSpd, addLog, playerDodgeBonus, 0, false, playerSizeDodge);
      const takenDmg = prevHp - playerHp;

      // 特性「棘の甲羅」のダメージ反射
      if (takenDmg > 0 && reflectRate > 0) {
        const reflectDmg = Math.max(1, Math.floor(takenDmg * reflectRate));
        enemyHp -= reflectDmg;
        addLog(`🦔 特性【棘の甲羅】で ${reflectDmg} の反射ダメージを与えた！`);
        if (enemyHp <= 0) break;
      }

      // 特性「不屈」の発動チェック（先攻パターン・後攻パターンの両方とも同じ記述に更新）
      if (playerHp <= 0 && playerTrait.effect.endure && !endureUsed) {
        const healHp = Math.max(1, Math.floor(playerStats.hp * 0.30));
        playerHp = healHp;
        endureUsed = true;
        addLog(`❤️‍🔥 ${player.name} は特性【不屈】で踏みとどまり、HPを ${healHp}（30%）まで回復した！`);
      }
    } else {
      // 1. 敵の攻撃
      const prevHp = playerHp;
      playerHp = performAttack(enemy.name, enemyAtk, enemySpd, player.name, playerHp, playerSpd, addLog, playerDodgeBonus);
      const takenDmg = prevHp - playerHp;

      // 特性「棘の甲羅」のダメージ反射
      if (takenDmg > 0 && reflectRate > 0) {
        const reflectDmg = Math.max(1, Math.floor(takenDmg * reflectRate));
        enemyHp -= reflectDmg;
        addLog(`🦔 特性【棘の甲羅】で ${reflectDmg} の反射ダメージを与えた！`);
        if (enemyHp <= 0) break;
      }

      // 特性「不屈」の発動チェック
      if (playerHp <= 0 && playerTrait.effect.endure && !endureUsed) {
        playerHp = 1;
        endureUsed = true;
        addLog(`❤️‍🔥 ${player.name} は特性【不屈】で致死ダメージをHP1で耐えた！`);
      }
      if (playerHp <= 0) break;

      // 2. プレイヤーの攻撃
      enemyHp = performAttack(player.name, playerAtk, playerSpd, enemy.name, enemyHp, enemySpd, addLog, 0, enemy.baseHp, true);
      if (enemyHp <= 0) break;
    }

    // ターン終了時の特性「再生」回復
    if (playerHp > 0 && enemyHp > 0 && regenRate > 0 && playerHp < playerStats.hp) {
      const heal = Math.max(1, Math.floor(playerStats.hp * regenRate));
      playerHp = Math.min(playerStats.hp, playerHp + heal);
      addLog(`💚 特性【再生】でHPが ${heal} 回復した！`);
    }
  }

  player.currentHp = Math.max(0, playerHp);

  return {
    win: playerHp > 0,
    enemyHp: Math.max(0, enemyHp)
  };
}