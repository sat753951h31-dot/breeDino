import { TIPS_DATA } from "../data/tips.js";
import { SPECIAL_BREEDS } from "../data/specialBreeding.js";
import { DEX_SPECIES } from "../data/dexSpecies.js";
import * as traitModule from "../data/traits.js";

// モーダル制御の一括初期化
export function initModals({
  game,
  saveGame,
  getDefaultSpeciesName,
  findBestParentsForSpecies,
  onApplyReverseParents
}) {
  // =========================================
  // 1. 早見表・Tips共通モーダル（#guideModal）
  // =========================================
  const guideModal = document.getElementById("guideModal");
  const guideModalTitle = document.getElementById("guideModalTitle");
  const guideModalBody = document.getElementById("guideModalBody");

  function openGuideModal(title, html) {
    if (!guideModal || !guideModalTitle || !guideModalBody) return;
    guideModalTitle.textContent = title;
    guideModalBody.innerHTML = html;
    guideModalBody.scrollTop = 0;
    guideModal.style.display = "flex";
  }

  function closeGuideModal() {
    if (guideModal) guideModal.style.display = "none";
  }

  // 閉じるボタン ＆ 背景タップ
  document.getElementById("guideCloseTopBtn")?.addEventListener("click", closeGuideModal);
  guideModal?.addEventListener("click", (e) => {
    if (e.target === guideModal) closeGuideModal();
  });

  // 💡 汎用Tipsボタン（静的HTML・動的描画のどちらでも動作）
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".js-open-tip[data-tip-id]");
    if (!btn) return;

    const tip = TIPS_DATA[btn.dataset.tipId];
    if (!tip) return;

    const html = tip.items.map(item => `
      <div class="guide-item">
        <div class="guide-item-title"><strong>${item.title}</strong></div>
        <div class="guide-item-desc">${item.desc}</div>
      </div>
    `).join("");

    openGuideModal(tip.title, html);
  });

  // ✨ 特性一覧ボタン
  document.querySelectorAll(".js-open-traits").forEach(btn => {
    btn.addEventListener("click", () => {
      const rawTraits = traitModule.TRAITS ?? traitModule.default ?? {};
      const traitList = Array.isArray(rawTraits) ? rawTraits : Object.values(rawTraits);

      const listHtml = traitList.map(t => `
        <div class="guide-item">
          <div class="guide-item-title">${t.icon ?? "✨"} <strong>${t.name}</strong></div>
          <div class="guide-item-desc">${t.desc}</div>
        </div>
      `).join("");

      openGuideModal(`✨ 特性一覧（全${traitList.length}種）`, listHtml);
    });
  });

  // 🧬 特殊交配レシピボタン
  document.getElementById("recipeListBtn")?.addEventListener("click", () => {
    const discovered = game.discoveredSpecies ?? [];
    const foundCount = SPECIAL_BREEDS.filter(b => discovered.includes(b.result.id)).length;

    const listHtml = SPECIAL_BREEDS.map((b, idx) => {
      const parent1 = getDefaultSpeciesName(b.parents[0]);
      const parent2 = getDefaultSpeciesName(b.parents[1]);
      const isFound = discovered.includes(b.result.id);
      const resultName = isFound ? `✨ ${b.result.name}` : "❔ 未発見の特殊種";

      return `
        <div class="guide-item ${isFound ? "is-discovered" : ""}">
          <div class="guide-recipe-row">
            <span class="guide-no">#${String(idx + 1).padStart(2, "0")}</span>
            <span class="guide-parents"><strong>${parent1}</strong> × <strong>${parent2}</strong></span>
          </div>
          <div class="guide-result">➡ <strong>${resultName}</strong></div>
        </div>
      `;
    }).join("");

    openGuideModal(
      `🧬 特殊交配レシピ（発見済: ${foundCount} / ${SPECIAL_BREEDS.length}種）`,
      listHtml
    );
  });

  // 🔍 逆引き交配ボタン：ペア有無で色分けした取得済み図鑑モーダルを表示
  document.getElementById("reverseBreedBtn")?.addEventListener("click", () => {
    const discovered = game.discoveredSpecies ?? [];
    const ownedSpeciesList = DEX_SPECIES.filter(sp => discovered.includes(sp.id));

    if (ownedSpeciesList.length === 0) {
      alert("まだ図鑑に登録された恐竜がいません！");
      return;
    }

    let readyCount = 0;

    const cardsHtml = ownedSpeciesList.map(sp => {
      const match = findBestParentsForSpecies(sp.id);
      if (match) readyCount++;

      const stateClass = !match
        ? "is-unavailable"
        : match.routeType === "special"
          ? "is-special-ready"
          : "is-ready";

      const statusBadge = !match
        ? "⚠️ ペア不足"
        : match.routeType === "special"
          ? `✨ 特殊配合可 (F${match.baseGen + 1}誕生)`
          : `✅ 同種ペアあり (F${match.baseGen + 1}誕生)`;

      return `
        <button type="button" class="btn-reverse-species ${stateClass}" data-species-id="${sp.id}">
          <span class="rev-sp-name">${sp.special ? "✨ " : ""}${sp.name}</span>
          <span class="rev-sp-status">${statusBadge}</span>
        </button>
      `;
    }).join("");

    const listHtml = `
      <p class="guide-modal-sub">
        ✅ <strong>緑・紫のカード</strong>は現在ペアが揃っています（タップで即セット / 交配可能: <strong>${readyCount}</strong>種）
      </p>
      <div class="reverse-dex-grid">
        ${cardsHtml}
      </div>
    `;

    openGuideModal(`🔍 逆引き交配（交配可能: ${readyCount} / ${ownedSpeciesList.length}種）`, listHtml);

    guideModalBody?.querySelectorAll(".btn-reverse-species").forEach(btn => {
      btn.onclick = () => {
        const success = onApplyReverseParents(btn.dataset.speciesId);
        if (success) closeGuideModal();
      };
    });
  });

  // =========================================
  // 2. セーブ・ロード用モーダル（#backupModal）
  // =========================================
  const backupModal = document.getElementById("backupModal");
  const backupTitle = document.getElementById("backupModalTitle");
  const backupDesc = document.getElementById("backupModalDesc");
  const backupTextArea = document.getElementById("backupTextArea");
  const backupCopyBtn = document.getElementById("backupCopyBtn");
  const backupExecLoadBtn = document.getElementById("backupExecLoadBtn");

  // 📤 セーブ（書き出し）ボタン
  document.getElementById("exportSaveBtn")?.addEventListener("click", () => {
    try {
      saveGame(game);
      const exportObj = { ...game, huntLogs: [] };
      const jsonStr = JSON.stringify(exportObj);
      const bytes = new TextEncoder().encode(jsonStr);
      let binStr = "";
      bytes.forEach(b => { binStr += String.fromCharCode(b); });
      const encoded = btoa(binStr);

      backupTitle.textContent = "📤 セーブデータの書き出し";
      backupDesc.textContent = "下の文字列をすべてコピーして、メモ帳や別の端末に貼り付けてください。";
      backupTextArea.value = encoded;
      backupTextArea.readOnly = true;

      backupCopyBtn.style.display = "inline-block";
      backupExecLoadBtn.style.display = "none";
      backupModal.style.display = "flex";

      backupTextArea.focus();
      backupTextArea.select();
    } catch (e) {
      alert("❌ セーブデータの書き出しに失敗しました。");
      console.error(e);
    }
  });

  // 📋 モーダル内のコピーボタン
  backupCopyBtn?.addEventListener("click", async () => {
    backupTextArea.select();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(backupTextArea.value);
      } else {
        document.execCommand("copy");
      }
      alert("📋 クリップボードにコピーしました！");
    } catch {
      alert("テキストを選択状態にしました。手動でコピー（Ctrl+C / 長押しコピー）してください。");
    }
  });

  // 📥 ロード（読み込み）ボタン
  document.getElementById("importSaveBtn")?.addEventListener("click", () => {
    backupTitle.textContent = "📥 セーブデータの読み込み";
    backupDesc.textContent = "書き出したセーブ文字列を下の枠に貼り付けて「このデータで復元する」を押してください。";
    backupTextArea.value = "";
    backupTextArea.readOnly = false;

    backupCopyBtn.style.display = "none";
    backupExecLoadBtn.style.display = "inline-block";
    backupModal.style.display = "flex";
    backupTextArea.focus();
  });

  // ✅ 復元実行ボタン
  backupExecLoadBtn?.addEventListener("click", () => {
    const rawInput = backupTextArea.value.trim();
    if (!rawInput) {
      alert("セーブ文字列が入力されていません。");
      return;
    }

    try {
      const cleanBase64 = rawInput.replace(/\s+/g, "");
      const binStr = atob(cleanBase64);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      const jsonStr = new TextDecoder().decode(bytes);
      const parsed = JSON.parse(jsonStr);

      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.dinos)) {
        alert("❌ 無効なセーブデータです。文字列がすべて貼り付けられているか確認してください。");
        return;
      }

      const ok = confirm(
        `⚠️ 現在のデータを上書きして復元しますか？\n（復元データの所持恐竜数: ${parsed.dinos.length}体）`
      );
      if (!ok) return;

      Object.keys(game).forEach(key => delete game[key]);
      Object.assign(game, parsed);

      saveGame(game);
      alert("✅ セーブデータを復元しました！画面を再読み込みします。");
      location.reload();
    } catch (e) {
      alert("❌ 読み込みに失敗しました。\n古い形式の文字列か、途中で文字列が欠けている可能性があります。");
      console.error(e);
    }
  });

  // 閉じるボタン
  document.getElementById("backupCloseBtn")?.addEventListener("click", () => {
    backupModal.style.display = "none";
  });
}
