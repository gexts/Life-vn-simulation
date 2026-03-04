export type BirthInput = {
  name?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  city: string; // free text
  allowSensitive: boolean;
};

export type PlayerProfile = {
  input: BirthInput;
  seed: { calm: number; courage: number; connection: number; craft: number };
  element: string;          // 五行主题（叙事风格用）
  rhythm: string;           // “节奏倾向”
  pressure: string;         // “压力来源”
  advice: string[];         // 可执行建议（非承诺）
  lines: string[];          // 旁白式画像文字
    weights: {
    migration: number;
    relationship: number;
    career: number;
    repair: number;
    loss: number;
  };
};

const PROFILE_KEY = "life_vn_profile_v1";

function fnv1a(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]) {
  return arr[Math.floor(rng() * arr.length)];
}

export function buildProfile(input: BirthInput): PlayerProfile {
  // 说明：这里用“稳定的伪随机”当作叙事种子。
  // 你后面如果接入真实紫微/八字，只要把 seed/element/lines 的生成换掉即可。
  const key = `${input.date}T${input.time}|${input.city}|${input.name ?? ""}`;
  const rng = mulberry32(fnv1a(key));

  // 0~2 的小种子，避免一上来数值过大
  const seed = {
    calm: Math.floor(rng() * 3),
    courage: Math.floor(rng() * 3),
    connection: Math.floor(rng() * 3),
    craft: Math.floor(rng() * 3),
  };

  const element = pick(rng, ["木", "火", "土", "金", "水"]);
  const rhythm = pick(rng, [
    "慢热但稳定",
    "先观望再出手",
    "容易在关键点爆发",
    "擅长长期推进",
    "对环境很敏感",
  ]);
  const pressure = pick(rng, [
    "对自己要求太高",
    "在关系里容易自我消耗",
    "对不确定性过敏",
    "总想一次就做对",
    "把情绪压成效率",
  ]);

  const advice = [
    "把选择拆成“下一步动作”，不要一次决定一生。",
    "每周留出一段不被打断的时间：只做一件让你恢复的事。",
    "当你犹豫时，先问：我是在怕结果，还是在怕被评价？",
  ];

  const lines = [
    `你选择在${input.city}把故事打开。旁白不会替你下结论，只会照亮倾向。`,
    `你更像一种“${rhythm}”的人，擅长在静处积累，然后在某个节点做出明确动作。`,
    `你的压力往往来自“${pressure}”。当它出现时，你需要的是节奏，而不是更狠的自责。`,
    `叙事主题偏向“${element}”：把它当作风格滤镜，而不是现实判词。`,
  ];
  // 主题权重：决定“更常出现哪类人生片段”
  // 基础都是 2，保证任何主题都可能出现；loss 只在允许敏感主题时启用
  const weights = {
    migration: 2,
    relationship: 2,
    career: 2,
    repair: 2,
    loss: input.allowSensitive ? 1 : 0,
  };

  // 五行 -> 叙事偏好（只是风格滤镜，不是现实承诺）
  if (element === "木") { weights.migration += 1; weights.repair += 1; }
  if (element === "火") { weights.career += 2; weights.relationship += 1; }
  if (element === "土") { weights.repair += 2; weights.career += 1; }
  if (element === "金") { weights.career += 1; weights.migration += 1; }
  if (element === "水") { weights.relationship += 2; weights.repair += 1; }

  // 节奏倾向微调
  if (rhythm === "慢热但稳定") weights.repair += 1;
  if (rhythm === "先观望再出手") weights.repair += 1;
  if (rhythm === "容易在关键点爆发") weights.career += 1;
  if (rhythm === "对环境很敏感") { weights.migration += 1; weights.repair += 1; }

  // 压力来源微调
  if (pressure === "在关系里容易自我消耗") { weights.relationship += 1; weights.repair += 1; }
  if (pressure === "对不确定性过敏") { weights.migration += 1; weights.repair += 1; }
  if (pressure === "把情绪压成效率") { weights.repair += 2; }

  // 简单截断，避免过大
  const clamp = (x: number) => Math.max(0, Math.min(6, x));
  weights.migration = clamp(weights.migration);
  weights.relationship = clamp(weights.relationship);
  weights.career = clamp(weights.career);
  weights.repair = clamp(weights.repair);
  weights.loss = clamp(weights.loss);

  return { input, seed, element, rhythm, pressure, advice, lines, weights };
}

export function saveProfile(p: PlayerProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export function loadProfile(): PlayerProfile | null {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;

  try {
    const obj: any = JSON.parse(raw);
    if (!obj || !obj.input || !obj.seed) return null;

    // 兜底 allowSensitive
    if (typeof obj.input.allowSensitive !== "boolean") obj.input.allowSensitive = false;

    // 旧版本没有 weights：自动补齐
    if (!obj.weights) {
      obj.weights = {
        migration: 2,
        relationship: 2,
        career: 2,
        repair: 2,
        loss: obj.input.allowSensitive ? 1 : 0,
      };
    } else {
      // 部分缺字段也补齐
      obj.weights.migration ??= 2;
      obj.weights.relationship ??= 2;
      obj.weights.career ??= 2;
      obj.weights.repair ??= 2;
      obj.weights.loss ??= (obj.input.allowSensitive ? 1 : 0);
    }

    return obj as PlayerProfile;
  } catch {
    return null;
  }
}

export function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
}