import { DEX_SPECIES } from "./dexSpecies.js";
import { TREASURES, MAX_TREASURE_LEVEL } from "./treasures.js";
import { AREA_BOSSES } from "./bosses.js";
import { AREA_EXPEDITIONS } from "./expeditions.js";
import { FACILITIES, MAX_FACILITY_LEVEL } from "./facilities.js";

export const ACHIEVEMENTS = [
  {
    id: "first_win",
    title: "初めての狩猟",
    desc: "探索の戦闘で1回勝利する",
    rewardText: "🍖 生肉 ×5",
    reward: { type: "raw", amount: 5 },
    getProgress: (game) => ({ current: game.stats.exploreWins, max: 1 })
  },
  {
    id: "win_50",
    title: "熟練のハンター",
    desc: "探索の戦闘で累計50回勝利する",
    rewardText: "💎 生命の結晶 ×3",
    reward: { type: "crystal", amount: 3 },
    getProgress: (game) => ({ current: game.stats.exploreWins, max: 50 })
  },
  {
    id: "hatch_10",
    title: "ブリーダーの卵",
    desc: "卵を累計10個孵化させる",
    rewardText: "💎 生命の結晶 ×2",
    reward: { type: "crystal", amount: 2 },
    getProgress: (game) => ({ current: game.stats.eggsHatched, max: 10 })
  },
  {
    id: "crystal_10",
    title: "結晶ハンター",
    desc: "「生命の結晶」を累計10個獲得する",
    rewardText: "🥩 上質肉 ×5",
    reward: { type: "good", amount: 5 },
    getProgress: (game) => ({
      current: game.stats?.crystalsEarned ?? 0,
      max: 10
    })
  },
  {
    id: "crystal_50",
    title: "生命の探究者",
    desc: "「生命の結晶」を累計50個獲得する",
    rewardText: "🎲 特性変更の果実 ×1",
    reward: { type: "traitFruit", amount: 1 },
    getProgress: (game) => ({
      current: game.stats?.crystalsEarned ?? 0,
      max: 50
    })
  },
  {
    id: "breed_10",
    title: "命を繋ぐ者",
    desc: "恐竜の交配を累計10回行う",
    rewardText: "📏 体格変化の薬 ×1",
    reward: { type: "sizePotion", amount: 1 },
    getProgress: (game) => ({ current: game.stats.breedsDone, max: 10 })
  },
  {
    id: "first_mutant",
    title: "奇跡の突然変異",
    desc: "MUTANT（個体値120以上）の恐竜を誕生させる",
    rewardText: "💉 個体値強化の秘薬 ×1",
    reward: { type: "ivElixir", amount: 1 },
    getProgress: (game) => ({ current: game.stats.mutantsBorn, max: 1 })
  },
  {
    id: "gen_5",
    title: "血統の継承",
    desc: "第5世代（F5）以上の恐竜を誕生させる",
    rewardText: "💎 生命の結晶 ×5",
    reward: { type: "crystal", amount: 5 },
    getProgress: (game) => ({ current: game.stats.maxGeneration, max: 5 })
  },
  {
    id: "gen_15",
    title: "究極のサラブレッド",
    desc: "第15世代（F15）以上の恐竜を誕生させる",
    rewardText: "💉 個体値強化の秘薬 ×2",
    reward: { type: "ivElixir", amount: 2 },
    getProgress: (game) => ({ current: game.stats.maxGeneration, max: 15 })
  },
  {
    id: "dex_half",
    title: "恐竜研究家",
    desc: "恐竜図鑑を50%以上埋める",
    rewardText: "💎 生命の結晶 ×5",
    reward: { type: "crystal", amount: 5 },
    getProgress: (game) => ({
      current: game.discoveredSpecies.length,
      max: Math.ceil(DEX_SPECIES.length * 0.5)
    })
  },
  {
    id: "dex_complete",
    title: "恐竜博士",
    desc: "恐竜図鑑を100%コンプリートする",
    rewardText: "💎 生命の結晶 ×30",
    reward: { type: "crystal", amount: 30 },
    getProgress: (game) => ({
      current: game.discoveredSpecies.length,
      max: DEX_SPECIES.length
    })
  },
  {
    id: "area_5_clear",
    title: "竜王の制覇者",
    desc: "エリア Lv.5（竜王の聖域）の探索率を100%にする",
    rewardText: "💎 生命の結晶 ×10",
    reward: { type: "crystal", amount: 10 },
    getProgress: (game) => ({
      current: game.areaProgress[5] ?? 0,
      max: 100
    })
  },
  {
    id: "treasure_first",
    title: "トレジャーハンター",
    desc: "いずれかのエリア秘宝を初めて発見する",
    rewardText: "🥩 上質肉 ×5",
    reward: { type: "good", amount: 5 },
    getProgress: (game) => {
      const ownedCount = TREASURES.filter(t => (game.treasures?.[t.id] ?? 0) > 0).length;
      return { current: ownedCount, max: 1 };
    }
  },
  {
    id: "treasure_complete",
    title: "秘宝コレクター",
    desc: "すべてのエリア秘宝（全6種）を発見する",
    rewardText: "🎲 特性変更の果実 ×2",
    reward: { type: "traitFruit", amount: 2 },
    getProgress: (game) => {
      const ownedCount = TREASURES.filter(t => (game.treasures?.[t.id] ?? 0) > 0).length;
      return { current: ownedCount, max: TREASURES.length };
    }
  },
  {
    id: "treasure_all_max",
    title: "伝説の考古学者",
    desc: "すべてのエリア秘宝を最大レベル（Lv.MAX）まで強化する",
    rewardText: "💉 個体値強化の秘薬 ×2",
    reward: { type: "ivElixir", amount: 2 },
    getProgress: (game) => {
      const totalLevels = TREASURES.reduce(
        (sum, t) => sum + Math.min(MAX_TREASURE_LEVEL, game.treasures?.[t.id] ?? 0),
        0
      );
      return {
        current: totalLevels,
        max: TREASURES.length * MAX_TREASURE_LEVEL
      };
    }
  },
  {
    id: "boss_first",
    title: "覇王への挑戦者",
    desc: "いずれかのエリアボスを初めて撃破する",
    rewardText: "💎 生命の結晶 ×3",
    reward: { type: "crystal", amount: 3 },
    getProgress: (game) => ({
      current: game.stats?.bossWins ?? 0,
      max: 1
    })
  },
  {
    id: "boss_all_clear",
    title: "全領域の支配者",
    desc: "すべてのエリアボス（全6体）を撃破する",
    rewardText: "💎 生命の結晶 ×15",
    reward: { type: "crystal", amount: 15 },
    getProgress: (game) => {
      const clearedCount = AREA_BOSSES.filter(
        b => game.bossCleared?.[b.areaLevel]
      ).length;
      return {
        current: clearedCount,
        max: AREA_BOSSES.length
      };
    }
  },
  {
    id: "boss_omega_clear",
    title: "創世竜神を討ちし者",
    desc: "エリア Lv.5 の守護ボス「バハムート・オメガ」を撃破する",
    rewardText: "✨ 極上肉 ×15",
    reward: { type: "premium", amount: 15 },
    getProgress: (game) => ({
      current: game.bossCleared?.[5] ? 1 : 0,
      max: 1
    })
  },
  {
    id: "exp_first",
    title: "初めての遠征隊",
    desc: "遠征隊を派遣して初めて帰還させる",
    rewardText: "🍖 生肉 ×5",
    reward: { type: "raw", amount: 5 },
    getProgress: (game) => ({
      current: game.stats?.expeditionsDone ?? 0,
      max: 1
    })
  },
  {
    id: "exp_15",
    title: "熟練の遠征隊長",
    desc: "遠征隊を累計15回帰還させる",
    rewardText: "💎 生命の結晶 ×5",
    reward: { type: "crystal", amount: 5 },
    getProgress: (game) => ({
      current: game.stats?.expeditionsDone ?? 0,
      max: 15
    })
  },
  {
    id: "exp_50",
    title: "大遠征時代の幕開け",
    desc: "遠征隊を累計50回帰還させる",
    rewardText: "📏 体格変化の薬 ×2",
    reward: { type: "sizePotion", amount: 2 },
    getProgress: (game) => ({
      current: game.stats?.expeditionsDone ?? 0,
      max: 50
    })
  },
  {
    id: "exp_all_routes",
    title: "全領域の開拓者",
    desc: "すべての遠征ルート（全6部隊枠）を解放する",
    rewardText: "💎 生命の結晶 ×15",
    reward: { type: "crystal", amount: 15 },
    getProgress: (game) => {
      const unlockedCount = AREA_EXPEDITIONS.filter(
        e => (game.areaProgress?.[e.areaLevel] ?? 0) >= 100
      ).length;
      return {
        current: unlockedCount,
        max: AREA_EXPEDITIONS.length
      };
    }
  },
  {
    id: "facility_first",
    title: "拠点の開拓者",
    desc: "いずれかの拠点設備を初めてアップグレードする",
    rewardText: "🥩 上質肉 ×5",
    reward: { type: "good", amount: 5 },
    getProgress: (game) => {
      const totalLv = FACILITIES.reduce(
        (sum, f) => sum + (game.facility?.[f.key] ?? 0),
        0
      );
      return { current: totalLv, max: 1 };
    }
  },
  {
    id: "facility_all_max",
    title: "究極の恐竜王国",
    desc: "すべての拠点設備（全4施設）を最大レベル（Lv.MAX）にする",
    rewardText: "💉 個体値強化の秘薬 ×1",
    reward: { type: "ivElixir", amount: 1 },
    getProgress: (game) => {
      const totalLv = FACILITIES.reduce(
        (sum, f) => sum + Math.min(MAX_FACILITY_LEVEL, game.facility?.[f.key] ?? 0),
        0
      );
      return {
        current: totalLv,
        max: FACILITIES.length * MAX_FACILITY_LEVEL
      };
    }
  },
  {
    id: "craft_first",
    title: "古代の職人",
    desc: "古代工房で初めてアイテムを作成する",
    rewardText: "💎 生命の結晶 ×3",
    reward: { type: "crystal", amount: 3 },
    getProgress: (game) => ({ current: game.stats.itemsCrafted ?? 0, max: 1 })
  },
  {
    id: "craft_master",
    title: "伝説の錬金マイスター",
    desc: "古代工房でアイテムを累計 20回 作成する",
    rewardText: "🎲 特性変更の果実 ×2",
    reward: { type: "traitFruit", amount: 2 },
    getProgress: (game) => ({ current: game.stats.itemsCrafted ?? 0, max: 20 })
  },
  {
    id: "use_special_first",
    title: "覚醒の儀式",
    desc: "貴重品（果実・秘薬・体格薬）を初めて使用する",
    rewardText: "✨ 極上肉 ×5",
    reward: { type: "premium", amount: 5 },
    getProgress: (game) => ({ current: game.stats.itemsUsed ?? 0, max: 1 })
  },
  {
    id: "use_special_master",
    title: "究極個体の創造主",
    desc: "貴重品（果実・秘薬・体格薬）を累計 15回 使用する",
    rewardText: "💉 個体値強化の秘薬 ×2",
    reward: { type: "ivElixir", amount: 2 },
    getProgress: (game) => ({ current: game.stats.itemsUsed ?? 0, max: 15 })
  },
  {
    id: "gacha_first",
    title: "結晶の召喚師",
    desc: "ガチャ卵を初めて回す",
    rewardText: "💎 生命の結晶 ×5",
    reward: { type: "crystal", amount: 5 },
    getProgress: (game) => ({ current: game.stats.gachaRolls ?? 0, max: 1 })
  },
  {
    id: "gacha_10",
    title: "運命の10連召喚",
    desc: "ガチャ卵を累計 10回 回す",
    rewardText: "🎲 特性変更の果実 ×1",
    reward: { type: "traitFruit", amount: 1 },
    getProgress: (game) => ({ current: game.stats.gachaRolls ?? 0, max: 10 })
  },
  {
    id: "gacha_50",
    title: "伝説のガチャマスター",
    desc: "ガチャ卵を累計 50回 回す",
    rewardText: "💉 個体値強化の秘薬 ×2",
    reward: { type: "ivElixir", amount: 2 },
    getProgress: (game) => ({ current: game.stats.gachaRolls ?? 0, max: 50 })
  },
  {
    id: "loop_2",
    title: "新たな世界の開拓者",
    desc: "1周目を制覇し、2周目の世界に到達する",
    rewardText: "💎 生命の結晶 ×10",
    reward: { type: "crystal", amount: 10 },
    getProgress: (game) => ({
      current: Math.max(game.worldLoop ?? 1, game.stats?.maxWorldLoop ?? 1),
      max: 2
    })
  },
  {
    id: "loop_5",
    title: "次元を超える覇者",
    desc: "5周目の世界に到達する",
    rewardText: "💎 生命の結晶 ×30",
    reward: { type: "crystal", amount: 30 },
    getProgress: (game) => ({
      current: Math.max(game.worldLoop ?? 1, game.stats?.maxWorldLoop ?? 1),
      max: 5
    })
  },
  {
    id: "loop_10",
    title: "永劫の恐竜神",
    desc: "10周目の世界に到達する",
    rewardText: "💎 生命の結晶 ×50",
    reward: { type: "crystal", amount: 50 },
    getProgress: (game) => ({
      current: Math.max(game.worldLoop ?? 1, game.stats?.maxWorldLoop ?? 1),
      max: 10
    })
  }
];
