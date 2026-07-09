/* addon_key_guard.js — 정답키 3중 가드 (0원 · 코드 우선, LLM은 다수결 판정에만)
 * 사용: ai_maker.html에서 </body> 직전에 <script src="addon_key_guard.js"></script> 한 줄 추가.
 *       서버(Node)에서는 require 후 guardItem/installKeyGuard 사용.
 * 게이트: ① 코드 결정론 검증(어휘 변조위치 재계산, 어법 오류어 실존·위치 검증)
 *         ② 블라인드 솔버 3표 다수결(텍스트 MCQ의 정답키 교차확인)
 *         ③ 위생 필터(플레이스홀더 선지, 무효 정답번호)
 * 부수: 출제 실행 중 실시간 회의·자가학습 루프 자동 일시정지(직렬 큐 잠식 차단). */
(function (root) {
  "use strict";
  var STATS = { checked: 0, codeFixed: 0, solverFixed: 0, flagged: 0, dropped: 0 };

  function stripU(s) { return String(s || "").replace(/<[^>]+>/g, " "); }
  function marks(passage) {
    return (String(passage || "").match(/<u>([^<]+)<\/u>/g) || [])
      .map(function (m) { return m.replace(/<\/?u>/g, "").trim(); });
  }
  function norm(w) { return String(w || "").toLowerCase().replace(/[^a-z]/g, ""); }
  function inOriginal(word, original) {
    var pl = " " + String(original || "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ") + " ";
    return pl.indexOf(" " + norm(word) + " ") >= 0;
  }
  function isLabelMCQ(q) { return q && q.choices && q.choices.length >= 4 && q.choices.every(function (c) { return String(c).trim().length <= 3; }); }

  /* ── 게이트① 코드 결정론 검증 ── */
  function codeGate(q, original) {
    if (!isLabelMCQ(q)) return null;
    var ms = marks(q.passage);
    if (ms.length < q.choices.length) return { drop: "밑줄 개수(" + ms.length + ") 부족" };
    if (/어휘/.test(q.type)) {
      var altered = []; ms.forEach(function (w, i) { if (!inOriginal(w, original)) altered.push(i + 1); });
      if (altered.length !== 1) return { drop: "어휘 변조 " + altered.length + "곳(정확히 1곳 필요)" };
      if (altered[0] !== q.answer) return { fix: altered[0], why: "변조 실측 위치 ⓐⓑⓒⓓⓔ[" + altered[0] + "] ≠ 기록 정답 " + q.answer };
      return { ok: "어휘 위치검증 통과" };
    }
    if (/어법/.test(q.type)) {
      var m = /'([^']{1,40})'[는은이가]? /.exec(String(q.explanation || "")) || /'([^']{1,40})'/.exec(String(q.explanation || ""));
      var err = m && m[1];
      if (!err) return { flag: "해설에서 오류어 추출 실패(수동 확인)" };
      if (stripU(q.passage).indexOf(err) < 0) return { drop: "유령 오류 — '" + err + "'가 지문에 없음" };
      var at = -1; ms.forEach(function (w, i) { if (at < 0 && w.indexOf(err) >= 0) at = i + 1; });
      if (at < 0) return { drop: "오류어가 밑줄 외부에 존재('" + err + "')" };
      if (at !== q.answer) return { fix: at, why: "오류어 실존 위치 [" + at + "] ≠ 기록 정답 " + q.answer };
      return { ok: "어법 오류어 실존·위치 검증 통과" };
    }
    return null;
  }

  /* ── 게이트② 블라인드 솔버 3표 다수결 ── */
  async function solverGate(q, original, T) {
    if (!q || !q.choices || q.choices.length < 4 || isLabelMCQ(q)) return null;
    var pg = String(q.passage || original || "").slice(0, 1400);
    var CIRC = ["①", "②", "③", "④", "⑤"];
    var user = q.instruction + "\n\n[지문]\n" + pg + "\n\n" + q.choices.map(function (c, i) { return CIRC[i] + " " + c; }).join("\n") + "\n\n정답 번호만 출력.";
    var sys = "너는 한국 고등학교 영어 시험 응시자다. 지문과 선지를 근거로 정답의 '번호만'(1~5) 출력한다. 설명 금지.";
    // 속도 최적화: 2표 '병렬' 선실행 → 2표 일치 & 기록정답과 동일하면 즉시 통과(3번째 생략). 아니면 타이브레이크 1표만 추가.
    function vote(temp) { return T.llm([{ role: "system", content: sys }, { role: "user", content: user }], { noRule: true, temperature: temp, timeout: 45000 }).then(function (r) { return +((String(r).match(/[1-5]/) || [])[0] || 0); }).catch(function () { return 0; }); }
    var votes = (await Promise.all([vote(0.2), vote(0.7)])).filter(Boolean);
    if (!(votes.length === 2 && votes[0] === votes[1] && votes[0] === q.answer)) { var t3 = await vote(0.9); if (t3) votes.push(t3); }
    if (!votes.length) return { flag: "솔버 응답 없음(판정 보류)" };
    var tally = {}; votes.forEach(function (v) { tally[v] = (tally[v] || 0) + 1; });
    var maj = +Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; })[0], cnt = tally[maj];
    var keyBad = !(q.answer >= 1 && q.answer <= q.choices.length);
    if (keyBad && cnt >= 2) return { fix: maj, why: "무효 정답키 → 솔버 " + cnt + "/" + votes.length + " 다수결 " + maj + "번 적용" };
    // 다수(2/3 이상)가 기록정답과 다르면 교정 — 극성반전·오답키 방어(과거 3/3만 교정해 2/3 오류가 통과하던 결함 수정)
    if (maj !== q.answer && cnt >= 2) return { fix: maj, why: "솔버 " + cnt + "/" + votes.length + " 다수결 " + maj + "번(기록 " + q.answer + "번 교정)" };
    if (maj !== q.answer) return { flag: "정답 재검토 권고 — 솔버 " + cnt + "/" + votes.length + "가 " + maj + "번 선택(기록 " + q.answer + "번 유지)" };
    return { ok: "솔버 " + cnt + "/" + votes.length + " 일치" };
  }

  /* ── 게이트③ 위생 필터 ── */
  function hygiene(q) {
    if (q.choices && q.choices.some(function (c) { return /\(보기/.test(String(c)); })) return { drop: "플레이스홀더 선지 노출" };
    if (q.choices && q.choices.length >= 4 && !(q.answer >= 1 && q.answer <= q.choices.length)) return { flag: "정답번호 무효(솔버 게이트로 이관)" };
    return null;
  }

  function annotate(q, tag) { q._audit = ((q._audit ? q._audit + " · " : "") + tag).slice(0, 220); }

  async function guardItem(q, original, T, onP) {
    if (!q) return { item: null, status: "empty" };
    STATS.checked++;
    var log = function (m) { try { if (onP) onP("  🛡 키가드: " + m); } catch (_) {} };
    var h = hygiene(q);
    if (h && h.drop) { STATS.dropped++; log("[" + q.type + "] 폐기 — " + h.drop); return { item: null, status: "dropped", why: h.drop }; }
    var g = codeGate(q, original);
    if (g) {
      if (g.drop) { STATS.dropped++; log("[" + q.type + "] 폐기 — " + g.drop); return { item: null, status: "dropped", why: g.drop }; }
      if (g.fix) { q.answer = g.fix; STATS.codeFixed++; annotate(q, "코드교정: " + g.why); log("[" + q.type + "] " + g.why + " → 교정"); }
      else if (g.flag) { STATS.flagged++; annotate(q, "⚠ " + g.flag); log("[" + q.type + "] " + g.flag); }
      else annotate(q, g.ok);
      return { item: q, status: "ok" };
    }
    var s = await solverGate(q, original, T);
    if (s) {
      if (s.fix) { q.answer = s.fix; STATS.solverFixed++; annotate(q, "솔버교정: " + s.why); log("[" + q.type + "] " + s.why); }
      else if (s.flag) { STATS.flagged++; annotate(q, "⚠ " + s.flag); log("[" + q.type + "] " + s.flag); }
      else annotate(q, s.ok);
    }
    return { item: q, status: "ok" };
  }

  /* ── 설치: generateExam / generateOne 래핑 + 회의 루프 일시정지 ── */
  function installKeyGuard(T, win) {
    if (!T || T.__keyguard) return T;
    var oGX = T.generateExam, oG1 = T.generateOne;
    function pauseLoops() {
      var resume = [];
      try {
        var L = win && win.LIVE, E = win && win.LEARN;
        if (L && L.on) { L.on = false; resume.push(function () { L.on = true; if (typeof win.liveLoop === "function") setTimeout(win.liveLoop, 2000); }); }
        if (E && E.on) { E.on = false; resume.push(function () { E.on = true; if (typeof win.learnLoop === "function") setTimeout(win.learnLoop, 2500); }); }
        if (resume.length && win && typeof win.liveLine === "function") win.liveLine('<div style="color:#8ac">⏸ 출제 우선 — 회의·자가학습 일시정지(완료 후 재개)</div>');
      } catch (_) {}
      return function () { resume.forEach(function (f) { try { f(); } catch (_) {} }); };
    }
    T.generateExam = async function (passage, types, opts) {
      opts = opts || {}; var resume = pauseLoops();
      try {
        var items = await oGX.call(T, passage, types, opts), out = [];
        for (var i = 0; i < (items || []).length; i++) {
          var r = await guardItem(items[i], passage, T, opts.onProgress);
          if (r.item) out.push(r.item);
        }
        try { if (opts.onProgress) opts.onProgress("🛡 키가드 요약 — 점검 " + STATS.checked + " · 코드교정 " + STATS.codeFixed + " · 솔버교정 " + STATS.solverFixed + " · 플래그 " + STATS.flagged + " · 폐기 " + STATS.dropped); } catch (_) {}
        return out;
      } finally { resume(); }
    };
    T.generateOne = async function (passage, type, opts) {
      opts = opts || {}; var resume = pauseLoops();
      try {
        var q = await oG1.call(T, passage, type, opts);
        var r = await guardItem(q, passage, T, opts.onProgress);
        return r.item;
      } finally { resume(); }
    };
    T.keyGuardStats = function () { return Object.assign({}, STATS); };
    T.__keyguard = "v1";
    return T;
  }

  var api = { installKeyGuard: installKeyGuard, guardItem: guardItem, stats: function () { return Object.assign({}, STATS); } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.APITEAM) { installKeyGuard(root.APITEAM, root); root.KEYGUARD = api; }
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));
