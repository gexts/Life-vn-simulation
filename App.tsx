import type { Story as StoryType } from "inkjs/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { Story } from "inkjs";
import "./index.css";
import Home from "./Home";
import { loadProfile, clearProfile } from "./profile";
import type { PlayerProfile } from "./profile";

type Choice = { index: number; text: string };

type VisualState = {
  bg?: string;
  cg?: string;
  overlays: string[];
  sfx?: string;
  bgm?: string;
  portraits: { L?: string; R?: string };
};

const SLOTS = [1, 2, 3] as const;
const slotKey = (i: number) => `life_vn_slot_${i}_v1`;

const CHAPTERS = [
  { label: "15", title: "十五岁", knot: "chapter_15" },
  { label: "22", title: "二十二岁", knot: "chapter_22" },
  { label: "28", title: "二十八岁", knot: "chapter_28" },
  { label: "35", title: "三十五岁", knot: "chapter_35" },
] as const;

export default function App() {
  const [storyJson, setStoryJson] = useState<any | null>(null);
  const storyRef = useRef<StoryType | null>(null);

  const [text, setText] = useState<string>("");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [visual, setVisual] = useState<VisualState>({
    overlays: ["OL_paper", "OL_grain"],
    portraits: {},
  });

  const [drawer, setDrawer] = useState<"chapters" | "saves" | null>(null);
  const [mode, setMode] = useState<"home" | "vn">("home");

  const profile = useMemo(() => loadProfile(), [mode]);

  const assetUrl = useMemo(() => {
    return (key: string, ext: "webp" | "png" = "webp") => `/assets/${key}.${ext}`;
  }, []);

  useEffect(() => {
    fetch("/story.json")
      .then((r) => r.json())
      .then((json) => setStoryJson(json))
      .catch((e) => {
        console.error(e);
        setText("加载 story.json 失败：请确认 predev 编译成功。");
      });
  }, []);

  function applyTags(tags: string[]) {
    setVisual((prev) => {
      let bg = prev.bg;
      let cg = prev.cg;
      let overlays = prev.overlays;
      let sfx = prev.sfx;
      let bgm = prev.bgm;
      const portraits = { ...prev.portraits };

      for (const raw of tags) {
        const t = raw.trim();
        const i = t.indexOf(":");
        if (i <= 0) continue;

        const k = t.slice(0, i).trim().toUpperCase();
        const v = t.slice(i + 1).trim();

        if (k === "BG") bg = v;
        else if (k === "CG") cg = v;
        else if (k === "OVERLAY") overlays = v.split(",").map((x) => x.trim()).filter(Boolean);
        else if (k === "SFX") sfx = v;
        else if (k === "BGM") bgm = v;
        else if (k === "PORTRAIT_L") portraits.L = v;
        else if (k === "PORTRAIT_R") portraits.R = v;
      }

      return { bg, cg, overlays, sfx, bgm, portraits };
    });
  }

  function continueStory() {
    const story = storyRef.current;
    if (!story) return;

    const lines: string[] = [];
    const tagSet = new Set<string>();

    while (story.canContinue) {
      const line = (story.Continue() ?? "").trim();
      if (line) lines.push(line);
      for (const t of story.currentTags ?? []) tagSet.add(t);
    }

    applyTags([...tagSet]);
    setText(lines.join("\n\n"));
    setChoices(story.currentChoices.map((c, idx) => ({ index: idx, text: c.text })));
  }

  function makeNewStory() {
    if (!storyJson) return null;
    return new Story(storyJson);
  }

  function injectProfileVars(story: Story, p: PlayerProfile | null) {
    if (!p) return;

    // 种子（让不同输入的“初始气质”略不同，但不构成预言）
    story.variablesState["calm"] = p.seed.calm;
    story.variablesState["courage"] = p.seed.courage;
    story.variablesState["connection"] = p.seed.connection;
    story.variablesState["craft"] = p.seed.craft;

    // 旁白画像文本
    story.variablesState["p1"] = p.lines[0] ?? "";
    story.variablesState["p2"] = p.lines[1] ?? "";
    story.variablesState["p3"] = p.lines[2] ?? "";
    story.variablesState["p4"] = p.lines[3] ?? "";

    story.variablesState["allow_sensitive"] = p.input.allowSensitive;
    story.variablesState["element"] = p.element;

    const w = p.weights ?? {
    migration: 2,
    relationship: 2,
    career: 2,
    repair: 2,
    loss: p.input.allowSensitive ? 1 : 0,
    };
    story.variablesState["w_migration"] = w.migration;
    story.variablesState["w_relationship"] = w.relationship;
    story.variablesState["w_career"] = w.career;
    story.variablesState["w_repair"] = w.repair;
    story.variablesState["w_loss"] = p.input.allowSensitive ? w.loss : 0;
  }

  function startNew() {
    const s = makeNewStory();
    if (!s) return;
    injectProfileVars(s, profile);
    storyRef.current = s;
    continueStory();
  }

  function startAt(knot: string) {
    const s = makeNewStory();
    if (!s) return;
    injectProfileVars(s, profile);
    s.ChoosePathString(knot);
    storyRef.current = s;
    continueStory();
  }

  function choose(index: number) {
    const story = storyRef.current;
    if (!story) return;
    story.ChooseChoiceIndex(index);
    continueStory();
  }

  function saveToSlot(i: number) {
    const story = storyRef.current;
    if (!story) return;
    localStorage.setItem(slotKey(i), story.state.ToJson());
  }

  function loadFromSlot(i: number) {
    const s = makeNewStory();
    if (!s) return;

    const saved = localStorage.getItem(slotKey(i));
    if (!saved) return;

    s.state.LoadJson(saved);
    // 注意：读档应尊重存档时的状态，不再覆盖变量
    storyRef.current = s;
    continueStory();
  }

  function clearSlot(i: number) {
    localStorage.removeItem(slotKey(i));
  }

  function hasSlot(i: number) {
    return !!localStorage.getItem(slotKey(i));
  }

  // 初次进入：如果已有 profile，直接进 VN；否则进 Home
  useEffect(() => {
    const p = loadProfile();
    setMode(p ? "vn" : "home");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // VN 模式且 storyJson 已就绪时启动
  useEffect(() => {
    if (mode === "vn" && storyJson) startNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, storyJson]);

  if (mode === "home") {
    return (
      <Home
        onStart={() => {
          setMode("vn");
        }}
      />
    );
  }

  return (
    <div className="vn" style={{ backgroundImage: visual.bg ? `url(${assetUrl(visual.bg, "webp")})` : undefined }}>
      <div className="overlays">
        {visual.overlays.map((k) => (
          <img key={k} className="overlay" src={assetUrl(k, "png")} alt={k} />
        ))}
      </div>

      {visual.cg && <img className="cg" src={assetUrl(visual.cg, "webp")} alt={visual.cg} />}

      <div className="topbar">
        <button onClick={() => setDrawer(drawer === "chapters" ? null : "chapters")}>时间轴</button>
        <button onClick={() => setDrawer(drawer === "saves" ? null : "saves")}>存档</button>
        <button onClick={startNew}>重开</button>
        <button
          onClick={() => {
            clearProfile();
            setMode("home");
          }}
        >
          重设信息
        </button>
      </div>

      <div className={`drawer ${drawer === "chapters" ? "open" : ""}`}>
        <div className="drawerTitle">章节时间轴</div>
        <div className="drawerContent">
          {CHAPTERS.map((c) => (
            <button key={c.knot} className="drawerBtn" onClick={() => startAt(c.knot)}>
              <div className="drawerBtnMain">
                <span className="age">{c.label}</span>
                <span className="title">{c.title}</span>
              </div>
              <div className="hint">从该章节开始</div>
            </button>
          ))}
        </div>
      </div>

      <div className={`drawer ${drawer === "saves" ? "open" : ""}`}>
        <div className="drawerTitle">存档槽</div>
        <div className="drawerContent">
          {SLOTS.map((i) => (
            <div key={i} className="slotRow">
              <div className="slotLabel">槽位 {i}</div>
              <button className="slotBtn" onClick={() => saveToSlot(i)}>
                存
              </button>
              <button className="slotBtn" onClick={() => loadFromSlot(i)} disabled={!hasSlot(i)}>
                读
              </button>
              <button className="slotBtn danger" onClick={() => clearSlot(i)} disabled={!hasSlot(i)}>
                清
              </button>
            </div>
          ))}
          <div className="slotNote">提示：时间轴跳转会从该章节新开局；继续进度请读档。</div>
        </div>
      </div>

      <div className="panel">
        <div className="text">{text || "…"}</div>
        <div className="choices">
          {choices.map((c) => (
            <button key={c.index} className="choice" onClick={() => choose(c.index)}>
              {c.text}
            </button>
          ))}
          {choices.length === 0 && (
            <button className="choice" onClick={startNew}>
              重新开始
            </button>
          )}
        </div>
      </div>

      {drawer && <div className="backdrop" onClick={() => setDrawer(null)} />}
    </div>
  );
}