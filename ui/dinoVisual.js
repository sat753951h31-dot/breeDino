// 種族IDごとのシルエットタイプ定義
// 種族ID・ボスIDごとのシルエットタイプ定義
const SPECIES_ARCHETYPE = {
  // 肉食獣脚類
  compy: "theropod",
  raptor: "theropod",
  shadowraptor: "theropod",
  trex: "theropod",
  spino: "theropod",
  giganoto: "theropod",
  allo: "theropod",
  omega_rex: "theropod",
  tyrannospino: "theropod",
  boss_1: "theropod", // キングラプトル
  boss_2: "theropod", // エンシェントレックス
  boss_3: "theropod", // マグマギガノト

  // 首長竜脚類
  brachio: "sauropod",
  gigabrachio: "sauropod",

  // 角竜類
  triceratops: "ceratopsian",
  aegistops: "ceratopsian",

  // 装甲・剣竜類
  stego: "armored",
  ankylo: "armored",
  armored_allo: "armored",
  fortress_titan: "armored",

  // 翼竜類
  quetzal: "pterosaur",

  // ドラゴン・ハイブリッド系
  dragonraptor: "dragon",
  chaosdragon: "dragon",
  sky_overlord: "dragon",
  genesis_dragon: "dragon",
  boss_4: "dragon", // アビスドラゴン
  boss_5: "dragon"  // バハムート・オメガ
};

// IDまたはモンスター名からシルエットタイプを自動判定する
function resolveArchetype(speciesId = "", enemyName = "") {
  if (SPECIES_ARCHETYPE[speciesId]) {
    return SPECIES_ARCHETYPE[speciesId];
  }

  const key = `${speciesId} ${enemyName}`.toLowerCase();

  if (key.includes("dragon") || key.includes("ドラゴン") || key.includes("竜王") || key.includes("竜神") || key.includes("バハムート") || key.includes("ワイバーン")) {
    return "dragon";
  }
  if (key.includes("ptera") || key.includes("quetzal") || key.includes("プテラ") || key.includes("ケツァル") || key.includes("翼竜")) {
    return "pterosaur";
  }
  if (key.includes("brachio") || key.includes("diplo") || key.includes("ブラキオ") || key.includes("ディプロ") || key.includes("首長")) {
    return "sauropod";
  }
  if (key.includes("tricera") || key.includes("tops") || key.includes("トリケラ") || key.includes("トプス") || key.includes("角竜")) {
    return "ceratopsian";
  }
  if (key.includes("stego") || key.includes("ankylo") || key.includes("armor") || key.includes("ステゴ") || key.includes("アンキロ") || key.includes("装甲") || key.includes("タイタン")) {
    return "armored";
  }

  return "theropod";
}

// タイプ別のSVGシルエットパス（viewBox="0 0 100 70"）
const ARCHETYPE_SVGS = {
  theropod: `
    <path d="M12,48 Q26,46 38,34 L48,22 Q54,12 68,12 L84,15 L84,21 L72,22 L76,26 L66,27 L60,36 L66,42 L61,44 L56,39 L52,56 L58,60 L46,60 L47,46 L38,46 L39,60 L29,60 L33,47 Q20,52 10,50 Z" />
  `,
  sauropod: `
    <path d="M10,52 Q24,50 32,38 L44,12 Q47,6 54,8 L58,12 L50,15 L44,36 Q56,34 66,40 L68,60 L60,60 L59,46 L44,46 L43,60 L35,60 L36,45 Q22,55 10,54 Z" />
  `,
  ceratopsian: `
    <path d="M14,48 L24,38 Q38,32 54,34 L62,22 L68,26 L66,34 L84,28 L82,33 L68,38 L82,42 L80,45 L64,44 L62,60 L54,60 L54,48 L36,48 L35,60 L27,60 L28,48 Z" />
  `,
  armored: `
    <path d="M10,48 L22,42 L26,32 L32,38 L37,26 L43,36 L49,26 L55,36 L61,30 L65,38 L78,42 L76,48 L64,48 L63,60 L55,60 L55,50 L37,50 L36,60 L28,60 L29,48 L14,52 L8,54 Z" />
  `,
  pterosaur: `
    <path d="M8,32 Q32,14 48,30 L64,22 L88,28 L66,33 L56,38 L76,54 L48,42 L24,54 L38,38 Z" />
  `,
  dragon: `
    <path d="M8,54 Q22,48 34,36 L22,14 L42,24 L52,12 L48,8 L56,10 L62,6 L60,13 L78,16 L76,22 L64,23 L60,34 L68,42 L62,44 L56,39 L54,58 L60,62 L48,62 L49,47 L38,47 L38,62 L28,62 L32,48 Q18,56 8,56 Z" />
  `
};

/**
 * 恐竜のビジュアルHTMLを生成する
 * @param {string} speciesId 種族ID
 * @param {object} options { color, size, mutant, isUnknown, compact }
 */
export function renderDinoAvatar(speciesId, options = {}) {
  const {
    enemyName = "",
    color = "normal",
    size = "normal",
    mutant = false,
    isUnknown = false,
    isEnemy = false,
    compact = false
  } = options;

  const archetype = resolveArchetype(speciesId, enemyName);
  const svgInner = ARCHETYPE_SVGS[archetype];

  const classes = [
    "dino-avatar-box",
    compact ? "is-compact" : "",
    isUnknown ? "is-silhouette" : isEnemy ? "is-enemy-wild" : `color-${color}`,
    `size-${size}`,
    mutant && !isUnknown ? "is-mutant-aura" : ""
  ].filter(Boolean).join(" ");

  return `
    <div class="${classes}">
      <svg class="dino-svg" viewBox="0 0 100 70" xmlns="http://w3.org">
        ${svgInner}
      </svg>
      ${mutant && !isUnknown ? `<span class="avatar-mutant-spark">🧬</span>` : ""}
    </div>
  `;
}

