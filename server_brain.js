#!/usr/bin/env node
/* server_brain.js — 출제자 뇌 24시간 가동 루틴 (GitHub Actions 전용, 무료 스택)
 *
 * 매시 수행:
 *   Phase A 자가학습  : 활성 유형 중 3객관+1서술형 표본 → selfLearnStep(교사 3인 심사) → 개선 규칙 도출,
 *                       생성 샘플은 addon_key_guard(코드검증+솔버 3표)를 통과한 것만 self_samples에 보존
 *   Phase B 교사 회의 : ① GAS queue의 사용자 요청(최대 3건) ② 연구 시드 60개 시간 회전(2건)
 *                       → deliberate(교사 4인 대화) → 판정·회의록 md·공식 공지·반영 규칙
 *   Phase C 영속화    : learned_rules(60cap) · announcements(50cap) · teacher_projects(100cap)
 *                       · research_log(200cap) · self_samples(12cap) · USABLE_RULES.md append
 *
 * 환경변수: GROQ_API_KEY(권장) | GEMINI_API_KEY | GAS_URL(요청 큐) | BUDGET(LLM 콜 상한, 기본 60)
 * 안전장치: LLM 호출 예산 초과 시 빈 응답으로 차단(무한 소비 방지), 페이즈별 try/catch, 항상 exit 0.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;
const BUDGET = parseInt(process.env.BUDGET || "60", 10);
const GAS = (process.env.GAS_URL || "").trim();
/* 시간 예산: 마감 도달 시 LLM만 즉시 차단 → 마무리(Phase C 아카이브·커밋)는 반드시 잡 타임아웃 안에 실행됨 */
const DEADLINE = Date.now() + parseInt(process.env.TIME_BUDGET_MIN || "11", 10) * 60 * 1000;

let used = 0, blocked = 0;
const realFetch = global.fetch.bind(global);

/* fetch 심: ① 상대경로 → 저장소 파일 ② LLM 호스트 → 예산(콜 수+시간) 카운트 */
global.fetch = async function (url, init) {
  const u = String((url && url.url) || url);
  if (!/^https?:\/\//.test(u)) {
    const p = path.join(ROOT, u.split("?")[0]);
    if (!fs.existsSync(p)) return new Response("404: Not Found", { status: 404 });
    return new Response(fs.readFileSync(p, "utf8"), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (/pollinations\.ai|api\.groq\.com|generativelanguage\.googleapis/.test(u)) {
    if (used >= BUDGET || Date.now() > DEADLINE) {
      blocked++;
      // 429 형태로 반환 → 엔진의 LAST_LIMITED 감지로 재시도·지연 없이 즉시 다음 단계(마무리)로
      return new Response(JSON.stringify({ error: { code: 429, message: "local budget/time exhausted (rate limit)" } }),
        { status: 200, headers: { "content-type": "application/json" } });
    }
    used++;
  }
  return realFetch(u, init);
};

global.window = global.window || {};
require("./api_team.js");
const T = window.APITEAM;
require("./addon_key_guard.js"); // generateOne/generateExam에 정답키 3중 가드 자동 장착
var PSY = null; try { PSY = require("./addon_psychometric.js"); } catch (e) { }   // 측정 하네스(변별도·난이도·오답효율)

/* ── 유틸 ── */
const J = (rel, def) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); } catch (_) { return def; } };
const W = (rel, obj) => { const p = path.join(ROOT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 1)); };
const ts = () => new Date().toISOString();
const day = () => ts().slice(0, 10);
const slug = s => (String(s).replace(/[^\w가-힣]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)) || "topic";

const FALLBACK_PASSAGE = "When our actions clash with our beliefs, we feel an uncomfortable tension that the mind is eager to remove. Instead of admitting we were wrong, we quietly reshape our beliefs until they fit what we have already done. For example, a person who pays a high price for a course they find dull may convince themselves that it is secretly valuable, simply because they have committed their money to it. However, this comfort comes at a cost: by changing our thoughts rather than our behavior, we drift further from the truth. Therefore, resolving inner conflict is often not a movement toward accuracy but a clever defense of our past choices.";

function pickPassage() {
  const db = J("corpus/passage_db.json", null);
  const arr = (db && db.passages) || [];
  const ok = arr.filter(p => p && p.text && p.words >= 110 && p.words <= 190 && /^[A-Z\u201C"]/.test(String(p.text).trim()));
  if (!ok.length) return FALLBACK_PASSAGE;
  return String(ok[Math.floor(Math.random() * ok.length)].text).trim();
}

async function main() {
  const prov = process.env.GEMINI_API_KEY ? "gemini" : (process.env.GROQ_API_KEY ? "groq" : "pollinations");
  console.log("🧠 server_brain 시작 " + ts() + " | provider: " + prov + " | LLM 예산 " + BUDGET + "콜" + (GAS ? " | GAS 연동" : " | GAS 미설정"));
  if (process.env.GROQ_API_KEY) T.configure({ groqKey: process.env.GROQ_API_KEY });
  if (process.env.GEMINI_API_KEY) T.configure({ geminiKey: process.env.GEMINI_API_KEY });
  // 직접 키 소진(Groq 일일 토큰 429)돼도 학습이 멈추지 않도록 프록시 전체 폴백 체인 연결(서버측 호출은 Origin 없어 오리진잠금 통과)
  T.configure({ proxyUrl: process.env.RAY_PROXY || "https://ray-proxy.gen1103.workers.dev" });

  try { await T.loadTypeDB("knowledge/types_v2.json"); console.log("유형DB: knowledge/types_v2.json"); }
  catch (_) { try { await T.loadTypeDB("types.json"); console.log("유형DB: types.json(폴백)"); } catch (_) {} }
  try { await T.loadDifficultyDB("difficulty.json"); } catch (_) {}
  try { if (T.loadReviewDB) await T.loadReviewDB("knowledge/review_core_v2.json"); } catch (_) {}
  try { if (T.loadRaysKB) await T.loadRaysKB("knowledge/rays_drill_kb.json"); } catch (_) {}
  try { if (T.loadExaminerKB) { const kb = await T.loadExaminerKB("knowledge/examiner_kb_v1.json"); console.log("지식베이스:", JSON.stringify(kb)); } } catch (_) {}
  try { const ci = await T.loadCorpus("corpus/"); console.log("코퍼스:", JSON.stringify(ci)); } catch (_) {}

  const learnedFile = J("corpus/learned_rules.json", { updated: "", count: 0, rules: [] });
  T.applyLearned((learnedFile.rules || []).map(r => (r && r.rule) || r).filter(Boolean));

  const core = J("knowledge/exam_core_v1.json", { meeting_agenda_seeds: [] });
  const typesV2 = J("knowledge/types_v2.json", { types: [] });
  const act = (typesV2.types || []).filter(r => r.on);

  const newRules = [], projects = [], research = [], notices = [], samples = [], meetingsMd = [];

  /* ── Phase A 자가학습 ── */
  try {
    const subj = act.filter(r => r._cat === "서술형"), obj = act.filter(r => r._cat !== "서술형");
    const sh = a => a.slice().sort(() => Math.random() - 0.5);
    const picks = sh(obj).slice(0, 3).concat(sh(subj).slice(0, 1)); // 규칙: 서술형 최소 1
    const pg = pickPassage();
    for (const t of picks) {
      if (used >= BUDGET) { console.log("예산 도달 — Phase A 조기 종료"); break; }
      const r = await T.selfLearnStep(pg, t.type, { teachers: 3, target: 88 }).catch(() => null);
      if (r && r.learned) newRules.push({ rule: r.learned, src: "자가학습:" + t.type, score: r.score, ts: ts() });
      research.push({
        date: day(), category: "자가학습", topic: t.type,
        summary: r ? (r.fail ? "생성 실패(키가드 폐기 포함)" : "패널 점수 " + r.score + (r.learned ? " · 개선 규칙 1건 도출" : " · 기준 통과")) : "오류",
        rule: (r && r.learned) || ""
      });
      if (!r || !r.fail) {
        const q = await T.generateOne(pg, t.type, { fast: true }).catch(() => null); // 키가드 자동 적용
        if (q) {
          // 검수관(15절차 계승·발전): 예산 여유 시 정밀검수 → '사용 불가'는 폐기, 판정은 샘플에 부착
          let rv = null;
          if (T.reviewItem && used < BUDGET - 6) rv = await T.reviewItem(q, pg, {}).catch(() => null);
          if (rv && /불가/.test(String(rv.verdict || ""))) {
            research.push({ date: day(), category: "검수", topic: t.type, summary: "검수관 '사용 불가' → 샘플 폐기: " + (((rv.errors || [])[0] || {}).issue || rv.multi || ""), rule: "" });
          } else {
            // 측정 하네스: 능력계층 솔버로 변별도·난이도·오답효율 추정(예산 여유 시)
            let psy = null;
            if (PSY && PSY.panel && q.choices && q.choices.length >= 4 && used < BUDGET - 12) {
              psy = await PSY.panel(q, pg, T).catch(() => null); used += 3;
              if (psy && psy.ok) research.push({ date: day(), category: "측정검수", topic: t.type, summary: psy.summary, rule: "" });
            }
            samples.push({
              ts: ts(), type: t.type, level: q.level || "중", audit: q._audit || "",
              review: rv ? { verdict: rv.verdict, errors: (rv.errors || []).length, multi: rv.multi || "" } : null,
              psychometric: (psy && psy.ok) ? { P: psy.P, D: psy.D, distractorEff: psy.distractorEff, pass: psy.pass, flags: psy.flags } : null,
              q: { instruction: q.instruction, passage: q.passage, choices: q.choices, answer: q.answer, explanation: q.explanation }
            });
          }
        }
      }
    }
  } catch (e) { console.log("Phase A 오류:", e.message); }

  /* ── Phase A2 코퍼스 연구(원서 197권 기반 영어학 규칙 지속 도출) ── */
  const corpusNotes = [];
  try {
    if (used < BUDGET - 2) {
      const cols = (T.topCollocations ? T.topCollocations(20) : []).map(c => c.phrase);
      const gec = T.gecExamples ? T.gecExamples(3) : "";
      const cstat = T.corpusStat ? T.corpusStat() : {};
      const h2 = new Date().getUTCHours();
      const focus = ["연어(collocation)를 활용한 오답 설계", "실제 문법오류쌍(gec)을 활용한 어법 문항", "CEFR 밴드를 활용한 난이도 조정", "원서 문체 패턴을 활용한 변형"][h2 % 4];
      const seed = "연구 초점: " + focus + "\n원서 코퍼스 표본 — 최빈 연어: " + cols.slice(0, 12).join(", ") + "\n실제 문법오류쌍: " + gec;
      const cr = await T.llmJSON([
        { role: "system", content: "너는 코퍼스언어학·영어학 기반 출제 연구자다. 원서 코퍼스의 실제 패턴에서 '내신 변형문제 출제에 바로 쓸' 일반화 규칙 1개를 도출한다. JSON만." },
        { role: "user", content: seed + "\n\nJSON: {\"note\":\"이 코퍼스 패턴에서 배운 점(한국어 1~2문장)\",\"rule\":\"출제 시 항상 적용할 규칙 한 문장(한국어, 실행가능·구체적)\"}" }
      ], { noRule: true, temperature: 0.4 }).catch(() => null);
      used += 1;
      if (cr && cr.rule) {
        newRules.push({ rule: cr.rule, src: "코퍼스연구:" + focus, score: 72, ts: ts() });
        corpusNotes.push({ ts: ts(), focus: focus, note: cr.note || "", rule: cr.rule, sample: cols.slice(0, 6) });
        research.push({ date: day(), category: "코퍼스연구", topic: "원서 " + (cstat.books || 0) + "권 · " + focus, summary: cr.note || "", rule: cr.rule });
        console.log("코퍼스연구 규칙 도출:", cr.rule.slice(0, 60));
      }
    }
  } catch (e) { console.log("Phase A2 코퍼스연구 오류:", e.message); }

  /* ── Phase B 교사 회의(사용자 요청 + 연구 시드 회전) ── */
  try {
    let queue = [];
    if (GAS) {
      try {
        const r = await realFetch(GAS + (GAS.includes("?") ? "&" : "?") + "queue=1");
        const j = await r.json(); queue = (j.queue || []).slice(0, 3);
        console.log("사용자 요청 큐:", queue.length + "건");
      } catch (e) { console.log("GAS 큐 조회 실패:", e.message); }
    }
    const seeds = core.meeting_agenda_seeds || [];
    const h = new Date().getUTCHours();
    const seedTopics = seeds.length ? [seeds[(h * 2) % seeds.length], seeds[(h * 2 + 1) % seeds.length]] : [];
    const agenda = queue.map(q => ({ kind: "사용자요청", row: q.row, text: String(q.request || "").slice(0, 400) }))
      .concat(seedTopics.map(t => ({ kind: "자동연구", text: t }))).slice(0, 4);

    for (const a of agenda) {
      if (used >= BUDGET) { console.log("예산 도달 — Phase B 조기 종료"); break; }
      const v = await T.deliberate(a.text, { teachers: 4 }).catch(() => null);
      if (!v) continue;
      const id = ts().replace(/[:T]/g, "-").slice(0, 16) + "_" + slug(a.text);
      const md = [
        "# 교사 회의록 — " + a.text, "",
        "- 일시: " + ts(),
        "- 구분: " + a.kind,
        "- 판정: **" + v.verdict + "** (우선순위 " + (v.priority || "중") + ")",
        "- 사유: " + v.reason,
        "- 반영 방법: " + (v.how || "-"), "",
        "## 대화문",
        ...(v.dialogue || []).map(d => "- **" + d.speaker + "**: " + d.text)
      ].join("\n");
      meetingsMd.push({ file: "archive/meetings/" + id + ".md", md });
      notices.push({ date: ts(), official: true, kind: a.kind, topic: a.text, verdict: v.verdict, reason: v.reason, how: v.how || "", priority: v.priority || "중" });
      projects.push({ ts: ts(), title: a.text, kind: a.kind, status: "완료", verdict: v.verdict, teachers: v.teachers || 4 });
      research.push({ date: day(), category: a.kind === "사용자요청" ? "사용자 요청 심의" : "자동 연구 회의", topic: a.text, summary: v.reason, rule: /반영/.test(v.verdict) ? (v.how || "") : "" });
      if (/반영/.test(v.verdict) && v.how) newRules.push({ rule: v.how, src: "회의:" + a.kind, ts: ts() });
      var validVerdict = v && v.verdict && !/보류|실패/.test(String(v.verdict));
      if (a.kind === "사용자요청" && GAS && validVerdict) {
        try { await realFetch(GAS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "resolve", row: a.row, verdict: v.verdict, reason: v.reason }) }); }
        catch (_) {}
      }
    }
  } catch (e) { console.log("Phase B 오류:", e.message); }

  /* ── Phase C 영속화 ── */
  try {
    for (const m of meetingsMd) { const p = path.join(ROOT, m.file); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, m.md); }

    const prev = (learnedFile.rules || []).map(r => (typeof r === "string" ? { rule: r } : r));
    const merged = [...newRules, ...prev].filter((r, i, arr) => r && r.rule && arr.findIndex(x => x.rule === r.rule) === i).slice(0, 60);
    const lr = { updated: ts(), count: merged.length, rules: merged };
    W("corpus/learned_rules.json", lr);
    W("learned_rules.json", lr);

    // 코퍼스 연구 노트 누적(브라우저 관측 패널 로드용)
    const cres = J("corpus/corpus_research.json", { updated: "", count: 0, notes: [] });
    cres.notes = corpusNotes.concat(cres.notes || []).slice(0, 60);
    cres.count = cres.notes.length; cres.updated = ts();
    cres.note = "교사군집 코퍼스 연구 — 원서 197권 기반 규칙 지속 도출";
    W("corpus/corpus_research.json", cres);

    const ann = J("corpus/announcements.json", { notices: [] });
    ann.updated = ts(); ann.notices = [...notices, ...(ann.notices || [])].slice(0, 50);
    W("corpus/announcements.json", ann);

    const pj = J("corpus/teacher_projects.json", { projects: [] });
    pj.updated = ts(); pj.projects = [...projects, ...(pj.projects || [])].slice(0, 100); pj.count = pj.projects.length;
    W("corpus/teacher_projects.json", pj);

    const rl = J("research_log.json", { entries: [] });
    rl.updated = ts(); rl.entries = [...research, ...(rl.entries || [])].slice(0, 200);
    W("research_log.json", rl);

    const ss = J("corpus/self_samples.json", { samples: [] });
    ss.updated = ts(); ss.samples = [...samples, ...(ss.samples || [])].slice(0, 12);
    W("corpus/self_samples.json", ss);

    /* ── 시간별 보고서(핸드폰 열람용) ── */
    try {
      const cstat2 = T.corpusStat ? T.corpusStat() : {};
      const sample0 = samples[0];
      const report = {
        at: ts(), atKST: new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace("T", " ").slice(0, 16) + " KST",
        headline: "이번 시간: 유형 " + (new Set(research.filter(r => r.category === "자가학습").map(r => r.topic)).size) +
          "개 연습 · 신규 규칙 " + newRules.length + "개 · 검증샘플 " + samples.length + "개 · 회의 " + meetingsMd.length + "건",
        newRules: newRules.map(r => ({ rule: r.rule, src: r.src })),
        research: research.slice(0, 8).map(r => ({ cat: r.category, topic: r.topic, summary: String(r.summary || "").slice(0, 120) })),
        corpusResearch: corpusNotes.map(c => ({ focus: c.focus, rule: c.rule })),
        meetings: notices.slice(0, 4).map(n => ({ topic: n.topic, verdict: n.verdict, how: String(n.how || "").slice(0, 100) })),
        totals: { rules: merged.length, corpusBooks: cstat2.books || 0, colloc: cstat2.colloc || 0, samplesStored: ss.samples.length },
        sample: sample0 ? { type: sample0.type, instruction: (sample0.q || {}).instruction, answer: (sample0.q || {}).answer } : null
      };
      const rh = J("corpus/hourly_report.json", { history: [] });
      rh.latest = report; rh.updated = ts(); rh.history = [{ at: report.at, headline: report.headline }].concat(rh.history || []).slice(0, 168);   // 최근 7일
      W("corpus/hourly_report.json", rh);
      // GAS(사용자 채널)로 푸시 — 설정 시 핸드폰 알림
      if (GAS) { try { await realFetch(GAS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "report", report: report }) }); console.log("보고서 GAS 푸시 완료"); } catch (_) {} }
      console.log("📱 시간별 보고서 생성: " + report.headline);
    } catch (e) { console.log("보고서 생성 오류:", e.message); }

    if (newRules.length) {
      const add = "\n## " + ts() + " 자동 반영 규칙\n" + newRules.map(r => "- " + r.rule + "  _(출처: " + r.src + ")_").join("\n") + "\n";
      fs.appendFileSync(path.join(ROOT, "USABLE_RULES.md"), add);
    }
  } catch (e) { console.log("Phase C 오류:", e.message); }

  const gs = T.keyGuardStats ? T.keyGuardStats() : {};
  console.log("✅ 완료 — LLM " + used + "/" + BUDGET + "콜(예산차단 " + blocked + ") | 신규규칙 " + newRules.length +
    " | 회의록 " + meetingsMd.length + " | 공지 " + notices.length + " | 검증샘플 " + samples.length +
    " | 키가드 " + JSON.stringify(gs));
}

if (require.main === module) {
  main().catch(e => { console.error("치명 오류:", e && e.message); process.exit(0); /* 워크플로 실패 전파 방지 */ });
}
module.exports = { main };
