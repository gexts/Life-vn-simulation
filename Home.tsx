import { useMemo, useState } from "react";
import { buildProfile, saveProfile } from "./profile";
import type { BirthInput, PlayerProfile } from "./profile";

type Props = {
  onStart: () => void;
};

export default function Home({ onStart }: Props) {
  const now = new Date();
  const [form, setForm] = useState<BirthInput>({
    name: "",
    date: "2000-01-01",
    time: "12:00",
    city: "上海",
    allowSensitive: false,
  });

  const [agreed, setAgreed] = useState(false);
  const profile: PlayerProfile | null = useMemo(() => {
    try {
      if (!form.date || !form.time || !form.city) return null;
      return buildProfile(form);
    } catch {
      return null;
    }
  }, [form]);

  function commit() {
    if (!profile) return;
    saveProfile(profile);
    onStart();
  }

  return (
    <div className="home">
      <div className="homeCard">
        <div className="homeTitle">模拟人生 · 旁白</div>
        <div className="homeSub">
          这是一段叙事体验：它提供选择与练习，不提供现实承诺。
        </div>

        <div className="grid">
          <label>
            名字（可选）
            <input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>

          <label>
            出生日期
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>

          <label>
            出生时间（到分钟）
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </label>

          <label>
            出生地点（城市）
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
        </div>

        <label className="checkRow">
          <input
            type="checkbox"
            checked={form.allowSensitive}
            onChange={(e) => setForm({ ...form, allowSensitive: e.target.checked })}
          />
          允许出现“失去/告别”等主题
        </label>

        <label className="checkRow">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          我理解这是叙事体验，不作为现实决策依据
        </label>

        <div className="divider" />

        <div className="previewTitle">个人画像预览</div>
        {profile ? (
          <div className="preview">
            <div className="bars">
              <Bar label="心性" v={profile.seed.calm} />
              <Bar label="勇气" v={profile.seed.courage} />
              <Bar label="宜人" v={profile.seed.connection} />
              <Bar label="技能" v={profile.seed.craft} />
            </div>

            <div className="lines">
              {profile.lines.map((t, i) => (
                <div key={i} className="line">
                  {t}
                </div>
              ))}
              <div className="advice">
                <div className="adviceTitle">小建议</div>
                <ul>
                  {profile.advice.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="muted">请先填写出生信息。</div>
        )}

        <button className="primary" disabled={!agreed || !profile} onClick={commit}>
          进入旅途
        </button>

        <div className="footnote">
          生成时间：{now.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function Bar({ label, v }: { label: string; v: number }) {
  // v: 0..2 -> 显示 3 格
  return (
    <div className="barRow">
      <div className="barLabel">{label}</div>
      <div className="barCells">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`cell ${i <= v ? "on" : ""}`} />
        ))}
      </div>
    </div>
  );
}