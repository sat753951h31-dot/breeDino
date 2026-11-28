import { calculateStats } from "../systems/stats.js";
import { DEX_SPECIES } from "../data/dexSpecies.js";
import { getColorLabel, getSizeLabel, getRarityLabel, getSexLabel } from "./labels.js";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { TREASURES, MAX_TREASURE_LEVEL, getTreasureDesc } from "../data/treasures.js";
import { getTraitData } from "../data/traits.js";
import { FACILITIES, FACILITY_MATERIALS, MAX_FACILITY_LEVEL, CRAFT_RECIPES, getMonumentUpgradeCost } from "../data/facilities.js";
import { renderDinoAvatar } from "./dinoVisual.js";
import { AREA_EXPEDITIONS } from "../data/expeditions.js";
import { getDinoType } from "../data/types.js";
import { getSpeciesName, getSpeciesDetail, getBloodlineBonus, renderGenBadge, renderRarityBadge, renderMutantBadge } from "./renderHelpers.js";

// 7. 図鑑
export function renderDex(game, state) {
  const dexListEl = document.getElementById("dexList");
  const dexCountEl = document.getElementById("dexCount");
  if (!dexListEl || !dexCountEl) return;

  const count = game.discoveredSpecies.length;
  const total = DEX_SPECIES.length;
  const percent = total > 0 ? Math.floor((count / total) * 100) : 0;

  dexCountEl.innerHTML = `
    <div class="dex-summary">
      <div class="gauge-label">
        <span>図鑑コンプリート率 ${percent === 100 ? "👑 COMPLETE!" : ""}</span>
        <strong>${count} / ${total} 種 (${percent}%)</strong>
      </div>
      <div class="bar-bg">
        <div class="bar-fill dex-fill" style="width: ${percent}%"></div>
      </div>
    </div>
  `;

  dexListEl.innerHTML = "";

  const filterMode = state?.filterDex ?? "all";
  const filterTypeMode = state?.filterDexType ?? "all";

  const indexedSpecies = DEX_SPECIES.map((species, index) => ({
    ...species,
    no: String(index + 1).padStart(2, "0"),
    found: game.discoveredSpecies.includes(species.id),
    dinoType: getDinoType(species.id, species.name)
  }));

  const filteredSpecies = indexedSpecies.filter(item => {
    if (filterMode === "undiscovered" && item.found) return false;
    if (filterMode === "discovered" && !item.found) return false;
    if (filterTypeMode !== "all" && item.dinoType.id !== filterTypeMode) return false;
    return true;
  });

  if (filteredSpecies.length === 0) {
    dexListEl.innerHTML = `<p class="empty-msg">${
      filterMode === "undiscovered" && filterTypeMode === "all"
        ? "👑 すべての恐竜を発見済みです！図鑑コンプリートおめでとうございます！"
        : "条件に一致する恐竜がいません。"
    }</p>`;
    return;
  }

  filteredSpecies.forEach((species) => {
    const div = document.createElement("div");
    const { found, no, dinoType } = species;

    if (found) {
      const detail = getSpeciesDetail(species.id);
      div.className = `dex-card is-found ${species.special ? "is-special" : ""}`;

      div.innerHTML = `
        <div class="dex-card-top">
          <span class="dex-no">No.${no}</span>
          <span class="badge-type type-${dinoType.id}" title="${dinoType.desc}">${dinoType.icon} ${dinoType.name}</span>
          ${species.special ? `<span class="badge-special">✨ 特殊交配</span>` : `<span class="badge-normal">通常種</span>`}
        </div>
        <h4>${species.name}</h4>
        ${renderDinoAvatar(species.id, {
          size: detail?.size ?? "normal",
          compact: true
        })}
        ${detail ? `
          <div class="dex-size">体格: <strong>${getSizeLabel(detail.size)}</strong></div>
          <div class="dex-stats">
            <span>⚔️ ${detail.baseAtk}</span>
            <span>❤️ ${detail.baseHp}</span>
            <span>💨 ${detail.baseSpd}</span>
          </div>
        ` : ""}
      `;
    } else {
      div.className = "dex-card is-unknown";

      if (species.special && species.parents) {
        div.innerHTML = `
          <div class="dex-card-top">
            <span class="dex-no">No.${no}</span>
            <span class="badge-special">✨ 特殊交配</span>
          </div>
          <h4>❔ ?????</h4>
          ${renderDinoAvatar(species.id, {
            isUnknown: true,
            compact: true
          })}
          <div class="dex-hint">
            💡 交配ヒント<br>
            <strong>${getSpeciesName(species.parents[0])}</strong> × <strong>${getSpeciesName(species.parents[1])}</strong>
          </div>
        `;
      } else {
        div.innerHTML = `
          <div class="dex-card-top">
            <span class="dex-no">No.${no}</span>
          </div>
          <h4>❔ ?????</h4>
          ${renderDinoAvatar(species.id, {
            isUnknown: true,
            compact: true
          })}
          <div class="dex-hint">探索や卵から発見しよう</div>
        `;
      }
    }

    dexListEl.appendChild(div);
  });
}

// 8. 実績・記録タブの描画
export function renderRecords(game, state) {
  const recordGrid = document.getElementById("recordGrid");
  const achievementList = document.getElementById("achievementList");
  const achievementCount = document.getElementById("achievementCount");
  if (!recordGrid || !achievementList) return;

  const s = game.stats;
  const currentCrystals = game.items?.breedCrystal ?? 0;

  const records = [
    { icon: "⚔️", label: "探索勝利数", value: `${s.exploreWins} 回` },
    { icon: "🥚", label: "卵の孵化数", value: `${s.eggsHatched} 個` },
    { icon: "💕", label: "交配回数", value: `${s.breedsDone} 回` },
    { icon: "💎", label: "結晶所持数", value: `${currentCrystals} 個` },
    { icon: "🧬", label: "突然変異誕生数", value: `${s.mutantsBorn} 体` },
    { icon: "🏕️", label: "遠征帰還数", value: `${s.expeditionsDone ?? 0} 回` },
    { icon: "👑", label: "到達最高世代", value: `F${s.maxGeneration}` },
    { icon: "👋", label: "お別れした数", value: `${s.dinosReleased} 体` },
    { icon: "🪦", label: "探索ロスト数", value: `${s.dinosLost ?? 0} 体` },
    { icon: "🔨", label: "工房クラフト回数", value: `${s.itemsCrafted ?? 0} 回` },
    { icon: "🎲", label: "厳選アイテム使用数", value: `${s.itemsUsed ?? 0} 回` },
    { icon: "🎰", label: "ガチャ召喚回数", value: `${s.gachaRolls ?? 0} 回` },
  ];

  recordGrid.innerHTML = records.map(r => `
    <div class="record-box">
      <div class="record-icon">${r.icon}</div>
      <div class="record-label">${r.label}</div>
      <div class="record-val">${r.value}</div>
    </div>
  `).join("");

  const unlockedCount = game.unlockedAchievements.length;
  const totalCount = ACHIEVEMENTS.length;
  const achPercent = totalCount > 0 ? Math.floor((unlockedCount / totalCount) * 100) : 0;

  if (achievementCount) {
    achievementCount.innerHTML = `
      <div class="ach-summary-card ${achPercent === 100 ? "is-complete" : ""}">
        <div class="gauge-label">
          <span>🏆 実績コンプリート率 ${achPercent === 100 ? "👑 COMPLETE!" : ""}</span>
          <strong>${unlockedCount} / ${totalCount} 達成 (${achPercent}%)</strong>
        </div>
        <div class="bar-bg">
          <div class="bar-fill ach-fill" style="width: ${achPercent}%"></div>
        </div>
      </div>
    `;
  }

  const filterMode = state?.filterAchievement ?? "all";
  const filteredAchievements = ACHIEVEMENTS.filter(ach => {
    const isUnlocked = game.unlockedAchievements.includes(ach.id);
    if (filterMode === "incomplete") return !isUnlocked;
    if (filterMode === "unlocked") return isUnlocked;
    return true;
  });

  if (filteredAchievements.length === 0) {
    achievementList.innerHTML = `<p class="empty-msg">${
      filterMode === "incomplete"
        ? "👑 すべての実績を達成済みです！おめでとうございます！"
        : "条件に一致する実績がありません。"
    }</p>`;
    return;
  }

  achievementList.innerHTML = filteredAchievements.map(ach => {
    const isUnlocked = game.unlockedAchievements.includes(ach.id);
    const { current, max } = ach.getProgress(game);
    const clamped = Math.min(current, max);
    const percent = Math.floor((clamped / max) * 100);

    return `
      <div class="ach-card ${isUnlocked ? "is-unlocked" : ""}">
        <div class="ach-header">
          <span class="ach-title">${isUnlocked ? "🏆" : "🔒"} ${ach.title}</span>
          <span class="ach-reward">報酬: ${ach.rewardText}</span>
        </div>
        <p class="ach-desc">${ach.desc}</p>
        <div class="gauge-label">
          <span>${isUnlocked ? "✅ 達成済み" : "進行度"}</span>
          <span>${clamped} / ${max}</span>
        </div>
        <div class="bar-bg mini-bar">
          <div class="bar-fill ${isUnlocked ? "hp-fill" : "area-fill"}" style="width: ${percent}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

export function renderTreasures(game) {
  const el = document.getElementById("treasureList");
  if (!el) return;

  const owned = game.treasures ?? {};

  el.innerHTML = TREASURES.map(t => {
    const lv = Array.isArray(owned)
      ? (owned.includes(t.id) ? 1 : 0)
      : (Number(owned[t.id]) || 0);

    const hasIt = lv > 0;
    const isMax = lv >= MAX_TREASURE_LEVEL;

    return `
      <div class="treasure-card ${hasIt ? "is-owned" : "is-missing"} ${isMax ? "is-max" : ""}">
        <div class="treasure-top">
          <span class="treasure-area">エリア Lv.${t.areaLevel}</span>
          ${hasIt ? `<span class="treasure-lv ${isMax ? "max" : ""}">${isMax ? "👑 Lv.MAX" : `Lv.${lv} / ${MAX_TREASURE_LEVEL}`}</span>` : ""}
        </div>
        <div class="treasure-icon">${hasIt ? t.icon : "❔"}</div>
        <div class="treasure-name">${hasIt ? t.name : "未発見の秘宝"}</div>
        <div class="treasure-desc">${hasIt ? getTreasureDesc(t, lv) : `エリア Lv.${t.areaLevel} の探索でドロップ`}</div>
      </div>
    `;
  }).join("");
}

export function renderFacility(game, handlers) {
  const matEl = document.getElementById("materialStorage");
  const listEl = document.getElementById("facilityList");
  if (!matEl || !listEl) return;

  const mats = game.materials ?? { wood: 0, stone: 0, ore: 0 };
  const foods = game.foods ?? { raw: 0, good: 0, premium: 0 };

  matEl.innerHTML = `
    <div class="material-bar">
      ${FACILITY_MATERIALS.map(m => `
        <div class="mat-item">
          <span class="mat-icon">${m.icon}</span>
          <div>
            <div class="mat-name">${m.name}</div>
            <div class="mat-count">所持: <strong>${mats[m.id] ?? 0}</strong>個 <small>(${m.desc})</small></div>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  const facState = game.facility ?? { incubatorLevel: 0, trainingLevel: 0, kitchenLevel: 0 };

  listEl.innerHTML = FACILITIES.map(fac => {
    const currentLv = facState[fac.key] ?? 0;
    const isMax = currentLv >= MAX_FACILITY_LEVEL;
    const currentInfo = fac.levels.find(l => l.level === currentLv);
    const nextPlan = fac.levels.find(l => l.level === currentLv + 1);

    let canAfford = false;
    if (nextPlan) {
      canAfford = Object.entries(nextPlan.cost).every(([itemKey, needed]) => {
        const owned = ["wood", "stone", "ore"].includes(itemKey)
          ? (mats[itemKey] ?? 0)
          : (foods[itemKey] ?? 0);
        return owned >= needed;
      });
    }

    return `
      <div class="facility-card ${isMax ? "is-max" : ""}">
        <div class="fac-card-header">
          <h3>${fac.icon} ${fac.name}</h3>
          <span class="fac-lv-badge ${isMax ? "max" : ""}">
            ${isMax ? "👑 Lv.MAX" : `Lv.${currentLv} / ${MAX_FACILITY_LEVEL}`}
          </span>
        </div>
        <p class="fac-desc">${fac.baseDesc}</p>
        <div class="fac-effect-box">
          <div>現在効果：<strong>${currentInfo ? currentInfo.effectText : "なし（未建設）"}</strong></div>
          ${nextPlan ? `<div class="fac-next-effect">次の効果：<strong>${nextPlan.effectText}</strong></div>` : ""}
        </div>
        ${isMax
          ? `<div class="fac-max-label">✨ 最大レベルまで強化済み！</div>`
          : `<div class="fac-upgrade-footer">
               <div class="facility-cost">必要素材：${nextPlan.costText}</div>
               <button class="btn-upgrade" data-key="${fac.key}" ${!canAfford ? "disabled" : ""}>
                 🔨 納品して強化する
               </button>
             </div>`
        }
      </div>
    `;
  }).join("");

  listEl.querySelectorAll(".btn-upgrade").forEach(btn => {
    btn.onclick = () => handlers.onUpgradeFacility(btn.dataset.key);
  });

  const monEl = document.getElementById("monumentBox");
  if (monEl) {
    const maxedCount = FACILITIES.filter(f => (facState[f.key] ?? 0) >= MAX_FACILITY_LEVEL).length;
    const isMonumentUnlocked = maxedCount >= FACILITIES.length;

    const monLv = facState.monumentLevel ?? 0;
    const plan = getMonumentUpgradeCost(monLv);
    const canAffordMon =
      isMonumentUnlocked &&
      (mats.wood ?? 0) >= plan.wood &&
      (mats.stone ?? 0) >= plan.stone &&
      (mats.ore ?? 0) >= plan.ore;

    monEl.innerHTML = `
      <div class="endgame-section-box is-monument ${!isMonumentUnlocked ? "is-locked" : ""}">
        <div class="fac-card-header">
          <h3>🗿 古代のモニュメント（無限強化）</h3>
          <span class="fac-lv-badge">
            ${isMonumentUnlocked
              ? `Lv.${monLv}（全ステ +${monLv * 2}%）`
              : `🔒 未解放（MAX施設: ${maxedCount} / ${FACILITIES.length}）`
            }
          </span>
        </div>
        <p class="fac-desc">
          <strong>【解放条件】上の基本4施設すべてが Lv.MAX になると活性化します。</strong><br>
          上限なしで強化できる古代の石碑。遠征素材を捧げるたびに全恐竜の攻撃・HP・素早さが +2% ずつ永遠に上昇します。
        </p>
        <div class="monument-action-row">
          <div class="facility-cost">
            ${isMonumentUnlocked
              ? `次の強化（Lv.${plan.nextLv} / +${plan.nextLv * 2}%）：<strong>${plan.costText}</strong>`
              : `※まずは基本の4施設をすべて Lv.MAX まで強化してください`
            }
          </div>
          <button id="upgradeMonumentBtn" class="btn-upgrade" ${!canAffordMon ? "disabled" : ""}>
            ${isMonumentUnlocked ? "🗿 モニュメントを強化する" : "🔒 4施設MAXで解放"}
          </button>
        </div>
      </div>
    `;
    document.getElementById("upgradeMonumentBtn").onclick = handlers.onUpgradeMonument;
  }

  const craftEl = document.getElementById("craftWorkshopBox");
  if (craftEl) {
    const maxedCount = FACILITIES.filter(f => (facState[f.key] ?? 0) >= MAX_FACILITY_LEVEL).length;
    const isWorkshopUnlocked = maxedCount >= FACILITIES.length;

    craftEl.innerHTML = `
      <div class="endgame-section-box is-workshop ${!isWorkshopUnlocked ? "is-locked" : ""}">
        <div class="fac-card-header">
          <h3>🔨 古代工房（素材クラフト）</h3>
          <span class="fac-lv-badge">
            ${isWorkshopUnlocked
              ? "✨ 稼働中"
              : `🔒 未解放（MAX施設: ${maxedCount} / ${FACILITIES.length}）`
            }
          </span>
        </div>
        <p class="fac-desc">
          <strong>【解放条件】上の基本4施設すべてが Lv.MAX になると解放されます。</strong><br>
          余った建築素材から生命の結晶や厳選アイテム（特性変更の果実・個体値強化の秘薬・体格変化の薬）を作成できます。
        </p>

        <div class="craft-grid">
          ${CRAFT_RECIPES.map(r => {
            const canCraft = isWorkshopUnlocked && Object.entries(r.cost).every(([k, needed]) => {
              const owned = ["wood", "stone", "ore"].includes(k) ? (mats[k] ?? 0) : (foods[k] ?? 0);
              return owned >= needed;
            });

            let currentOwned = 0;
            if (r.id === "craft_crystal") currentOwned = game.items?.breedCrystal ?? 0;
            else if (r.id === "craft_premium_meat") currentOwned = foods.premium ?? 0;
            else if (r.id === "craft_trait_fruit") currentOwned = game.items?.traitFruit ?? 0;
            else if (r.id === "craft_iv_elixir") currentOwned = game.items?.ivElixir ?? 0;
            else if (r.id === "craft_size_potion") currentOwned = game.items?.sizePotion ?? 0;

            return `
              <div class="craft-card">
                <div class="craft-header-row">
                  <div class="craft-title">${r.icon} <strong>${r.name}</strong></div>
                  <span class="craft-owned-badge">所持: <strong>${currentOwned}</strong>個</span>
                </div>
                <div class="craft-desc">${r.desc}</div>
                <div class="facility-cost">素材：${r.costText}</div>
                <button class="btn-craft" data-id="${r.id}" ${!canCraft ? "disabled" : ""}>
                  ${isWorkshopUnlocked ? `🔨 作成する（所持: ${currentOwned}）` : "🔒 4施設MAXで解放"}
                </button>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    craftEl.querySelectorAll(".btn-craft").forEach(btn => {
      btn.onclick = () => handlers.onCraftItem(btn.dataset.id);
    });
  }
}

// 9. 遠征タブ全体の描画
export function renderExpeditionTab(game, handlers) {
  const activeEl = document.getElementById("activeExpeditions");
  const builderEl = document.getElementById("expeditionBuilder");
  const gridEl = document.getElementById("expeditionDinoGrid");
  if (!activeEl || !builderEl || !gridEl) return;

  const allLevels = AREA_EXPEDITIONS.map(e => e.areaLevel);
  const unlockedLevels = (game.worldLoop ?? 1) > 1
    ? allLevels
    : allLevels.filter(lv => (game.areaProgress?.[lv] ?? 0) >= 100);

  const maxTeams = unlockedLevels.length;
  const activeExps = game.expeditions ?? [];

  if (maxTeams === 0) {
    activeEl.innerHTML = "";
    builderEl.innerHTML = `
      <div class="exp-locked-notice">
        <h3>🔒 遠征機能はまだ解放されていません</h3>
        <p>いずれかのエリアの<strong>探索率を 100%</strong> にすると、そのエリアへの遠征とチーム枠が解放されます！</p>
      </div>
    `;
    gridEl.innerHTML = "";
    return;
  }

  const now = Date.now();
  const doneCount = activeExps.filter(e => e.endAt <= now).length;

  activeEl.innerHTML = `
    <div class="exp-section-header">
      <div>
        <h2>🏕️ 遠征中の部隊（${activeExps.length} / ${maxTeams} 枠稼働中）</h2>
        <small>※エリア100%制覇数に応じて同時派遣枠が増えます</small>
      </div>
      ${doneCount > 0 ? `
        <div class="exp-bulk-actions">
          <button id="claimAllExpBtn" class="btn-exp-claim">
            🎁 一括で受け取る (${doneCount})
          </button>
          <button id="redeployAllExpBtn" class="btn-exp-redeploy">
            🔄 受け取って再遠征 (${doneCount})
          </button>
        </div>
      ` : ""}
    </div>
    ${activeExps.length === 0
      ? `<p class="empty-msg">現在出撃中の遠征隊はありません。</p>`
      : `<div class="active-exp-grid">
          ${activeExps.map(exp => {
            const course = AREA_EXPEDITIONS.find(c => c.areaLevel === exp.areaLevel) ?? AREA_EXPEDITIONS.at(0);
            const remain = Math.max(0, Math.ceil((exp.endAt - now) / 1000));
            const isDone = remain <= 0;
            const memberNames = exp.memberIds
              .map(id => game.dinos.find(d => d.uid === id)?.name)
              .filter(Boolean)
              .join(" / ");

            return `
              <div class="active-exp-card ${isDone ? "is-done" : ""}">
                <div class="exp-card-title">${course.icon} ${course.name}</div>
                <div class="exp-card-members">メンバー：<strong>${memberNames}</strong></div>
                <div class="exp-card-footer">
                  ${isDone
                    ? `<span class="exp-done-msg">✨ 帰還完了！</span>
                       <button class="btn-exp-claim" data-id="${exp.id}">🎁 報酬を受け取る</button>`
                    : `<span>⏳ 残り <strong class="exp-team-remain" data-id="${exp.id}">${remain}</strong> 秒</span>`
                  }
                </div>
              </div>
            `;
          }).join("")}
        </div>`
    }
  `;

  activeEl.querySelectorAll(".btn-exp-claim[data-id]").forEach(btn => {
    btn.onclick = () => handlers.onClaimExpedition(btn.dataset.id);
  });

  const claimAllBtn = document.getElementById("claimAllExpBtn");
  if (claimAllBtn) claimAllBtn.onclick = handlers.onClaimAllExpeditions;

  const redeployAllBtn = document.getElementById("redeployAllExpBtn");
  if (redeployAllBtn) redeployAllBtn.onclick = handlers.onClaimAndRedeployAll;

  const busyIds = new Set();
  activeExps.forEach(e => e.memberIds.forEach(id => busyIds.add(id)));

  const draft = game.expeditionDraft ?? { areaLevel: unlockedLevels.at(0), memberIds: [] };
  const selectedLevel = unlockedLevels.includes(draft.areaLevel) ? draft.areaLevel : unlockedLevels.at(0);
  const validDraftMembers = draft.memberIds.filter(
    id => id !== game.activeDinoId && !busyIds.has(id) && game.dinos.some(d => d.uid === id)
  );

  if (document.activeElement?.id !== "expAreaSelect") {
    const canLaunch = activeExps.length < maxTeams && validDraftMembers.length > 0;
    const luckyCount = validDraftMembers.filter(id => {
      const d = game.dinos.find(dino => dino.uid === id);
      return d?.trait === "hunter";
    }).length;
    const luckPercent = luckyCount * 10;
    const standbyCount = game.dinos.filter(d => d.uid !== game.activeDinoId && !busyIds.has(d.uid)).length;

    const selectedCourse = AREA_EXPEDITIONS.find(item => item.areaLevel === selectedLevel) ?? AREA_EXPEDITIONS.at(0);

    const optionsHtml = unlockedLevels.map(lv => {
      const c = AREA_EXPEDITIONS.find(item => item.areaLevel === lv);
      return `<option value="${lv}" ${lv === selectedLevel ? "selected" : ""}>${c.icon} ${c.name}</option>`;
    }).join("");

    builderEl.innerHTML = `
      <div class="exp-builder-box">
        <div class="exp-builder-top">
          <strong>🚩 新規チームの編成（選択中: ${validDraftMembers.length} / 3 体）</strong>
          <span>空き部隊枠: <strong>${maxTeams - activeExps.length}</strong> 枠</span>
        </div>
        <div class="exp-luck-info">
          <span>💡 特性「<strong>🍀 幸運</strong>」持ちでドロップ率UP！（1体につき <strong>+10%</strong> 重複）</span>
          <span class="exp-luck-badge ${luckyCount > 0 ? "is-active" : ""}">
            🍀 幸運ボーナス: <strong>+${luckPercent}%</strong>
          </span>
        </div>
        <div class="exp-setup-row">
          <select id="expAreaSelect">${optionsHtml}</select>
          <div class="exp-action-btns">
            <button id="autoSelectExpBtn" class="btn-exp-auto" ${standbyCount === 0 ? "disabled" : ""} title="幸運・高レア・低レベルを優先して最大3体自動選択">
              ✨ おすすめ編成
            </button>
            <button id="startExpBtn" class="btn-exp-start" ${!canLaunch ? "disabled" : ""}>
              ${activeExps.length >= maxTeams ? "部隊枠がいっぱいです" : "🚩 遠征に出発"}
            </button>
          </div>
        </div>
        <div class="exp-reward-preview">
          🎁 <strong>主な獲得報酬：</strong>${selectedCourse.rewardDesc}
        </div>
      </div>
    `;

    document.getElementById("expAreaSelect").onchange = (e) => {
      e.target.blur();
      handlers.onSelectExpArea(Number(e.target.value));
    };
    document.getElementById("autoSelectExpBtn").onclick = handlers.onAutoSelectExpMembers;
    document.getElementById("startExpBtn").onclick = handlers.onStartExpedition;
  }

  const standbyDinos = game.dinos
    .filter(d => d.uid !== game.activeDinoId)
    .sort((a, b) => {
      const busyA = busyIds.has(a.uid) ? 1 : 0;
      const busyB = busyIds.has(b.uid) ? 1 : 0;
      if (busyA !== busyB) return busyA - busyB;

      const luckyA = a.trait === "hunter" ? 1 : 0;
      const luckyB = b.trait === "hunter" ? 1 : 0;
      if (luckyA !== luckyB) return luckyB - luckyA;

      return b.level - a.level;
    });

  if (standbyDinos.length === 0) {
    gridEl.innerHTML = "<p class='empty-msg'>派遣できる待機恐竜がいません。</p>";
    return;
  }

  gridEl.innerHTML = "";
  standbyDinos.forEach(dino => {
    const stats = calculateStats(dino);
    const trait = getTraitData(dino.trait);
    const isBusy = busyIds.has(dino.uid);
    const isPicked = validDraftMembers.includes(dino.uid);
    const isLucky = dino.trait === "hunter";

    const card = document.createElement("div");
    card.className = `dino-card ${isPicked ? "is-selected" : ""} ${isBusy ? "is-busy" : ""}`;

    card.innerHTML = `
      <div class="card-top-row" style="min-height: 28px;">
        <div class="card-badges">
          ${renderGenBadge(dino)}
          ${renderRarityBadge(dino)}
          <span class="badge-trait ${isLucky ? "is-lucky-highlight" : ""}" title="${trait.desc}" data-trait-name="${trait.icon} ${trait.name}" data-trait-desc="${trait.desc}">
            ${trait.icon} ${trait.name}
          </span>
        </div>
        <div class="card-lv">Lv.<strong>${dino.level}</strong></div>
      </div>

      <div class="card-name-line">
        <h3>${dino.name}</h3>
        <small>${getSexLabel(dino.sex)}</small>
      </div>

      ${renderDinoAvatar(dino.speciesId, {
        color: dino.color,
        size: dino.size,
        mutant: dino.mutant,
        compact: true
      })}

      <div class="card-stat-grid">
        <div class="stat-box"><div class="stat-label">⚔️ 攻撃</div><div class="stat-val">${Math.floor(stats.atk)}</div></div>
        <div class="stat-box"><div class="stat-label">❤️ HP</div><div class="stat-val">${Math.floor(stats.hp)}</div></div>
        <div class="stat-box"><div class="stat-label">💨 素早さ</div><div class="stat-val">${Math.floor(stats.spd)}</div></div>
      </div>

      <button
        class="btn-exp-pick ${isPicked ? "is-picked" : ""}"
        data-id="${dino.uid}"
        ${isBusy ? "disabled" : ""}
      >
        ${isBusy ? "🏕️ 遠征中" : isPicked ? "✅ メンバー選択中" : "＋ チームに加える"}
      </button>
    `;
    gridEl.appendChild(card);
  });

  gridEl.querySelectorAll(".btn-exp-pick").forEach(btn => {
    btn.onclick = () => handlers.onToggleExpDraftMember(btn.dataset.id);
  });
}

// 10. ガチャ卵タブの描画
export function renderGachaTab(game, state, handlers) {
  const stageEl = document.getElementById("gachaStage");
  const resultEl = document.getElementById("gachaResultArea");
  if (!stageEl || !resultEl) return;

  const crystals = game.items?.breedCrystal ?? 0;
  const maxGen = state?.gachaMaxGen ?? 5;
  const discoveredCount = (game.discoveredSpecies ?? []).length;

  const currentLoop = game.worldLoop ?? 1;
  const isPremiumUnlocked = currentLoop >= 3;
  const pRange = state?.premiumGachaRange ?? { minGen: 3, maxGen: 5 };

  stageEl.innerHTML = `
    <div class="gacha-box">
      <div class="gacha-status-row">
        <div class="gacha-crystal-pill">💎 所持結晶：<strong>${crystals}</strong> 個</div>
        <div class="gacha-spec-pill">📖 対象種族：<strong>${discoveredCount}</strong> 種 ／ 🧬 出現世代：<strong>F0 〜 F${maxGen}</strong></div>
      </div>

      <div class="gacha-rates-info">
        <span>【通常ガチャ】⚪ 白 45% ／ 🔵 青 30% ／ 🟣 紫 18% ／ 🌈 虹 7%（🧬 突然変異 12%・希少体色 28%）</span>
      </div>

      <div class="gacha-btn-group">
        <button id="gacha1Btn" class="btn-gacha-single" ${crystals < 10 ? "disabled" : ""}>
          🥚 1回まわす<br><small>💎 生命の結晶 ×10</small>
        </button>
        <button id="gacha10Btn" class="btn-gacha-multi" ${crystals < 100 ? "disabled" : ""}>
          🌈 10回まわす<br><small>💎 生命の結晶 ×100</small>
        </button>
      </div>
    </div>

    <div class="gacha-box is-premium ${!isPremiumUnlocked ? "is-locked" : ""}">
      <div class="gacha-status-row">
        <div class="gacha-premium-title">👑 高級ガチャ（ハイグレード召喚）</div>
        <div class="gacha-spec-pill">
          ${isPremiumUnlocked
            ? `🧬 出現世代保証：<strong>F${pRange.minGen} 〜 F${pRange.maxGen}</strong>`
            : `🔒 <strong>3周目到達で解放</strong>（現在 ${currentLoop}周目）`
          }
        </div>
      </div>

      <div class="gacha-rates-info">
        <span>【高級ガチャ】<strong>⚪白なし・レベル上限MAX確定！</strong> 🔵 青 35% ／ 🟣 紫 40% ／ 🌈 虹 25%（🧬 突然変異 25%・IV40以上保証）</span>
      </div>

      <div class="gacha-btn-group">
        <button id="premiumGacha1Btn" class="btn-gacha-premium-single" ${!isPremiumUnlocked || crystals < 100 ? "disabled" : ""}>
          ${isPremiumUnlocked ? "👑 高級1回まわす<br><small>💎 生命の結晶 ×100</small>" : "🔒 3周目で解放<br><small>💎 結晶 ×100</small>"}
        </button>
        <button id="premiumGacha10Btn" class="btn-gacha-premium-multi" ${!isPremiumUnlocked || crystals < 1000 ? "disabled" : ""}>
          ${isPremiumUnlocked ? "🌟 高級10回まわす<br><small>💎 生命の結晶 ×1,000</small>" : "🔒 3周目で解放<br><small>💎 結晶 ×1,000</small>"}
        </button>
      </div>
    </div>
  `;

  document.getElementById("gacha1Btn").onclick = () => handlers.onRollGacha(1, false);
  document.getElementById("gacha10Btn").onclick = () => handlers.onRollGacha(10, false);
  document.getElementById("premiumGacha1Btn").onclick = () => handlers.onRollGacha(1, true);
  document.getElementById("premiumGacha10Btn").onclick = () => handlers.onRollGacha(10, true);

  const results = state?.lastGachaResults ?? [];
  if (results.length === 0) {
    resultEl.innerHTML = `<p class="empty-msg">上のボタンを押してガチャ卵を召喚しよう！</p>`;
    return;
  }

  resultEl.innerHTML = `
    <h3 class="gacha-result-title">✨ 召喚結果（${results.length}体）</h3>
    <div class="gacha-result-grid">
      ${results.map(dino => {
        const trait = getTraitData(dino.trait);
        const dinoType = getDinoType(dino.speciesId, dino.name);
        const bonus = getBloodlineBonus(dino);
        const isHighRare = dino.rarityType === "rainbow" || dino.rarityType === "purple" || dino.mutant;

        return `
          <div class="dino-card gacha-card ${isHighRare ? "is-gacha-jackpot" : ""} ${dino.mutant ? "is-mutant" : ""}">
            <div class="card-top-row">
              <div class="card-badges">
                ${renderGenBadge(dino)}
                <span class="badge-type type-${dinoType.id}">${dinoType.icon} ${dinoType.name}</span>
                ${bonus > 0 ? `<span class="badge-bloodline">📈上限+${bonus}</span>` : ""}
                ${renderRarityBadge(dino)}
                <span
                  class="badge-trait"
                  title="${trait.desc}"
                  data-trait-name="${trait.icon} ${trait.name}"
                  data-trait-desc="${trait.desc}"
                >${trait.icon} ${trait.name}</span>
                ${renderMutantBadge(dino)}
              </div>
              <div class="card-lv">Lv.1<small>/${dino.maxLevel}</small></div>
            </div>

            <div class="card-name-line">
              <h3>${dino.name}</h3>
              <small>${getSexLabel(dino.sex)}</small>
            </div>

            ${renderDinoAvatar(dino.speciesId, {
              color: dino.color,
              size: dino.size,
              mutant: dino.mutant,
              compact: true
            })}

            <div class="card-sub-meta">
              <span>📏 ${getSizeLabel(dino.size)}</span>
              <span>🎨 ${getColorLabel(dino.color)}</span>
            </div>
            <div class="card-iv-total">
              IV: ATK <strong>${dino.atkIv}</strong> / HP <strong>${dino.hpIv}</strong> / SPD <strong>${dino.spdIv}</strong>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

export function updateExpBadge(game) {
  const badge = document.getElementById("expTabBadge");
  if (!badge) return;

  const now = Date.now();
  const doneCount = (game.expeditions ?? []).filter(e => e.endAt <= now).length;

  if (doneCount > 0) {
    badge.textContent = doneCount;
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
  }
}
