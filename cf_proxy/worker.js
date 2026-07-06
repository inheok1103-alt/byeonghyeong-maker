/* ===========================================================================
   Ray English 출제자 뇌 — Cloudflare Worker 프록시
   목적: API 키를 "서버(여기)"에 숨김. 브라우저엔 키가 절대 안 감 → 안전.
         사용자는 키 없이 무한모드급으로 씀. 프록시가 서버측 폴백·키회전 수행.

   배포: cf_proxy/README.md 참고. 키는 대시보드/Wrangler의 "secret"으로 넣음(코드에 안 박음).
   요청: POST { messages:[...], temperature?, json? }   →   { content, provider }
   =========================================================================== */

const DEFAULT_MODELS = {
  gemini: "gemini-2.0-flash",
  groq: "llama-3.3-70b-versatile",
  cerebras: "llama-3.3-70b",
  mistral: "mistral-small-latest",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
};
const OAI = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  cerebras: "https://api.cerebras.ai/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};
// 폴백 순서: 무료 한도 큰 순 → 무키 폴백
const CHAIN = ["gemini", "groq", "cerebras", "mistral", "openrouter", "pollinations"];

function keysOf(env, prov) {
  return String(env[prov.toUpperCase() + "_KEY"] || "").split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
}
function modelOf(env, prov) { return env[prov.toUpperCase() + "_MODEL"] || DEFAULT_MODELS[prov]; }

async function callGemini(env, key, messages, temperature, json) {
  const sys = messages.filter(m => m.role === "system").map(m => m.content).join("\n");
  const rest = messages.filter(m => m.role !== "system").map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const body = { contents: rest, generationConfig: { temperature } };
  if (json) body.generationConfig.responseMimeType = "application/json";
  if (sys) body.systemInstruction = { parts: [{ text: sys }] };
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + modelOf(env, "gemini") + ":generateContent?key=" + encodeURIComponent(key),
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json();
  if (d.error) { const m = String(d.error.message || ""); throw { limited: /quota|rate|429|exhausted|high demand|503/i.test(m) || d.error.code === 429 || d.error.code === 503, msg: "gemini: " + m.slice(0, 80) }; }
  return (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts[0].text) || "";
}
async function callOAI(env, prov, key, messages, temperature, json) {
  const body = { model: modelOf(env, prov), messages, temperature };
  if (json) body.response_format = { type: "json_object" };
  const hd = { "Content-Type": "application/json", "Authorization": "Bearer " + key };
  if (prov === "openrouter") { hd["HTTP-Referer"] = "https://inheok1103-alt.github.io"; hd["X-Title"] = "chuljae-brain"; }
  const r = await fetch(OAI[prov], { method: "POST", headers: hd, body: JSON.stringify(body) });
  const d = await r.json();
  if (d.error) { const m = String(d.error.message || d.error || ""); throw { limited: /rate|limit|quota|too many|429|exceed|credit|insufficient/i.test(m), msg: prov + ": " + m.slice(0, 80) }; }
  return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
}
// 우리 자체모델(HF 추론) — HF_TOKEN secret 있으면 1순위로 시도
async function callOwnModel(env, messages, temperature) {
  const model = env.HF_MODEL || "Picolo1103/ray-english-exam-3b";
  let prompt = "";
  for (const m of messages) prompt += "<|im_start|>" + m.role + "\n" + m.content + "<|im_end|>\n";
  prompt += "<|im_start|>assistant\n";
  const r = await fetch("https://api-inference.huggingface.co/models/" + model, {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.HF_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 512, temperature: temperature || 0.5, return_full_text: false, do_sample: true }, options: { wait_for_model: true, use_cache: false } }),
  });
  const d = await r.json();
  if (d.error) throw { limited: /loading|rate|429|503|busy/i.test(String(d.error)), msg: "own: " + String(d.error).slice(0, 90) };
  const txt = Array.isArray(d) ? (d[0] && d[0].generated_text) : (d.generated_text || "");
  return String(txt || "").replace(/<\|im_end\|>[\s\S]*$/, "").trim();
}
async function callPollinations(messages, temperature) {
  const r = await fetch("https://text.pollinations.ai/openai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "openai", messages, temperature, private: true }) });
  const d = await r.json();
  if (d && d.error) throw { limited: true, msg: "pollinations: " + String(d.error.message || d.error).slice(0, 80) };
  return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
}

async function generate(env, messages, temperature, json) {
  let lastErr = "no provider";
  // 자체모델 우선(HF_TOKEN secret 있을 때). 실패/로딩중이면 아래 프론티어 체인으로 폴백.
  if (env.HF_TOKEN && env.USE_OWN_MODEL !== "0") {
    try { const t = await callOwnModel(env, messages, temperature); if (t && t.trim()) return { content: t, provider: "own-model" }; }
    catch (e) { lastErr = (e && e.msg) || String(e); }
  }
  for (const prov of CHAIN) {
    try {
      if (prov === "pollinations") { const t = await callPollinations(messages, temperature); if (t && t.trim()) return { content: t, provider: prov }; continue; }
      const keys = keysOf(env, prov); if (!keys.length) continue;
      for (const k of keys) {
        try {
          const t = prov === "gemini" ? await callGemini(env, k, messages, temperature, json) : await callOAI(env, prov, k, messages, temperature, json);
          if (t && t.trim()) return { content: t, provider: prov };
        } catch (e) { lastErr = e.msg || String(e); if (!e.limited) break; /* 레이트리밋이면 다음 키 시도 */ }
      }
    } catch (e) { lastErr = (e && e.msg) || String(e); }
  }
  throw new Error(lastErr);
}

function cors(origin, allowed) {
  const ok = allowed.length === 0 || allowed.includes(origin) || allowed.some(a => a === "*");
  const h = {
    "Access-Control-Allow-Origin": ok ? (origin || "*") : allowed[0] || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  return { ok, h };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = String(env.ALLOWED_ORIGINS || "https://inheok1103-alt.github.io,http://localhost,http://127.0.0.1").split(",").map(s => s.trim()).filter(Boolean);
    const { ok, h } = cors(origin, allowed);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (request.method === "GET") return new Response(JSON.stringify({ ok: true, service: "ray-proxy", providers: CHAIN }), { headers: { ...h, "Content-Type": "application/json" } });
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: h });
    // 오리진 잠금: 내 사이트에서 온 요청만(남이 자기 사이트에 내 프록시를 못 쓰게). 더 강한 남용방지는 대시보드 Rate Limiting Rule.
    if (!ok && origin) return new Response(JSON.stringify({ error: "origin not allowed" }), { status: 403, headers: { ...h, "Content-Type": "application/json" } });
    let body;
    try { body = await request.json(); } catch (e) { return new Response(JSON.stringify({ error: "bad json" }), { status: 400, headers: { ...h, "Content-Type": "application/json" } }); }
    const messages = body.messages;
    if (!Array.isArray(messages) || !messages.length) return new Response(JSON.stringify({ error: "messages required" }), { status: 400, headers: { ...h, "Content-Type": "application/json" } });
    const temperature = body.temperature == null ? 0.6 : body.temperature;
    try {
      const out = await generate(env, messages, temperature, !!body.json);
      return new Response(JSON.stringify(out), { headers: { ...h, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e.message || e).slice(0, 120) }), { status: 502, headers: { ...h, "Content-Type": "application/json" } });
    }
  },
};
