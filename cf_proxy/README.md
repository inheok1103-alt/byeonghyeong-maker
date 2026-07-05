# Ray 프록시 — "누구나 키 없이 쓰되, 내 키는 안전" (Cloudflare Worker)

키를 **브라우저가 아니라 서버(Worker)에 숨깁니다.** 사용자는 키 없이 무한모드급으로 쓰고, 내 키는 소스·개발자도구 어디에도 안 보입니다. 전부 **무료**(Cloudflare 무료 한도 넉넉).

```
[사용자 브라우저] ─(키 없이)→ [내 Worker(키 보관)] ─(키 붙여)→ [Gemini/Groq/…] → 결과
```

## 준비물
- 무료 Cloudflare 계정 (dash.cloudflare.com)
- 무료 API 키 1개 이상 (Gemini/Groq/Cerebras/Mistral/OpenRouter 중)

---

## 배포 방법 A — 대시보드(클릭, 제일 쉬움)
1. dash.cloudflare.com → 좌측 **Workers & Pages** → **Create** → **Create Worker** → 이름 `ray-proxy` → Deploy
2. **Edit code** → 기존 코드 지우고 `cf_proxy/worker.js` 내용 전체 붙여넣기 → **Deploy**
3. 워커 페이지 → **Settings → Variables and Secrets**:
   - **Add** → 타입 **Secret** → 이름 `GROQ_KEY` → 값에 키 붙여넣기 → Save (있는 키마다 반복: `GEMINI_KEY` 등)
   - 여러 키를 한 제공자에 넣으려면 값에 **콤마로**: `key1,key2,key3` (한도 N배)
4. (선택) 타입 **Text**로 `ALLOWED_ORIGINS` = `https://inheok1103-alt.github.io` 추가
5. 워커 주소 복사: `https://ray-proxy.<내계정>.workers.dev`

## 배포 방법 B — Wrangler CLI (터미널)
```bash
cd cf_proxy
npm i -g wrangler
npx wrangler login
npx wrangler deploy
npx wrangler secret put GROQ_KEY        # 물어보면 키 붙여넣기 (콤마로 여러 개 가능)
npx wrangler secret put GEMINI_KEY      # 있는 것만
# → 출력된 https://ray-proxy.<계정>.workers.dev 주소 복사
```

---

## 사이트에 연결 (1줄)
`web/ai_maker.html`(과 `web/m.html`) 상단의 이 줄에 워커 주소를 넣으면 끝:
```js
var RAY_PROXY = "https://ray-proxy.<내계정>.workers.dev";
```
- 넣으면 → 사용자는 **키 입력 없이** 무한모드로 사용(키는 서버에 숨김).
- 비워두면 → 지금처럼 무키 폴백(Pollinations)/사용자 자기 키로 동작.
- **워커 주소는 비밀이 아님** — 사이트에 박아도 안전(키가 아니라 문 주소일 뿐).

## 남용 방지(권장)
- Worker는 기본으로 **내 사이트 오리진만 허용**(남이 자기 사이트에서 못 씀).
- 더 강하게: Cloudflare 대시보드 → 워커 → **Settings → 자기 도메인/트리거** 또는 **Security → Rate limiting rule**로 IP당 호출 제한.

## 점검
- 브라우저에서 `https://ray-proxy.<계정>.workers.dev` 열면 `{"ok":true,...}` 뜨면 정상.
- 문제 시: Worker 페이지 → **Logs**(실시간)로 오류 확인.

## 현실 한 가지 (보안 아님, 용량)
무료키 하나를 수백 명이 공유하면 하루 한도가 금방 소진됩니다. → 제공자별 **키 여러 개를 콤마로** 넣으면 서버가 자동 회전(한도 N배). 그래도 대규모면 유료 키 하나 섞는 게 안정적.
