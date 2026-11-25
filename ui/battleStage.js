import { renderDinoAvatar } from "./dinoVisual.js";

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 待機状態（相棒の恐竜が道の上で待機している表示）を更新
export function updateIdleStage(activeDino, areaLevel = 1) {
  const stage = document.getElementById("battleStage");
  const playerEl = document.getElementById("stagePlayer");
  const enemyEl = document.getElementById("stageEnemy");
  const bannerEl = document.getElementById("stageBanner");
  if (!stage || !playerEl || !enemyEl) return;

  // アニメーション実行中は上書きしない
  if (stage.dataset.animating === "true") return;

  stage.className = `battle-stage area-bg-${areaLevel}`;
  enemyEl.innerHTML = "";
  enemyEl.className = "stage-actor is-enemy";
  if (bannerEl) bannerEl.textContent = "🧭 出発準備OK";

  if (!activeDino) {
    playerEl.innerHTML = "";
    return;
  }

  playerEl.className = "stage-actor is-player";
  playerEl.innerHTML = renderDinoAvatar(activeDino.speciesId, {
    color: activeDino.color,
    size: activeDino.size,
    mutant: activeDino.mutant,
    compact: true
  });
}

// 探索〜連戦バトルのアニメーションを再生する
export async function playExploreSequence(activeDino, areaLevel, battleRecords) {
  const stage = document.getElementById("battleStage");
  const playerEl = document.getElementById("stagePlayer");
  const enemyEl = document.getElementById("stageEnemy");
  const bannerEl = document.getElementById("stageBanner");
  const dmgEl = document.getElementById("stageDamage");
  if (!stage || !playerEl || !enemyEl || !activeDino) return;

  stage.dataset.animating = "true";
  stage.className = `battle-stage area-bg-${areaLevel} is-walking`;
  enemyEl.innerHTML = "";
  enemyEl.className = "stage-actor is-enemy";

  playerEl.className = "stage-actor is-player anim-walk";
  playerEl.innerHTML = renderDinoAvatar(activeDino.speciesId, {
    color: activeDino.color,
    size: activeDino.size,
    mutant: activeDino.mutant,
    compact: true
  });

  if (bannerEl) bannerEl.textContent = "👣 フィールドを探索中…";
  await wait(750);

  // 遭遇した敵（1〜3戦、またはボス戦）ごとにバトル演出を再生
  for (let idx = 0; idx < battleRecords.length; idx++) {
    const rec = battleRecords[idx];
    stage.classList.remove("is-walking");
    playerEl.classList.remove("anim-walk");

    if (bannerEl) {
      bannerEl.textContent = rec.isBoss
        ? `🔥 BOSS：${rec.enemy.name} 出現！`
        : `⚔️ ${idx + 1}戦目：${rec.enemy.name} と遭遇！`;
    }

    // 敵の登場
    enemyEl.className = "stage-actor is-enemy anim-appear";
    enemyEl.innerHTML = renderDinoAvatar(rec.enemy.speciesId ?? rec.enemy.id ?? "", {
      enemyName: rec.enemy.name ?? "",
      size: rec.isBoss ? "giant" : (rec.enemy.size ?? "normal"),
      isEnemy: true,
      mutant: rec.isBoss,
      compact: true
    });
    await wait(350);

    // プレイヤーの攻撃突進
    playerEl.classList.add("anim-attack-right");
    await wait(160);
    enemyEl.classList.add("anim-hit");
    showPopup(dmgEl, "💥 HIT!", "is-enemy-hit");
    await wait(240);
    playerEl.classList.remove("anim-attack-right");
    enemyEl.classList.remove("anim-hit");

    if (rec.win) {
      // 勝利：敵が吹き飛ぶ演出
      enemyEl.classList.add("anim-defeat");
      if (bannerEl) bannerEl.textContent = `✅ ${rec.enemy.name} を撃破！`;
      await wait(450);
      enemyEl.innerHTML = "";
      enemyEl.className = "stage-actor is-enemy";

      // 次の連戦がある場合は少し歩く
      if (idx < battleRecords.length - 1) {
        stage.classList.add("is-walking");
        playerEl.classList.add("anim-walk");
        if (bannerEl) bannerEl.textContent = "👣 さらに奥へ進む…";
        await wait(450);
      }
    } else {
      // 敗北：敵の反撃を受けてプレイヤーが倒れる演出
      enemyEl.classList.add("anim-attack-left");
      await wait(160);
      playerEl.classList.add("anim-hit", "anim-defeat");
      showPopup(dmgEl, "☠️ 敗北…", "is-player-hit");
      if (bannerEl) bannerEl.textContent = `⚠️ ${rec.enemy.name} に敗れた…`;
      await wait(550);
      break;
    }
  }

  // 演出終了後、待機状態に戻す
  stage.dataset.animating = "false";
  updateIdleStage(activeDino, areaLevel);
}

function showPopup(el, text, cls) {
  if (!el) return;
  el.textContent = text;
  el.className = `stage-damage show ${cls}`;
  setTimeout(() => {
    el.className = "stage-damage";
  }, 450);
}
