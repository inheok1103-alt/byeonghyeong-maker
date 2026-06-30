# GPT Image Assets for Claude

이 폴더의 이미지는 GPT Image로 생성한 변형문제 생성기용 비트맵 자산입니다.

## Files

- `workbook-ai-banner-gpt.png`
  - 용도: 웹 상단 배너, 소개 화면, 카드형 커버
  - 추천 비율: 가로형 16:9
  - HTML 경로: `assets/workbook-ai-banner-gpt.png`

- `workbook-ai-thumbnail-gpt.png`
  - 용도: 빈 상태 화면, 앱 썸네일, 기능 카드 이미지
  - 추천 비율: 정사각형
  - HTML 경로: `assets/workbook-ai-thumbnail-gpt.png`

## Drop-in HTML

```html
<img
  src="assets/workbook-ai-banner-gpt.png"
  alt="영어 변형문제 생성기 작업 화면"
  class="workbook-visual"
>
```

## Drop-in CSS

```css
.workbook-visual {
  width: 100%;
  max-height: 360px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #d4dbe5;
}
```

## Original GPT Image Prompt: Banner

```text
Use case: productivity-visual
Asset type: website/app banner image for an English workbook and exam-question generator page
Primary request: Create a polished 16:9 landscape bitmap image showing a modern Korean study desk with printed English exam sheets, blank-answer lines, highlighted sentence fragments, and a clean laptop screen displaying abstract question cards and data panels.
Scene/backdrop: quiet classroom or teacher workroom desk, realistic but slightly stylized, organized and practical.
Subject: AI-assisted English workbook creation, passage stacking, repeated practice rounds, printable handouts.
Style/medium: premium editorial 3D illustration with realistic paper texture and crisp UI surfaces, not cartoonish.
Composition/framing: wide landscape, main laptop and papers centered, enough clean negative space around edges for cropping in a web page.
Lighting/mood: bright neutral daylight, focused, reliable, exam-prep atmosphere.
Color palette: white paper, deep teal accents, slate gray UI, small blue/orange highlights.
Text: no readable text, no letters that need to be accurate, only abstract lines and shapes.
Constraints: no logos, no watermarks, no brand names, no human faces, no messy clutter, no fantasy elements.
```

## Original GPT Image Prompt: Thumbnail

```text
Use case: productivity-visual
Asset type: square thumbnail image for an English workbook/problem-generator web app
Primary request: Create a clean square bitmap asset showing a neat stack of English exam papers, blank answer lines, small teal data nodes, and a compact AI dashboard card floating above the papers.
Scene/backdrop: simple light teacher desk surface, minimal background.
Subject: workbook creation, exam practice, question generation, printable handouts.
Style/medium: polished 3D editorial illustration with realistic paper texture, crisp edges, professional education-tool feeling.
Composition/framing: centered square composition, subject fully visible with generous padding, suitable for an app thumbnail or card image.
Lighting/mood: bright neutral studio daylight, calm and reliable.
Color palette: white, slate gray, deep teal, small blue/orange accents.
Text: no readable text, no logos, only abstract lines and interface marks.
Constraints: no watermark, no brand names, no human faces, no clutter, no fantasy elements.
```

## Claude Notes

- 기존 페이지에서는 `llm_problem_page.html`의 빈 미리보기 화면이 `workbook-ai-thumbnail-gpt.png`를 사용합니다.
- 배너를 상단에 넣을 때는 인쇄용 문제 영역 안보다 앱 소개/빈 상태/도움말 패널에 쓰는 편이 좋습니다.
- 문제지 출력물에는 이미지가 과하게 들어가면 인쇄 공간을 잡아먹으므로 기본 생성 결과에는 넣지 않는 것을 권장합니다.
