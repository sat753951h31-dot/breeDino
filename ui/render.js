import { renderStarterEgg, renderStatusAndLogs, renderActiveDino, renderExploreBox } from "./renderExplore.js";
import { renderDinoList, renderBreedingEggs, renderWildEggs, renderBreedingStage, updateBreedBadge } from "./renderDinos.js";
import { renderDex, renderRecords, renderTreasures, renderFacility, renderExpeditionTab, renderGachaTab, updateExpBadge } from "./renderTabs.js";

// 1秒ごとのタイマー専用（ボタンを消さずに数値だけ更新する）
export function renderTick(game, handlers) {
  const activeDino = game.dinos.find(d => d.uid === game.activeDinoId);
  const activeHpEl = document.getElementById("activeDinoHp");
  if (activeDino && activeHpEl) {
    activeHpEl.textContent = Math.floor(activeDino.currentHp);
  }

  document.querySelectorAll(".dino-hp").forEach(el => {
    const dino = game.dinos.find(d => d.uid === el.dataset.uid);
    if (dino) {
      el.textContent = Math.floor(dino.currentHp);
    }
  });

  let needEggRedraw = false;
  game.breedingEggs.forEach(egg => {
    const remain = Math.max(0, Math.ceil((egg.hatchAt - Date.now()) / 1000));
    const remainEl = document.querySelector(`.egg-remain[data-id="${egg.id}"]`);
    if (remainEl) remainEl.textContent = remain;
    if (remain <= 0 && !document.querySelector(`.hatch-child-btn[data-id="${egg.id}"]`)) {
      needEggRedraw = true;
    }
  });

  let needWildEggRedraw = false;
  game.wildEggs.forEach(egg => {
    const remain = Math.max(0, Math.ceil(((egg.hatchAt ?? 0) - Date.now()) / 1000));
    const remainEl = document.querySelector(`.wild-egg-remain[data-id="${egg.id}"]`);
    if (remainEl) remainEl.textContent = remain;
    if (remain <= 0 && !document.querySelector(`.wild-hatch-btn[data-id="${egg.id}"]`)) {
      needWildEggRedraw = true;
    }
  });

  if (needEggRedraw) renderBreedingEggs(game, handlers);
  if (needWildEggRedraw) renderWildEggs(game, handlers);

  let needExpRedraw = false;
  (game.expeditions ?? []).forEach(exp => {
    const remain = Math.max(0, Math.ceil((exp.endAt - Date.now()) / 1000));
    const secEl = document.querySelector(`.exp-team-remain[data-id="${exp.id}"]`);
    if (secEl) secEl.textContent = remain;
    if (remain <= 0 && !document.querySelector(`.btn-exp-claim[data-id="${exp.id}"]`)) {
      needExpRedraw = true;
    }
  });
  if (needExpRedraw) renderExpeditionTab(game, handlers);

  updateExpBadge(game);
  updateBreedBadge(game);
}

// 全体描画のエントリーポイント
export function renderGame(game, state, handlers) {
  renderStarterEgg(game, handlers);
  renderStatusAndLogs(game);
  renderActiveDino(game, handlers);
  renderExploreBox(game, state, handlers);
  renderDinoList(game, state, handlers);
  renderBreedingEggs(game, handlers);
  renderWildEggs(game, handlers);
  renderDex(game, state);
  updateBreedBadge(game);
  renderBreedingStage(game, state.selectedMale, state.selectedFemale);
  renderRecords(game, state);
  renderTreasures(game);
  renderFacility(game, handlers);
  renderExpeditionTab(game, handlers);
  renderGachaTab(game, state, handlers);
  updateExpBadge(game);

  // エサやりボタンの共通登録（育成中エリア＋一覧の両方に対応）
  document.querySelectorAll(".feed-btn").forEach(btn => {
    btn.onclick = () => handlers.onFeed(btn.dataset.id, btn.dataset.type);
  });

  const fruitBtn = document.getElementById("useTraitFruitBtn");
  if (fruitBtn) fruitBtn.onclick = () => handlers.onUseTraitFruit();

  const elixirBtn = document.getElementById("useIvElixirBtn");
  if (elixirBtn) elixirBtn.onclick = () => handlers.onUseIvElixir();

  const sizePotionBtn = document.getElementById("useSizePotionBtn");
  if (sizePotionBtn) sizePotionBtn.onclick = () => handlers.onUseSizePotion();
}
