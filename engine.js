/* 변형문제 생성 엔진 (브라우저/Node 공용).
   오프라인: 내장 데이터(data.js K). 온라인: 무료 API(Datamuse·dictionaryapi.dev)로 보강.
   문제 데이터는 결정론적으로 생성된다. */
(function (global) {
  "use strict";
  var K = (typeof require !== "undefined") ? require("./data.js") : global.K;

  var CIRC = ["", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
  function circ(n) { return CIRC[n] || ("(" + n + ")"); }

  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h >>> 0; }
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffleDet(arr, seed) { var a = arr.slice(), r = mulberry32(seed >>> 0); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function randInt(seed, n) { return Math.floor(mulberry32(seed >>> 0)() * n); }

  var STOP = {};
  ("the a an and or but if then than that this these those such with without within into onto from for of to in on at by as is are was were be been being do does did doing done have has had having can could may might must should would will shall not no nor so because although though while when whenever where wherever who whom whose which what why how all any some more most much many few less least very just also only even still each other another same it its they them their theirs we us our ours you your yours he him his she her hers i me my mine today well yes during after before early later final first second third back down up out over under through about among between according there here then once upon").split(" ").forEach(function (w) { STOP[w] = 1; });

  var ADJ_HINT = /(ive|ous|ful|less|able|ible|al|ic|ary|ent|ant)$/, NOUN_HINT = /(tion|sion|ment|ness|ity|ism|ist|ence|ance|ship|work|ledge)$/, VERB_HINT = /(ize|ise|ate|fy|ing|ed)$/;
  function posOf(w) {
    w = w.toLowerCase();
    if (w.slice(-2) === "ly") return "adv";
    if (NOUN_HINT.test(w)) return "noun";
    if (ADJ_HINT.test(w)) return "adj";
    if (VERB_HINT.test(w)) return "verb";
    return "noun";
  }
  function lemma(w) {
    var x = w.toLowerCase().replace(/'s$/, "");
    if (x.length > 6 && /ies$/.test(x)) return x.slice(0, -3) + "y";
    if (x.length > 6 && /ing$/.test(x)) return x.slice(0, -3);
    if (x.length > 5 && /ed$/.test(x)) return x.slice(0, -2);
    if (x.length > 4 && /s$/.test(x)) return x.slice(0, -1);
    return x;
  }
  function toIng(w) { var l = w.toLowerCase(); if (/ie$/.test(l)) return w.slice(0, -2) + "ying"; if (/e$/.test(l) && !/ee$/.test(l)) return w.slice(0, -1) + "ing"; return w + "ing"; }

  function clean(t) { return String(t || "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim(); }
  var ABBR = { Dr: 1, Mr: 1, Mrs: 1, Ms: 1, Prof: 1, St: 1, vs: 1, etc: 1, Inc: 1, Ltd: 1, No: 1, Mt: 1, Jr: 1, Sr: 1 };
  function segment(text) {
    var ranges = [], start = 0, i = 0, n = text.length;
    while (i < n) {
      var c = text[i];
      if (c === "." || c === "?" || c === "!") {
        var before = text.slice(Math.max(0, i - 12), i).match(/([A-Za-z]+)$/);
        if (c === "." && before && ABBR[before[1]]) { i++; continue; }
        var j = i + 1; while (j < n && '"\')]'.indexOf(text[j]) >= 0) j++;
        var k = j; while (k < n && text[k] === " ") k++;
        if (k < n && !/[A-Z0-9"'(]/.test(text[k])) { i++; continue; }
        var seg = text.slice(start, j).trim();
        if (seg) ranges.push({ start: start, end: j, text: seg });
        start = k; i = k; continue;
      }
      i++;
    }
    var rest = text.slice(start).trim();
    if (rest) ranges.push({ start: start, end: n, text: rest });
    return ranges;
  }
  var TOKEN_RE = /[A-Za-z]+(?:['-][A-Za-z]+)*|\d+(?:\.\d+)?|[^\sA-Za-z0-9]/g;
  function tokenize(text) {
    var tokens = [], last = 0, m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(text))) {
      tokens.push({ surface: m[0], start: m.index, end: m.index + m[0].length, gap: text.slice(last, m.index), word: /^[A-Za-z0-9]/.test(m[0]), sent: 0 });
      last = m.index + m[0].length;
    }
    return tokens;
  }

  function Doc(id, raw) {
    this.id = id; this.text = clean(raw);
    this.sents = segment(this.text); this.tokens = tokenize(this.text); this.freq = {};
    var self = this;
    this.tokens.forEach(function (t) {
      var mid = (t.start + t.end) / 2, si = -1;
      for (var i = 0; i < self.sents.length; i++) if (self.sents[i].start <= mid && mid <= self.sents[i].end) { si = i; break; }
      t.sent = si < 0 ? Math.max(0, self.sents.length - 1) : si;
    });
    this.tokens.forEach(function (t) { if (self.content(t)) { var l = lemma(t.surface); self.freq[l] = (self.freq[l] || 0) + 1; } });
  }
  Doc.prototype.content = function (t) {
    if (!t.word || !/^[A-Za-z]/.test(t.surface)) return false;
    var low = t.surface.toLowerCase(), lm = lemma(low);
    if (STOP[low] || STOP[lm]) return false;
    if (low.length < 4 || /[-']/.test(low)) return false;
    if (/^[A-Z]/.test(t.surface) && t.start > 0) return false;
    return true;
  };
  Doc.prototype.contentTokens = function (pos, minlen) {
    var out = [], self = this;
    this.tokens.forEach(function (t, ti) {
      if (!self.content(t)) return;
      var p = posOf(t.surface);
      if (pos && p !== pos) return;
      if (minlen && t.surface.length < minlen) return;
      out.push({ ti: ti, surface: t.surface, pos: p, lemma: lemma(t.surface), sent: t.sent, len: t.surface.length, freq: self.freq[lemma(t.surface)] || 1 });
    });
    return out;
  };
  Doc.prototype.render = function (repl) {
    var out = "";
    this.tokens.forEach(function (t, ti) { out += t.gap || ""; out += repl.hasOwnProperty(ti) ? repl[ti] : t.surface; });
    return out.replace(/[ \t]+/g, " ").trim();
  };
  Doc.prototype.wc = function (si) { var s = this.sents[si], n = 0; this.tokens.forEach(function (t) { if (t.word && s.start <= t.start && t.start < s.end) n++; }); return n; };

  // ---- API 보강 캐시 (브라우저 온라인에서 채워짐) ----
  var ENRICH = { ant: {}, syn: {}, examples: {} };
  function setEnrich(e) { ENRICH = e || ENRICH; }

  var FALLBACK = K.WORD_POS_BANK || { noun: [], verb: [], adj: [], adv: [] };
  var GLOBAL_POS = { noun: [], verb: [], adj: [], adv: [] }, ALL_DOCS = [];
  function buildGlobal(docs) {
    ALL_DOCS = docs; GLOBAL_POS = { noun: [], verb: [], adj: [], adv: [] };
    docs.forEach(function (d) { d.contentTokens().forEach(function (c) { (GLOBAL_POS[c.pos] = GLOBAL_POS[c.pos] || []).push(c.surface.toLowerCase()); }); });
  }
  function distractors(answer, doc, count, seed, pos) {
    var ans = answer.toLowerCase(), p = pos || posOf(answer);
    var pool = [];
    if (ENRICH.ant[ans]) pool = pool.concat(ENRICH.ant[ans]);   // API 반의어 우선
    if (ENRICH.syn[ans]) pool = pool.concat(ENRICH.syn[ans]);
    pool = pool.concat(doc.contentTokens(p).map(function (c) { return c.surface.toLowerCase(); }))
               .concat(GLOBAL_POS[p] || []).concat(FALLBACK[p] || []);
    var seen = {}, cand = [];
    pool.forEach(function (w) { if (!w || w === ans || lemma(w) === lemma(ans) || w.length < 4 || seen[w]) return; seen[w] = 1; cand.push(w); });
    var near = cand.filter(function (w) { return Math.abs(w.length - answer.length) <= 3; });
    var base = near.length >= count ? near : cand.sort(function (a, b) { return Math.abs(a.length - answer.length) - Math.abs(b.length - answer.length); });
    return shuffleDet(base.slice(0, Math.max(20, count * 8)), seed).slice(0, count);
  }

  function keywords(doc, n) {
    var freq = {}, rep = {};
    doc.contentTokens(null, 4).forEach(function (c) { freq[c.lemma] = (freq[c.lemma] || 0) + 1; if (!rep[c.lemma]) rep[c.lemma] = c.surface.toLowerCase(); });
    return Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; }).slice(0, n).map(function (l) { return rep[l]; });
  }
  function pickTokens(doc, seed, count, minlen, spread) {
    var cands = doc.contentTokens(null, minlen || 4);
    var uniq = cands.filter(function (c) { return c.freq <= 1; });
    if (uniq.length >= count) cands = uniq;
    cands.sort(function (a, b) { return (b.len + b.freq * 1.5) - (a.len + a.freq * 1.5); });
    cands = shuffleDet(cands.slice(0, Math.max(40, count * 7)), seed);
    var picked = [], usedL = {}, usedS = {};
    cands.forEach(function (c) { if (picked.length >= count) return; if (usedL[c.lemma]) return; if (spread && usedS[c.sent]) return; picked.push(c); usedL[c.lemma] = 1; usedS[c.sent] = 1; });
    cands.forEach(function (c) { if (picked.length >= count) return; if (usedL[c.lemma]) return; picked.push(c); usedL[c.lemma] = 1; });
    return picked.sort(function (a, b) { return a.ti - b.ti; });
  }
  function getWindow(doc, seed, size) {
    var n = doc.sents.length; if (n < size) return null;
    var starts = []; for (var i = 0; i <= n - size; i++) starts.push(i);
    var rich = starts.filter(function (i) { for (var k = 0; k < size; k++) { if (doc.wc(i + k) < 6) return false; if (/^\s*(Host|Dr)\b/.test(doc.sents[i + k].text)) return false; } return true; });
    var s = shuffleDet(rich.length ? rich : starts, seed)[0];
    var w = []; for (var k = 0; k < size; k++) w.push({ si: s + k, text: doc.sents[s + k].text }); return w;
  }
  function hasCue(text) {
    var t = text.trim().toLowerCase(), fw = (t.match(/[a-z]+/g) || []).slice(0, 2);
    if (fw[0] && K.CUE1.indexOf(fw[0]) >= 0) return true;
    var two = fw.join(" ");
    return K.CUE2.some(function (c) { return two.indexOf(c) === 0; });
  }
  function getWindowCued(doc, seed, size) {
    var n = doc.sents.length; if (n < size) return null;
    var starts = []; for (var i = 0; i <= n - size; i++) starts.push(i);
    var ok = starts.filter(function (i) { for (var k = 0; k < size; k++) { if (doc.wc(i + k) < 6) return false; if (/^\s*(Host|Dr)\b/.test(doc.sents[i + k].text)) return false; } return true; });
    if (!ok.length) ok = starts;
    var scored = ok.map(function (i) { var c = 0; for (var k = 1; k < size; k++) if (hasCue(doc.sents[i + k].text)) c++; return { c: c, i: i }; });
    var best = scored.filter(function (x) { return x.c >= 2; }).map(function (x) { return x.i; });
    if (!best.length) best = scored.filter(function (x) { return x.c >= 1; }).map(function (x) { return x.i; });
    if (!best.length) best = ok;
    var s = shuffleDet(best, seed)[0];
    var w = []; for (var k = 0; k < size; k++) w.push({ si: s + k, text: doc.sents[s + k].text }); return w;
  }
  function markWord(text, word) {
    var re = new RegExp("\\b" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"), m = text.match(re);
    if (!m) return [text, false];
    var i = m.index; return [text.slice(0, i) + "<<" + m[0] + ">>" + text.slice(i + m[0].length), true];
  }
  function mark(text, span) { var i = text.indexOf(span); if (i < 0) return text; return text.slice(0, i) + "<<" + span + ">>" + text.slice(i + span.length); }

  // ================= 생성기 =================
  function grammarSites(doc) {
    var toks = doc.tokens, sites = [], i;
    for (i = 0; i < toks.length; i++) {
      var t = toks[i]; if (!t.word) continue;
      var low = t.surface.toLowerCase(), nx = toks[i + 1];
      if (["is", "was", "has", "does"].indexOf(low) >= 0) sites.push({ ti: i, bad: { is: "are", was: "were", has: "have", does: "do" }[low], note: "수일치" });
      else if (["are", "were", "have", "do"].indexOf(low) >= 0) sites.push({ ti: i, bad: { are: "is", were: "was", have: "has", do: "does" }[low], note: "수일치" });
      else if (low === "to" && nx && /^[a-z]+$/.test(nx.surface) && !STOP[nx.surface.toLowerCase()] && posOf(nx.surface) === "verb" && !/(ed|ing|s)$/.test(nx.surface)) sites.push({ ti: i + 1, bad: toIng(nx.surface), note: "to부정사" });
      else if (["who", "which", "that"].indexOf(low) >= 0 && i > 0) {
        var prev = toks[i - 1].surface.toLowerCase();
        if (low === "who") sites.push({ ti: i, bad: "which", note: "관계대명사" });
        else if (low === "which" && K.PERSON_NOUNS.indexOf(prev) >= 0) sites.push({ ti: i, bad: "who", note: "관계대명사" });
      }
      else if (["can", "could", "should", "would", "will", "may", "might", "must"].indexOf(low) >= 0 && nx && /^[a-z]+$/.test(nx.surface) && !/ly$/.test(nx.surface) && posOf(nx.surface) === "verb") sites.push({ ti: i + 1, bad: "to " + nx.surface, note: "조동사+동사원형" });
      else if (K.GERUND_VERBS.indexOf(low) >= 0 && nx && /ing$/.test(nx.surface.toLowerCase()) && nx.surface.length > 4) sites.push({ ti: i + 1, bad: "to " + nx.surface, note: "동명사" });
    }
    var pp2base = {}; Object.keys(K.IRREGULAR_PP).forEach(function (b) { pp2base[K.IRREGULAR_PP[b]] = b; });
    for (i = 0; i < toks.length - 1; i++) {
      if (["is", "are", "was", "were", "be", "been"].indexOf(toks[i].surface.toLowerCase()) >= 0 && toks[i + 1].word) {
        var base = pp2base[toks[i + 1].surface.toLowerCase()];
        if (base && !sites.some(function (s) { return s.ti === i + 1; })) sites.push({ ti: i + 1, bad: base, note: "태(수동)" });
      }
    }
    return sites;
  }
  function gen_grammar(doc, seed) {
    var sites = grammarSites(doc);
    if (sites.length >= 5) {
      var pool = shuffleDet(sites, seed), chosen = [], seen = {};
      pool.forEach(function (s) { if (chosen.length < 5 && !seen[s.note]) { chosen.push(s); seen[s.note] = 1; } });
      pool.forEach(function (s) { if (chosen.length < 5 && chosen.indexOf(s) < 0) chosen.push(s); });
      chosen.sort(function (a, b) { return a.ti - b.ti; });
      var wrong = randInt(seed ^ 0x9a, 5), repl = {};
      chosen.forEach(function (s, k) { var surf = doc.tokens[s.ti].surface; repl[s.ti] = circ(k + 1) + " <<" + (k === wrong ? s.bad : surf) + ">>"; });
      var w = chosen[wrong], areas = chosen.map(function (s, k) { return circ(k + 1) + s.note; }).join(", ");
      return { type: "어법 추론", fidelity: "A", instruction: "밑줄 친 부분 중, 어법상 틀린 것을 고르시오.", problem: [doc.render(repl)], answer: circ(wrong + 1) + " " + w.bad + " → " + doc.tokens[w.ti].surface + " (" + w.note + ")", explain: w.note + " 오류. [밑줄 영역] " + areas };
    }
    if (sites.length) {
      var s = shuffleDet(sites, seed)[0], surf = doc.tokens[s.ti].surface, sent = doc.sents[doc.tokens[s.ti].sent].text;
      var wrongSent = sent.replace(new RegExp("\\b" + surf.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b"), "<<" + s.bad + ">>");
      return { type: "어법 추론", fidelity: "A", instruction: "다음 문장에서 밑줄 친 부분이 어법상 틀렸다. 어법에 맞게 고쳐 쓰시오.", problem: [wrongSent, "고친 표현: ____________________"], answer: s.bad + " → " + surf + " (" + s.note + ")", explain: s.note + " 오류." };
    }
    return null;
  }
  function gen_vocab(doc, seed) {
    var toks = pickTokens(doc, seed, 5, 5, true); if (toks.length < 5) return null;
    var ANT = {}; Object.keys(K.ANTONYMS).forEach(function (k) { ANT[k] = K.ANTONYMS[k]; }); Object.keys(K.CONFUSABLES).forEach(function (k) { if (!ANT[k]) ANT[k] = K.CONFUSABLES[k]; });
    var swap = []; toks.forEach(function (t, k) { var lw = t.surface.toLowerCase(); if (ANT[lw] || ENRICH.ant[lw]) swap.push(k); });
    var bad = swap.length ? shuffleDet(swap, seed ^ 0x5c)[0] : randInt(seed ^ 0x5c, 5), repl = {}, ansWord, orig, how = "유사어";
    toks.forEach(function (t, k) {
      if (k === bad) {
        orig = t.surface; var lw = orig.toLowerCase();
        var sub = (ENRICH.ant[lw] && ENRICH.ant[lw][0]) || ANT[lw];
        if (sub) how = K.ANTONYMS[lw] || (ENRICH.ant[lw]) ? "반의어" : "혼동어"; else { var d = distractors(orig, doc, 1, seed ^ (k + 13), t.pos); sub = d[0] || orig; }
        repl[t.ti] = circ(k + 1) + " <<" + sub + ">>"; ansWord = sub;
      } else repl[t.ti] = circ(k + 1) + " <<" + t.surface + ">>";
    });
    return { type: "어휘 추론", fidelity: "A", instruction: "밑줄 친 낱말 중, 문맥상 낱말의 쓰임이 적절하지 않은 것을 고르시오.", problem: [doc.render(repl)], answer: circ(bad + 1) + " " + ansWord + " (→ 문맥상 '" + orig + "' 자리, " + how + " 교체)", explain: circ(bad + 1) + "의 '" + ansWord + "'는 문맥에 맞지 않는다(원문 '" + orig + "', " + how + ")." };
  }
  function sentenceWordTis(doc, si) { var out = []; doc.tokens.forEach(function (t, ti) { if (t.sent === si && t.word) out.push(ti); }); return out; }
  function gen_blank(doc, seed) {
    var k3 = doc.tokens.length > 60 ? 3 : 2, phrases = [];
    for (var si = 0; si < doc.sents.length; si++) {
      var w = sentenceWordTis(doc, si);
      for (var j = 1; j < w.length - k3; j++) {
        var span = w.slice(j, j + k3);
        if (!span.some(function (ti) { return doc.content(doc.tokens[ti]); })) continue;
        if (STOP[doc.tokens[span[span.length - 1]].surface.toLowerCase()]) continue;
        var text = span.map(function (ti) { return doc.tokens[ti].surface; }).join(" ");
        var ws = {}; span.forEach(function (ti) { ws[doc.tokens[ti].surface.toLowerCase()] = 1; });
        phrases.push({ si: si, tis: span, text: text, words: ws });
      }
    }
    if (phrases.length >= 5) {
      var kw = {}; keywords(doc, 6).forEach(function (x) { kw[x] = 1; });
      function dens(si) { return sentenceWordTis(doc, si).filter(function (ti) { return kw[doc.tokens[ti].surface.toLowerCase()]; }).length; }
      var ranked = phrases.slice().sort(function (a, b) { return dens(b.si) - dens(a.si) || b.text.length - a.text.length; });
      var correct = shuffleDet(ranked.slice(0, Math.max(4, Math.floor(ranked.length / 3))), seed)[0];
      var others = phrases.filter(function (p) { if (p.si === correct.si) return false; for (var x in p.words) if (correct.words[x]) return false; return true; });
      var seen = {}, ds = [];
      shuffleDet(others, seed ^ 0x9).forEach(function (p) { if (ds.length < 4 && !seen[p.text.toLowerCase()]) { seen[p.text.toLowerCase()] = 1; ds.push(p); } });
      shuffleDet(K.ABSTRACT_PHRASES.slice(), seed ^ 0x55).forEach(function (ph) { if (ds.length < 4 && !seen[ph.toLowerCase()]) { seen[ph.toLowerCase()] = 1; ds.push({ text: ph }); } });
      if (ds.length === 4) {
        var opt = shuffleDet([correct].concat(ds), seed ^ 0x8), repl = {};
        repl[correct.tis[0]] = "______________"; correct.tis.slice(1).forEach(function (ti) { repl[ti] = ""; });
        var choices = opt.map(function (p) { return p.text; }), idx = opt.indexOf(correct);
        return { type: "빈칸 추론", fidelity: "A", instruction: "다음 빈칸에 들어갈 말로 가장 적절한 것을 고르시오.", problem: [doc.render(repl), choices.map(function (c, i) { return circ(i + 1) + " " + c; }).join("\n")], answer: circ(idx + 1) + " " + correct.text, explain: "문맥과 글의 논리상 빈칸에는 '" + correct.text + "'가 적절하다." };
      }
    }
    var t = pickTokens(doc, seed, 1, 5, false); if (!t.length) return null; t = t[0];
    var d = distractors(t.surface, doc, 4, seed ^ 0x77, t.pos); if (d.length < 4) return null;
    var cor = t.surface.toLowerCase(), ch = shuffleDet([cor].concat(d), seed ^ 0x88), rp = {}; rp[t.ti] = "_________";
    return { type: "빈칸 추론", fidelity: "A", instruction: "다음 빈칸에 들어갈 말로 가장 적절한 것을 고르시오.", problem: [doc.render(rp), ch.map(function (c, i) { return circ(i + 1) + " " + c; }).join("   ")], answer: circ(ch.indexOf(cor) + 1) + " " + cor, explain: "문맥상 빈칸에는 '" + cor + "'가 적절하다." };
  }
  function foreignSentence(doc, seed) {
    var others = ALL_DOCS.filter(function (d) { return d.id !== doc.id; }); if (!others.length) return null;
    var kw = {}; keywords(doc, 6).forEach(function (x) { kw[x] = 1; }); var pool = [];
    others.forEach(function (od) { od.sents.forEach(function (s, i) { var wc = od.wc(i); if (wc >= 9 && wc <= 24 && !/[":]/.test(s.text) && !/\d/.test(s.text)) { var ov = (s.text.toLowerCase().match(/[a-z]+/g) || []).filter(function (w) { return kw[w]; }).length; pool.push({ o: ov, t: s.text }); } }); });
    if (!pool.length) return null;
    var shared = pool.filter(function (x) { return x.o >= 1; }).map(function (x) { return x.t; });
    return shuffleDet(shared.length ? shared : pool.map(function (x) { return x.t; }), seed ^ 0x33)[0];
  }
  function gen_irrelevant(doc, seed) {
    var win = getWindow(doc, seed, 6); if (!win) return null;
    var foreign = foreignSentence(doc, seed ^ 0x41); if (!foreign) return null;
    var five = win.slice(1).map(function (w) { return w.text; }), tgt = randInt(seed ^ 0x42, 5); five[tgt] = foreign;
    return { type: "무관한 문장", fidelity: "A", instruction: "다음 글에서 전체 흐름과 관계 없는 문장을 고르시오.", problem: ["[도입] " + win[0].text].concat(five.map(function (t, i) { return circ(i + 1) + " " + t; })), answer: circ(tgt + 1), explain: circ(tgt + 1) + "은 도입의 화제와 무관한 문장이다." };
  }
  function gen_order(doc, seed) {
    var win = getWindowCued(doc, seed, 4); if (!win) return null;
    var orig = win.slice(1).map(function (w, i) { return { o: i, text: w.text }; });
    var shown = shuffleDet(orig, seed ^ 0x12), g = 0;
    while (shown.every(function (c, i) { return c.o === i; }) && g < 6) { g++; shown = shuffleDet(orig, (seed ^ 0x12) + g * 0x1f1f); }
    shown.forEach(function (c, i) { c.label = ["A", "B", "C"][i]; });
    var correct = shown.slice().sort(function (a, b) { return a.o - b.o; }).map(function (c) { return c.label; }).join("");
    var OPTS = ["ACB", "BAC", "BCA", "CAB", "CBA"]; if (OPTS.indexOf(correct) < 0) return null;
    var fmt = function (s) { return s.split("").map(function (l) { return "(" + l + ")"; }).join(" - "); };
    var lines = ["[주어진 글] " + win[0].text].concat(shown.map(function (c) { return "(" + c.label + ") " + c.text; }));
    lines.push(OPTS.map(function (o, i) { return circ(i + 1) + " " + fmt(o); }).join("   "));
    return { type: "순서 추론", fidelity: "A", instruction: "주어진 글 다음에 이어질 글의 순서로 가장 적절한 것을 고르시오.", problem: lines, answer: circ(OPTS.indexOf(correct) + 1) + " " + fmt(correct), explain: "논리적 순서는 " + fmt(correct) + "이다." };
  }
  function gen_insertion(doc, seed) {
    var win = getWindowCued(doc, seed, 5); if (!win) return null;
    var tgt = randInt(seed ^ 0x103, win.length), removed = win[tgt], rem = win.filter(function (_, i) { return i !== tgt; });
    var lines = ["[삽입할 문장] " + removed.text, "※ ①~⑤는 각 번호 위치에 문장을 넣는 자리입니다."];
    rem.forEach(function (w, i) { lines.push(circ(i + 1) + " " + w.text); }); lines.push(circ(rem.length + 1) + " (글의 마지막)");
    return { type: "문장 삽입", fidelity: "A", instruction: "글의 흐름으로 보아, 주어진 문장이 들어가기에 가장 적절한 곳을 고르시오.", problem: lines, answer: circ(tgt + 1), explain: "주어진 문장은 " + circ(tgt + 1) + " 위치에 들어가야 자연스럽다." };
  }
  function gen_summary(doc, seed) {
    var kw = keywords(doc, 4); if (kw.length < 2) return null;
    var a = kw[0], b = kw[1], pa = K.SYNONYMS[a], pb = K.SYNONYMS[b];
    var ans = "(A) " + a + (pa ? " (동의어 '" + pa + "' 허용)" : "") + "   (B) " + b + (pb ? " (동의어 '" + pb + "' 허용)" : "");
    return { type: "요약문 완성하기", fidelity: "A", instruction: "다음 글의 핵심 내용을 한 문장으로 요약하려 한다. 빈칸 (A), (B)에 들어갈 말을 윗글에서 찾거나 같은 뜻으로 바꿔 쓰시오.", problem: [doc.text, "<요약> 이 글은 (A) ____________ 와(과) (B) ____________ 을(를) 중심으로 전개된다.", "(A) ______________________     (B) ______________________"], answer: ans, explain: "중심 소재는 '" + a + "', '" + b + "'. 동의어·상위어도 인정." };
  }
  function gen_referent(doc, seed) {
    var cand = [];
    doc.sents.forEach(function (s, si) { if (si === 0) return; var m = s.text.match(/^\s*(They|It|He|She)\b/); if (m) cand.push({ si: si, p: m[1] }); });
    if (!cand.length) return null;
    var pick = shuffleDet(cand, seed)[0];
    var prev = doc.contentTokens("noun").filter(function (c) { return c.sent === pick.si - 1; });
    if (!prev.length) prev = doc.contentTokens("noun").filter(function (c) { return c.sent < pick.si; });
    if (!prev.length) return null;
    prev.sort(function (a, b) { return (b.freq - a.freq) || (a.ti - b.ti); });
    var answer = prev[0].surface;
    var others = doc.contentTokens("noun").map(function (c) { return c.surface; }).filter(function (x) { return x.toLowerCase() !== answer.toLowerCase(); });
    var ds = []; var seen = {}; shuffleDet(others, seed ^ 0x9).forEach(function (x) { if (ds.length < 4 && !seen[x.toLowerCase()]) { seen[x.toLowerCase()] = 1; ds.push(x); } });
    if (ds.length < 4) ds = ds.concat(distractors(answer, doc, 4, seed, "noun")).slice(0, 4);
    var choices = shuffleDet([answer].concat(ds).filter(function (v, i, arr) { return arr.indexOf(v) === i; }).slice(0, 5), seed ^ 0x7);
    if (choices.indexOf(answer) < 0) choices[choices.length - 1] = answer;
    var mk = markWord(doc.sents[pick.si].text, pick.p); if (!mk[1]) return null;
    var ctx = pick.si > 0 ? doc.sents[pick.si - 1].text + " " : "";
    return { type: "지칭 추론", fidelity: "B", instruction: "밑줄 친 부분이 가리키는 대상으로 가장 적절한 것을 고르시오.", problem: [ctx + mk[0], choices.map(function (c, i) { return circ(i + 1) + " " + c; }).join("   ")], answer: circ(choices.indexOf(answer) + 1) + " " + answer, explain: "문장 첫머리의 '" + pick.p + "'는 직전 문장의 주어 '" + answer + "'를 가리킨다." };
  }
  function alterSentence(doc, si, seed) {
    var s = doc.sents[si].text, DEG = K.DEGREE_SWAP, ANT = K.ANTONYMS;
    for (var w in DEG) { var re = new RegExp("\\b" + w + "\\b", "i"); if (re.test(s)) return s.replace(re, DEG[w]); }
    var ant = doc.contentTokens().filter(function (c) { return c.sent === si && ANT[c.surface.toLowerCase()]; });
    if (ant.length) { var c = shuffleDet(ant, seed)[0]; return s.replace(new RegExp("\\b" + c.surface + "\\b"), ANT[c.surface.toLowerCase()]); }
    var ct = doc.contentTokens().filter(function (c) { return c.sent === si; });
    if (ct.length && mulberry32(seed)() < 0.5) { var cc = shuffleDet(ct, seed)[0], d = distractors(cc.surface, doc, 1, seed ^ 3, cc.pos); if (d.length) return s.replace(new RegExp("\\b" + cc.surface + "\\b"), d[0]); }
    var m = s.match(/\b(is|are|was|were|can|will|does|do|has|have)\b/); if (m) return s.slice(0, m.index + m[0].length) + " not" + s.slice(m.index + m[0].length);
    return "It is not true that " + s[0].toLowerCase() + s.slice(1);
  }
  function pickSents(doc, seed, k) {
    var idx = []; for (var i = 0; i < doc.sents.length; i++) { var wc = doc.wc(i); if (wc >= 6 && wc <= 26 && !/[":]/.test(doc.sents[i].text)) idx.push(i); }
    return shuffleDet(idx, seed).slice(0, k).sort(function (a, b) { return a - b; });
  }
  function gen_match(doc, seed) {
    var idx = pickSents(doc, seed, 5); if (idx.length < 5) return null;
    var trueK = randInt(seed ^ 1, 5), lines = idx.map(function (si, k) { return circ(k + 1) + " " + (k === trueK ? doc.sents[si].text : alterSentence(doc, si, seed ^ (k + 7))); });
    return { type: "내용 일치", fidelity: "A", instruction: "다음 글의 내용과 일치하는 것을 고르시오.", problem: [doc.text].concat(lines), answer: circ(trueK + 1), explain: circ(trueK + 1) + "만 본문과 일치하며 나머지는 변형되었다." };
  }
  function gen_mismatch(doc, seed) {
    var idx = pickSents(doc, seed ^ 0xfe, 5); if (idx.length < 5) return null;
    var falseK = randInt(seed ^ 2, 5), lines = idx.map(function (si, k) { return circ(k + 1) + " " + (k === falseK ? alterSentence(doc, si, seed ^ (k + 17)) : doc.sents[si].text); });
    return { type: "내용 불일치", fidelity: "A", instruction: "다음 글의 내용과 일치하지 않는 것을 고르시오.", problem: [doc.text].concat(lines), answer: circ(falseK + 1), explain: circ(falseK + 1) + "만 본문과 어긋난다." };
  }
  function gen_topic(doc, seed) {
    var kw = keywords(doc, 3); if (kw.length < 2) return null;
    var tmpl = shuffleDet(K.TOPIC_TEMPLATES, seed)[0], correct = tmpl.replace("{a}", kw[0]).replace("{b}", kw[1]);
    var ds = shuffleDet(K.OFF_TOPICS, seed ^ 2).slice(0, 4), choices = shuffleDet([correct].concat(ds), seed ^ 5);
    return { type: "주제 추론", fidelity: "B", instruction: "다음 글의 주제로 가장 적절한 것을 고르시오.", problem: [doc.text, choices.map(function (c, i) { return circ(i + 1) + " " + c; }).join("\n")], answer: circ(choices.indexOf(correct) + 1) + " " + correct, explain: "글은 '" + kw[0] + "', '" + kw[1] + "' 중심으로 전개되므로 정답이 주제, 나머지는 무관 소재." };
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function gen_title(doc, seed) {
    var kw = keywords(doc, 3); if (kw.length < 2) return null;
    var tmpl = shuffleDet(K.TITLE_TEMPLATES, seed ^ 1)[0], correct = tmpl.replace("{A}", cap(kw[0])).replace("{B}", cap(kw[1]));
    var ds = shuffleDet(K.OFF_TOPICS.map(function (s) { return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }), seed ^ 2).slice(0, 4);
    var choices = shuffleDet([correct].concat(ds), seed ^ 6);
    return { type: "제목 추론", fidelity: "B", instruction: "다음 글의 제목으로 가장 적절한 것을 고르시오.", problem: [doc.text, choices.map(function (c, i) { return circ(i + 1) + " " + c; }).join("\n")], answer: circ(choices.indexOf(correct) + 1) + " " + correct, explain: "핵심어 '" + kw[0] + "', '" + kw[1] + "'를 포괄하는 제목이 정답." };
  }
  function cueScore(text, cues) { var tot = 0; cues.replace(/\//g, " ").split(" ").forEach(function (w) { if (w.length < 4 || STOP[w]) return; var m = text.match(new RegExp("\\b" + w + "\\b", "g")); tot += m ? m.length : 0; }); return tot; }
  function gen_mood(doc, seed) {
    var text = doc.text.toLowerCase(), score = {}, best = null;
    Object.keys(K.SENTIMENT).forEach(function (m) { score[m] = cueScore(text, K.SENTIMENT[m]); if (best === null || score[m] > score[best]) best = m; });
    if (score[best] < 2) return { type: "심경 추론", fidelity: "C", instruction: "다음 글에 드러난 화자의 심경으로 가장 적절한 것을 우리말로 쓰시오. (서술형)", problem: [doc.text, "심경: ____________________"], answer: "(서술형 — 감정 단서가 약해 서술형으로 채점)", explain: "감정 어휘 단서가 뚜렷하지 않아 서술형." };
    var others = shuffleDet(Object.keys(K.SENTIMENT).filter(function (m) { return m !== best; }), seed).slice(0, 4), choices = shuffleDet([best].concat(others), seed ^ 4);
    return { type: "심경 추론", fidelity: "C", instruction: "다음 글에 드러난 화자의 심경으로 가장 적절한 것을 고르시오.", problem: [doc.text, choices.map(function (c, i) { return circ(i + 1) + " " + c; }).join("   ")], answer: circ(choices.indexOf(best) + 1) + " " + best, explain: "감정 어휘 단서로 보아 심경은 '" + best + "'에 가깝다." };
  }
  function gen_purpose(doc, seed) {
    var text = doc.text.toLowerCase(), kw = keywords(doc, 3), score = {}, best = null;
    Object.keys(K.PURPOSE).forEach(function (p) { score[p] = cueScore(text, K.PURPOSE[p]); if (best === null || score[p] > score[best]) best = p; });
    if (score[best] >= 2) {
      var others = shuffleDet(Object.keys(K.PURPOSE).filter(function (p) { return p !== best; }), seed).slice(0, 4), choices = shuffleDet([best].concat(others), seed ^ 4);
      return { type: "목적 추론", fidelity: "C", instruction: "다음 글을 쓴 목적으로 가장 적절한 것을 고르시오.", problem: [doc.text, choices.map(function (c, i) { return circ(i + 1) + " " + c; }).join("   ")], answer: circ(choices.indexOf(best) + 1) + " " + best, explain: "어조 단서로 보아 글의 목적은 '" + best + "'이다." };
    }
    return { type: "목적 추론", fidelity: "C", instruction: "다음 글을 쓴 목적을 우리말 한 문장으로 쓰시오. (핵심어: " + kw.join(", ") + ")", problem: [doc.text, "목적: ____________________________________"], answer: "(서술형 — 화제·어조로 채점)", explain: "핵심어 " + kw.join(", ") + " 중심으로 의도 파악." };
  }
  function strongSentence(doc) { for (var i = 0; i < doc.sents.length; i++) if (/\b(should|must|need to|have to|important|essential|recommend|key)\b/i.test(doc.sents[i].text)) return doc.sents[i].text; return doc.sents.length ? doc.sents[doc.sents.length - 1].text : null; }
  function gen_claim(doc, seed) { var s = strongSentence(doc), kw = keywords(doc, 3); if (!s) return null; return { type: "주장 추론", fidelity: "C", instruction: "다음 글에서 필자가 주장하는 바를 우리말 한 문장으로 쓰시오. (핵심어: " + kw.join(", ") + ")", problem: [doc.text, "[주장 근거 문장] " + s, "주장: ____________________________________"], answer: "(서술형 — 근거 문장·핵심어로 채점)", explain: "필자의 주장은 '" + s + "'에 집약." }; }
  function gen_gist(doc, seed) { var kw = keywords(doc, 3); return { type: "요지 추론", fidelity: "C", instruction: "다음 글의 요지를 우리말 한 문장으로 쓰시오. (핵심어: " + kw.join(", ") + ")", problem: [doc.text, "요지: ____________________________________"], answer: "(서술형 — 핵심어 포함 한 문장 요지로 채점)", explain: "중심 생각을 한 문장으로 정리." }; }
  function gen_implication(doc, seed) {
    var tl = doc.text.toLowerCase(), found = [];
    Object.keys(K.IDIOMS).forEach(function (ph) { if (new RegExp("\\b" + ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(tl)) found.push(ph); });
    if (found.length) {
      var ph = shuffleDet(found, seed)[0], v = K.IDIOMS[ph], si = null;
      for (var i = 0; i < doc.sents.length; i++) if (new RegExp("\\b" + ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(doc.sents[i].text)) { si = i; break; }
      var sent = si !== null ? doc.sents[si].text : doc.text, mk = markWord(sent, ph);
      if (mk[1]) {
        var choices = shuffleDet([v.m].concat(v.d.slice(0, 4)), seed ^ 7), ctx = (si && si > 0) ? doc.sents[si - 1].text + " " : "";
        return { type: "함의 추론", fidelity: "B", instruction: "밑줄 친 부분이 글에서 의미하는 바로 가장 적절한 것을 고르시오.", problem: [ctx + mk[0], choices.map(function (c, i) { return circ(i + 1) + " " + c; }).join("\n")], answer: circ(choices.indexOf(v.m) + 1) + " " + v.m, explain: "관용 표현 '" + ph + "'의 문맥상 의미는 '" + v.m + "'." };
      }
    }
    var cand = []; doc.sents.forEach(function (s, i) { var wc = doc.wc(i); if (wc >= 8 && wc <= 22) cand.push({ i: i, s: s }); });
    if (!cand.length) return null;
    var pick = shuffleDet(cand, seed)[0], ct = doc.contentTokens().filter(function (c) { return c.sent === pick.i && c.len >= 5; });
    if (ct.length < 2) return null;
    ct.sort(function (a, b) { return a.ti - b.ti; });
    var span = doc.text.slice(doc.tokens[ct[0].ti].start, doc.tokens[ct[ct.length - 1].ti].end);
    return { type: "함의 추론", fidelity: "C", instruction: "밑줄 친 부분이 글에서 의미하는 바를 우리말로 쓰시오. (서술형)", problem: [mark(pick.s.text, span), "의미: ____________________________"], answer: "(서술형 — 문맥상 함축 의미로 채점)", explain: "밑줄 표현의 문맥적 함의를 묻는다." };
  }

  var GEN = {
    "목적 추론": gen_purpose, "심경 추론": gen_mood, "주장 추론": gen_claim, "함의 추론": gen_implication,
    "요지 추론": gen_gist, "주제 추론": gen_topic, "제목 추론": gen_title, "내용 일치": gen_match, "내용 불일치": gen_mismatch,
    "어법 추론": gen_grammar, "어휘 추론": gen_vocab, "빈칸 추론": gen_blank, "무관한 문장": gen_irrelevant,
    "순서 추론": gen_order, "문장 삽입": gen_insertion, "요약문 완성하기": gen_summary, "지칭 추론": gen_referent
  };
  var ALL_TYPES = Object.keys(GEN);

  function makeQuestions(passages, types, opts) {
    var docs = passages.filter(function (p) { return p.text && p.text.trim(); }).map(function (p, i) { return new Doc(p.id || ("P" + (i + 1)), p.text); });
    buildGlobal(docs);
    var items = [], skipped = [], no = 0;
    docs.forEach(function (doc, pi) {
      types.forEach(function (t) {
        var fn = GEN[t]; if (!fn) return; var made = null;
        for (var a = 0; a < 6; a++) {
          var seed = (hash(doc.text) ^ (pi * 0x9e37) ^ (hash(t) & 0xffff) ^ (a * 0x2b2b)) >>> 0;
          try { var q = fn(doc, seed); } catch (e) { q = null; }
          if (q) { made = q; break; }
        }
        if (made) { no++; made.no = no; made.passageNo = pi + 1; made.guideline = K.GUIDELINES[t] || {}; items.push(made); }
        else skipped.push({ passageNo: pi + 1, type: t });
      });
    });
    return { items: items, skipped: skipped };
  }

  var api = {
    Doc: Doc, makeQuestions: makeQuestions, ALL_TYPES: ALL_TYPES, keywords: keywords, setEnrich: setEnrich, buildGlobal: buildGlobal,
    _docsFor: function (passages) { return passages.map(function (p, i) { return new Doc(p.id || ("P" + (i + 1)), p.text); }); }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.ENGINE = api;
})(typeof window !== "undefined" ? window : globalThis);
