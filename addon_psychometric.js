/* ===========================================================================
   Ray English 측정 하네스 — 실제 응시자 없이 문항 퀄을 계량(신뢰도·타당도·변별도)
   근거: knowledge/measurement_logic.md (Bachman&Palmer·Messick·고전검사이론).
   원리: 신경다발(MoA) 솔버를 능력계층(상/중/하) 응시자 대리로 써서
        난이도 P̂, 변별도 D̂, 오답효율(5% 규칙), 구인타당도(지문제거 누출)를 추정·게이트.
   비용: 문항당 다수 LLM콜 → 라이브 상시가 아닌 '정밀검수/뇌 감사'용. 브라우저=window.PSYCHOMETRIC, Node=require.
   =========================================================================== */
(function (root) {
  var CIRC = ["①", "②", "③", "④", "⑤"];
  function isMCQ(q) { return q && q.choices && q.choices.length >= 4 && q.answer >= 1 && q.answer <= q.choices.length; }
  // 능력계층 솔버 — 상위군은 정밀 독해, 하위군은 표면단서·서두름(현실 응시자 근사)
  var TIERS = [
    { name: "상", n: 3, sys: "너는 최상위권 고등학생이다. 지문을 끝까지 정밀히 읽고 논리·근거로 정답을 고른다. 번호(1~5)만 출력." },
    { name: "중", n: 3, sys: "너는 평범한 중위권 고등학생이다. 지문을 한 번 읽고 가장 그럴듯한 답을 고른다. 번호만 출력." },
    { name: "하", n: 3, sys: "너는 하위권 학생이다. 지문을 대충 훑고 익숙한 단어·긴 선지 같은 표면 단서로 서둘러 고른다. 번호만 출력." }
  ];
  function vote(T, sys, user, temp) {
    return T.llm([{ role: "system", content: sys }, { role: "user", content: user }], { noRule: true, temperature: temp, timeout: 40000 })
      .then(function (r) { return +((String(r).match(/[1-5]/) || [])[0] || 0); }).catch(function () { return 0; });
  }
  function rate(arr, ans) { return arr.length ? arr.filter(function (v) { return v === ans; }).length / arr.length : 0; }

  // 문항 측정: P̂·D̂·오답효율. 반환 {ok,pass,P,D,distractorEff,dead,flags,summary}
  async function panel(q, passage, T, opts) {
    opts = opts || {};
    if (!isMCQ(q)) return { ok: false, why: "객관식 아님(측정 생략)" };
    var pg = String(q.passage || passage || "").slice(0, 1600);
    var body = "\n\n[지문]\n" + pg + "\n\n" + q.choices.map(function (c, i) { return CIRC[i] + " " + c; }).join("\n") + "\n\n정답 번호(1~5)만.";
    var user = q.instruction + body;
    var picks = { 상: [], 중: [], 하: [] };
    await Promise.all(TIERS.map(async function (t) {
      var vs = await Promise.all(Array.from({ length: t.n }, function (_, k) { return vote(T, t.sys, user, 0.25 + k * 0.3); }));
      picks[t.name] = vs.filter(Boolean);
    }));
    var all = [].concat(picks.상, picks.중, picks.하);
    if (all.length < 4) return { ok: false, why: "솔버 응답 부족" };
    var P = rate(all, q.answer), Ptop = rate(picks.상, q.answer), Plow = rate(picks.하, q.answer), Pmid = rate(picks.중, q.answer);
    var D = Ptop - Plow;   // 변별도: 상위군 − 하위군 정답률(Ebel: ≥0.4 우수, 0.3~ 양호, 0.2~ 한계)
    // 오답효율(5% 규칙): 각 오답을 5%↑ 고르면 기능오답. 하위군이 더 고르면 정상 오답.
    var dead = [], funcN = 0;
    for (var i = 1; i <= q.choices.length; i++) {
      if (i === q.answer) continue;
      var chose = all.filter(function (v) { return v === i; }).length / all.length;
      if (chose >= 0.05) funcN++; else dead.push(CIRC[i - 1]);
    }
    var totalDis = q.choices.length - 1;
    var flags = [];
    if (P < 0.30) flags.push("과다어려움(P̂=" + P.toFixed(2) + ")");
    if (P > 0.85) flags.push("과다쉬움(P̂=" + P.toFixed(2) + ")");
    if (D < 0.20) flags.push("변별도 낮음(D̂=" + D.toFixed(2) + ")");
    if (D < 0) flags.push("역변별(정답키 의심)");
    if (dead.length) flags.push("죽은오답 " + dead.join(""));
    // 게이트: 난이도 대역 + 변별 + 기능오답 다수 + 역변별 아님
    var pass = P >= 0.25 && P <= 0.88 && D >= 0.15 && funcN >= Math.max(2, totalDis - 1);
    return {
      ok: true, pass: pass, P: +P.toFixed(2), Pmid: +Pmid.toFixed(2), D: +D.toFixed(2),
      distractorEff: Math.round(funcN / totalDis * 100), dead: dead, flags: flags,
      summary: "측정 P̂=" + P.toFixed(2) + " D̂=" + D.toFixed(2) + " 오답효율" + Math.round(funcN / totalDis * 100) + "% " + (pass ? "✅합격" : "⚠" + flags.join(","))
    };
  }

  // 구인타당도 — 지문제거 누출테스트: 지문 없이 발문+선지만으로 풀리면(≥35%) 구인무관(트릭풀이)
  async function leakTest(q, T) {
    if (!isMCQ(q)) return { ok: false };
    var user = q.instruction + "\n\n" + q.choices.map(function (c, i) { return CIRC[i] + " " + c; }).join("\n") + "\n\n(지문 없음) 상식·선지 단서만으로 정답 추정. 번호만.";
    var vs = (await Promise.all([0.2, 0.5, 0.8].map(function (t) { return vote(T, "너는 영어 시험 응시자다. 번호만 출력.", user, t); }))).filter(Boolean);
    var leak = rate(vs, q.answer);
    return { ok: true, leak: +leak.toFixed(2), pass: leak <= 0.5, summary: "누출 " + Math.round(leak * 100) + "%" + (leak > 0.5 ? " ⚠지문없이 풀림(구인무관)" : " ✅") };
  }

  // 형태단서(form cue) 감사 — 정답이 길이/형태로 새는지 계량(Haladyna). LLM 불필요·결정론.
  function formCue(q) {
    if (!isMCQ(q)) return { ok: false, why: "객관식 아님" };
    var ch = q.choices;
    if (ch.every(function (c) { return /^[ⓐ-ⓔ①-⑤]\s*$/.test(String(c)); })) return { ok: true, cue: false, summary: "위치표식형(길이 무관)" };
    var L = ch.map(function (c) { return String(c).replace(/\s+/g, " ").trim().length; });
    var a = L[q.answer - 1], sorted = L.slice().sort(function (x, y) { return y - x; }), rank = sorted.indexOf(a) + 1;
    var mean = L.reduce(function (s, x) { return s + x; }, 0) / L.length;
    var sd = Math.sqrt(L.reduce(function (s, x) { return s + (x - mean) * (x - mean); }, 0) / L.length), cv = mean ? sd / mean : 0;
    var oth = L.filter(function (_, i) { return i !== q.answer - 1; }), maxO = Math.max.apply(null, oth);
    var cue = a >= maxO && a > maxO * 1.3 && (a - maxO) >= 6;   // 정답 최장 + 2등比 30%↑ = 형태단서
    return { ok: true, cue: cue, answerRank: rank, cv: +cv.toFixed(2), answerLen: a, lens: L,
      summary: "길이CV=" + cv.toFixed(2) + " 정답길이순위=" + rank + "/" + L.length + (cue ? " ⚠정답이 최장(형태단서 누설)" : " ✅형태단서 없음") };
  }
  var api = { panel: panel, leakTest: leakTest, formCue: formCue };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.PSYCHOMETRIC = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
