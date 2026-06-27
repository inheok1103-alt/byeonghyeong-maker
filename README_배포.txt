============================================================
 변형문제 생성기 (웹버전) — GitHub Pages 배포 안내
============================================================

이 폴더(web)에는 3개 파일이 있습니다. 셋은 같은 폴더에 함께 있어야 합니다.
  - index.html   (화면·UI)
  - data.js      (지식 데이터)
  - engine.js    (생성 엔진 + 무료 API 연결)

먼저 로컬에서 확인:
  index.html 을 더블클릭 → 브라우저에서 바로 동작합니다(설치 불필요).
  ※ '무료 API 보강' 체크는 인터넷이 있어야 작동합니다. 꺼도 내장 데이터로 생성됩니다.

───────────────────────────────────────────
 GitHub Pages 에 올리기 (웹사이트로 공개)  — 가장 쉬운 방법
───────────────────────────────────────────
1) github.com 로그인 → 우측 상단 '+' → New repository
   - Repository name: 예) byeonghyeong-maker  (영문/숫자/하이픈)
   - Public 선택 → Create repository

2) 새 저장소 화면에서  "uploading an existing file"  클릭
   - 이 web 폴더의  index.html, data.js, engine.js  3개를 드래그해 올림
   - 아래 'Commit changes' 클릭

3) 상단 Settings → 좌측 Pages
   - Source: 'Deploy from a branch'
   - Branch: main / 폴더: /(root) → Save

4) 1~2분 뒤 같은 Pages 화면에 주소가 뜸:
      https://(내아이디).github.io/byeonghyeong-maker/
   이 주소로 어디서나(휴대폰 포함) 접속·사용 가능.

※ 중요: 세 파일은 저장소 '루트(root)'에 함께 두세요(폴더 안에 넣지 말 것).
   index.html 이 data.js / engine.js 를 같은 위치에서 불러옵니다.

───────────────────────────────────────────
 git 명령으로 올리기 (선택, 익숙하면)
───────────────────────────────────────────
  cd "이 web 폴더"
  git init
  git add index.html data.js engine.js
  git commit -m "변형문제 생성기 웹버전"
  git branch -M main
  git remote add origin https://github.com/(내아이디)/byeonghyeong-maker.git
  git push -u origin main
  → 이후 GitHub Settings > Pages 에서 Branch: main /(root) 설정

───────────────────────────────────────────
 무료 API 정보 (키 불필요·키 없이 동작)
───────────────────────────────────────────
  - 무료 사전 API : https://api.dictionaryapi.dev   (단어 정의·예문)
  - Datamuse     : https://api.datamuse.com         (동의어·반의어·연관어)
  둘 다 키가 필요 없고 브라우저에서 바로 호출됩니다(HTTPS·CORS 허용).
  인터넷이 없으면 자동으로 내장 데이터로만 생성합니다.

업데이트하려면: 파일을 수정한 뒤 GitHub에서 같은 파일을 다시 업로드(또는 git push)하면
1~2분 내 사이트에 반영됩니다.
