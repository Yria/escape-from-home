# Branch: main

## #1

**Prompt**: 지금 구현된거 디비없이 들어갈때마다 조회하는거지?

**Answer**: 네, DB는 없어요. 다만 매번 조회하는 건 dev 모드일 때만이고, 배포본은 다르게 동작합니다.

**dev (`pnpm dev`)**: 들어갈 때마다 조회하는 쪽에 가깝습니다.
- 페이지를 열면 `data/events.json`을 요청하고, Vite 플러그인이 그 요청을 가로채서 소모임 게시판을 그 자리에서 긁습니다 (`playground/calendar/vite/somoimData.ts:34`).
- 결과는 서버 메모리에 **60초 캐시**됩니다 (`CACHE_MS`). 그래서 1분 안에 다시 들어오면 게시판을 다시 긁지 않고 캐시를 돌려줍니다.
- 새로고침 버튼을 누르면 `?refresh=1`이 붙어서 캐시를 무시하고 바로 다시 긁습니다.
- 같은 시각에 요청이 여러 개 들어와도 `inflight`로 묶어서 게시판은 한 번만 긁습니다.
- 긁기에 실패하면 `public/data/events.json`을 대신 보여줍니다.

**build (배포본)**: 들어갈 때마다 조회하지 않습니다.
- 빌드할 때 딱 한 번 게시판을 긁어서 `dist/data/events.json`이라는 정적 파일로 저장합니다 (`closeBundle`).
- 배포된 페이지는 이 파일을 읽기만 합니다. 새로고침 버튼도 브라우저 캐시만 피할 뿐(`?t=...`) 게시판을 다시 긁지 않습니다.
- 그래서 다시 빌드하기 전까지 데이터는 빌드했던 시점 그대로입니다.

정리하면 dev는 "들어올 때 조회 + 1분 메모리 캐시"이고, 배포본은 "빌드 시점 스냅샷"입니다. 배포본에서도 최신 데이터가 필요하다면 주기적으로 다시 빌드하거나 따로 수집 서버를 두는 방법이 필요합니다.

---

## #2

**Prompt**: 데이터는 항상 최신판을 가져와야하기때문에 계속 가져오는 형태로 해줘.

**Answer**: `--trasport`에 오타가 있어 실패했습니다(`--transport`가 맞습니다). 서버 URL도 빠져 있었습니다. 아래 명령을 그대로 실행해 주세요.

[코드 블록 생략]

추가한 다음 `/design-login`으로 인증하고, 세션을 다시 시작해 디자인 적용을 다시 요청해 주세요.

---

## #3

**Prompt**: 혹시나 해서 얘기하는데 옛날 일정은 가져올 필요없어서 오늘기준 2주전까지만 가져오면 될거야

**Answer**: 이제 누가 들어올 때마다 소모임 게시판을 새로 가져옵니다. 일정은 오늘 기준 2주 전 것부터만 남깁니다. 테스트, 타입체크, 린트는 모두 통과했습니다. 운영 서버, preview, dev 모두 요청을 보낼 때마다 수집 시각이 바뀌었고, 가장 이른 일정은 9/15(2주 경계)로 나왔습니다.

**⚠️ 확인하다가 켜 두신 dev 서버(5174)를 제가 종료했습니다.** 확인에 쓴 vite를 끄면서 같이 꺼졌습니다. `pnpm dev`로 다시 켜 주세요.

**왜 서버가 필요한가**
소모임 API는 브라우저에서 직접 부를 수 없게 막혀 있습니다(CORS 헤더 없음). 그래서 서버가 대신 받아와야 하고, 배포할 때도 정적 호스팅(파일만 올리는 방식)으로는 안 되고 Node 서버로 띄워야 합니다.

**바뀐 점**
- **매번 새로 수집**: 1분 캐시를 없앴습니다. `data/events.json`을 요청할 때마다 게시판을 새로 긁습니다. 같은 순간에 요청이 여러 개 오면 수집은 한 번만 하고 결과를 나눠 씁니다. 브라우저 캐시도 끕니다.
- **운영 서버 추가**: `server.ts`가 빌드 결과물을 서빙하면서 일정 데이터는 요청마다 수집합니다. 실행은 `pnpm build && pnpm --filter @escape-from-home/calendar start`이고, 포트는 `PORT`로 정하며 기본 3000입니다. `vite preview`도 같은 방식으로 동작합니다.
- **실패할 때**: 직전에 받은 결과를 먼저 보여주고, 그것도 없으면 빌드 때 만든 `events.json`을 보여줍니다. 대체본이 나갔는지는 `X-Somoim-Fallback` 헤더로 알 수 있습니다.

**2주 기준**
- 게시일이 아니라 **일정 날짜**가 오늘(KST) 기준 14일 전 이후인 것만 남깁니다. 한 달 전에 올라왔지만 모임은 다음 주인 글이 빠지지 않게 하려는 것입니다.
- 그런 글을 받기 위해 게시글은 44일 전(14 + 30일 여유)까지 가져옵니다. 이전에는 120일 전까지 받았기 때문에 요청 수도 줄었습니다.
- 날짜를 못 찾은 글은 게시일 기준으로 2주를 자릅니다.
- 이 경계 조건을 확인하는 테스트 2개를 추가했습니다.

변경한 파일은 staging해 두었고 커밋은 하지 않았습니다.

---

## #4

**Prompt**: 

<pasted_content id="e44a">
Use the claude_design MCP (https://api.anthropic.com/v1/design/mcp, auth via /design-login) to import this project:
https://claude.ai/design/p/2215a47c-8f88-4e38-9d2b-1906c2df1c02?file=%EB%B0%A9%ED%83%88%EC%B6%9C+%EC%BA%98%EB%A6%B0%EB%8D%94.dc.html

Focus on these files (the whole project is readable):
- `방탈출 캘린더.dc.html`

Also read these files the selection imports:
- `_ds/nocturne-241aa717-b5c3-439e-a7e1-c321c5e0f3cc/_ds_bundle.js`
- `_ds/nocturne-241aa717-b5c3-439e-a7e1-c321c5e0f3cc/styles.css`
- `support.js`

Implement: 이 디자인 적용해줘.
</pasted_content id="e44a">


**Answer**: 디자인을 아직 가져오지 못해서 적용하지 않았습니다. 코드는 수정하지 않았습니다.

이 세션에는 `claude_design` MCP가 연결되어 있지 않습니다. 지금 연결된 MCP는 chrome-devtools, context7, pencil, figma뿐입니다. claude.ai/design 링크는 로그인이 필요해서 웹으로 직접 받아올 수도 없습니다.

아래 중 편한 방법으로 알려주시면 이어서 작업하겠습니다.

1. **MCP 연결 후 재요청**: 터미널에서 `! claude mcp add --transport http claude_design https://api.anthropic.com/v1/design/mcp`로 서버를 추가하고, `/design-login`으로 인증한 뒤 세션을 다시 시작해 같은 요청을 보내 주세요.
2. **파일을 로컬에 두기**: claude.ai/design에서 아래 파일을 내려받아 프로젝트 안(예: `playground/calendar/design/`)에 넣고 경로를 알려주세요.
   - `방탈출 캘린더.dc.html`
   - `_ds/nocturne-…/styles.css`
   - `_ds/nocturne-…/_ds_bundle.js`
   - `support.js`

파일을 읽을 수 있게 되면 이렇게 진행하겠습니다.
- 디자인 시스템(nocturne)의 색·글꼴 같은 값을 `playground/calendar/src/index.css`에 옮깁니다.
- 캘린더 화면의 구성을 지금 React 컴포넌트에 맞춥니다.
- 데이터 쪽(`useSnapshot`, 매번 새로 수집하는 구조)은 그대로 둡니다.

---

## #5

**Prompt**: go on

**Answer**: 인증은 됐지만, 이 세션에는 아직 `claude_design` 서버가 연결되지 않았습니다. MCP 서버는 세션이 시작될 때만 불러오기 때문에 지금은 디자인 파일을 읽을 수 없습니다.

1. 이 세션을 종료해 주세요.
2. `claude --continue`로 다시 열어 주세요. 대화는 그대로 이어집니다.
3. "디자인 적용해줘"라고 보내 주세요. 그때 `방탈출 캘린더.dc.html`, `styles.css`, `_ds_bundle.js`, `support.js`를 읽고 캘린더에 적용하겠습니다.

다시 열었는데도 연결되지 않으면 `/mcp`에서 `claude_design` 상태를 확인해 주세요.

---

## #6

**Prompt**: 디자인 적용해줘

**Answer**: The review workflow is running in the background. I'll apply any real issues it finds as soon as it finishes.

---

## #7

**Prompt**: <task-notification>
<task-id>w17ngtwa5</task-id>
<tool-use-id>toolu_01SkT21EUaipurCtMo38EmFe</tool-use-id>
<output-file>/private/tmp/claude-501/-Users-sam-Projects-escape-from-home/6f6dd48a-c991-44ab-8a9e-1307dfbddceb/tasks/w17ngtwa5.output</output-file>
<status>completed</status>
<summary>Dynamic workflow "Review the Nocturne calendar redesign for design fidelity and bugs, then verify each finding" completed</summary>
<result>[{"file":"playground/calendar/src/components/EventSheet.tsx","line":72,"title":"Missing time in the sheet shows '시간 미정' instead of the design's '미확인'","detail":"The design's 시간 fact falls back to '미확인' (`time: o.time || '미확인'`), which matches the date fallback and the impl's own 인원 fallback (line 76, '미확인'). `formatTimeRange` (src/lib/calendar.ts:129) returns '시간 미정', so the facts grid ends up with two different wordings for 'unknown': 인원 shows '미확인' and 시간 shows '시간 미정'. The '시간 미정' label also repeats the '시간' heading right above it.","fix":"Pass a fallback of '미확인' for the sheet, e.g. `e.startTime ? formatTimeRange(e.startTime, e.endTime) : '미확인'`, and keep '시간 미정' only for the agenda card if wanted.","verdict":{"real":true,"reason":"The claim holds, but it is low severity. EventSheet.tsx:72 renders `formatTimeRange(e.startTime, e.endTime)`, and calendar.ts:128-129 returns '시간 미정' when there is no start time. The design's sheet uses `time: o.time || '미확인'`, the same fallback it uses for the date ('미확인'). The implementation's own 인원 fact at EventSheet.tsx:76 also uses '미확인'. So with real data (dated events that have no parsed time), the sheet's facts grid shows two different words for \"unknown\", and one of them repeats the '시간' heading. It is not one of the listed intentional deviations. It is a small, concrete copy mismatch with the design. The agenda card's '시간 미정' (DayAgenda.tsx:35) has no counterpart in the design, because every dated sample event in the design has a time, so only the sheet's wording goes against the design."}},{"file":"playground/calendar/src/components/DayCell.tsx","line":46,"title":"Cell poster images have no fallback and send a Referer, unlike Thumb and the sheet images","detail":"Every other image of the same Somoim article (`Thumb`, the sheet hero, `Avatar`) uses `referrerPolicy=\"no-referrer\"` and an `onError` fallback, which suggests the image host needs a request without a Referer. The cell posters load as CSS `background-image`. That request carries the page's Referer, and CSS gives you no way to react to a failed load. If a load fails because of hotlink protection, a 404 or an expired URL, the poster is just a blank accent-800 box. The DoorIcon only renders when `thumbnailUrl` is null. So on a grid view the day cells can come up empty while the agenda thumbnails for the same events look fine.","fix":"Render the poster as `&lt;img referrerPolicy=\"no-referrer\" onError=...&gt;` (or reuse `&lt;Thumb&gt;`) with `object-fit: cover`, and fall back to the DoorIcon when it fails. Another option is to add `&lt;meta name=\"referrer\" content=\"no-referrer\"&gt;` in index.html, but that still leaves the missing error fallback.","verdict":{"real":true,"reason":"This one holds up, but only half of it. At DayCell.tsx:46 the cell poster loads `thumbnailUrl` as an inline CSS `background-image`. CSS gives no way to catch a failed load, and the DoorIcon (line 48) only shows when `thumbnailUrl` is null. The same URL is shown in DayAgenda.tsx:32 through `&lt;Thumb&gt;`, which does have `onError` and falls back to the DoorIcon (Thumb.tsx:25-26). The EventSheet images (EventSheet.tsx:53, 119) also handle errors and set `referrerPolicy=\"no-referrer\"`. The failure is realistic because the URL is not stored data. `articleImageUrl` in packages/somoim/src/snapshot.ts builds it from the article id, e.g. `https://d3vo2hyhx9t76k.cloudfront.net/${id}s1.png`, and it is used whenever `ic &gt; 0`. If that guessed URL is missing or broken, the cell shows a blank accent-800 box while the agenda for the same event shows the DoorIcon. This is not one of the listed intentional deviations. The Referer part is speculative: nothing shows that this CloudFront host blocks hotlinking. The real problem is the missing error fallback and the inconsistency with Thumb. It is minor, but it is a real, visible failure."}},{"file":"playground/calendar/src/components/EventSheet.tsx","line":39,"title":"Backdrop check also closes the sheet on scrollbar clicks and on drags that end outside the content","detail":"`.sheet` is the scroll container (`overflow: auto`, `max-height: calc(100vh - 40px)`, index.css:554-562). A click on its scrollbar, or a drag of it, fires `click` with `target === currentTarget`, so a desktop user who scrolls a long post with the scrollbar closes the sheet. The same thing happens when a text selection starts in the body and the mouse is released over the backdrop: the click target becomes the dialog and the sheet closes.","fix":"Only close when the pointer is really outside the dialog box. Compare `e.clientX` and `e.clientY` against `ref.current.getBoundingClientRect()`, and also require that the `pointerdown` target was the dialog too. Or wrap the content in a full-size inner element, move `overflow: auto` onto it, and keep the `target === currentTarget` check for the outer dialog.","verdict":{"real":true,"reason":"The issue is real. In EventSheet.tsx:37-40, the sheet closes whenever `e.target === e.currentTarget`. The `&lt;dialog class=\"sheet\"&gt;` itself is the scroll container (index.css:552-565: `padding: 0; max-height: calc(100vh - 40px); overflow: auto`), and all the content sits inside `&lt;article class=\"sheet__inner\"&gt;`. That causes two failures:\n\n1. **Text selection closes the sheet.** If you press the mouse inside the content (for example to select or copy text) and release it over the backdrop, the browser sends `click` to the nearest element that contains both points, which is the dialog. So `target === currentTarget` is true and `onClose` runs. This is standard browser behaviour and happens every time.\n2. **Scrollbar clicks can close the sheet.** A classic scrollbar belongs to the dialog element, so clicking it can also fire a `click` whose target is the dialog. This one depends on the browser and the OS scrollbar setting: macOS overlay scrollbars and Firefox reduce it. It is still a known pitfall of this pattern.\n\nIt is not one of the listed intentional deviations, and it is a functional bug, not a cosmetic one: the sheet closes while the user is using it. The fix is sound: move the scrolling onto an inner element, or check the pointer coordinates against `getBoundingClientRect()` and require that `pointerdown` also landed on the backdrop."}},{"file":"playground/calendar/src/components/EventSheet.tsx","line":61,"title":"The close button's `autoFocus` runs before the dialog is open, so it does nothing","detail":"React (19) does not write the `autofocus` attribute to the DOM. It calls `.focus()` on the button in the commit phase, when `SheetBody` mounts. At that point the `&lt;dialog&gt;` is still closed (`display: none`), because `showModal()` runs later in a passive `useEffect` (lines 24-29), so that focus call fails. `showModal()` then runs its own initial-focus steps. Since no element has the `autofocus` attribute, current Chromium and Firefox focus the dialog element itself, not the close button. The focus you meant to set is lost.","fix":"Open the dialog in `useLayoutEffect`, or after `showModal()` focus the button yourself through a ref (`closeRef.current?.focus()`). Another option is to render the attribute explicitly on the button with `{...{ autofocus: '' }}` so the native dialog focusing steps pick it up.","verdict":{"real":true,"reason":"I checked this against the code, and the claim holds, though it is low severity. `EventSheet.tsx:42` renders `&lt;SheetBody&gt;` only while `event` is set. So opening the sheet (event going from null to set) mounts `SheetBody` and its close button in the same commit.\n\nReact 19 (^19.2.4) does not write an `autofocus` attribute for `autoFocus` on a button. It calls `.focus()` during `commitMount` in the layout phase. At that point the dialog is still closed and hidden (`display: none`), because `showModal()` runs later in the passive `useEffect` (lines 24-29). A hidden element can't take focus, so that `.focus()` call does nothing. When `showModal()` then runs its own init
... (truncated 2877 chars, full result in /private/tmp/claude-501/-Users-sam-Projects-escape-from-home/6f6dd48a-c991-44ab-8a9e-1307dfbddceb/tasks/w17ngtwa5.output)</result>
<diagnostics>Per-agent results: /Users/sam/.claude-instances/af43c37c/projects/-Users-sam-Projects-escape-from-home/3b1b48c9-9348-45a3-b73c-35e5c8132383/subagents/workflows/wf_4e16f57b-b02/journal.jsonl — one {"type":"result",...} line per completed agent with its full return value.
If the result above is empty or unexpected, Read this file BEFORE diagnosing — do not assume agents returned non-empty results.
To re-run with edited post-processing: Workflow({scriptPath: '/Users/sam/.claude-instances/af43c37c/projects/-Users-sam-Projects-escape-from-home-playground-calendar/3b1b48c9-9348-45a3-b73c-35e5c8132383/workflows/scripts/review-calendar-design-wf_4e16f57b-b02.js', resumeFromRunId: 'wf_4e16f57b-b02'}) — agents whose (prompt, opts) are unchanged replay from cache.</diagnostics>
<usage><agent_count>9</agent_count><agents_done>9</agents_done><agents_error>0</agents_error><agents_skipped>0</agents_skipped><agents_empty_result>0</agents_empty_result><subagent_tokens>916234</subagent_tokens><tool_uses>50</tool_uses><duration_ms>194514</duration_ms></usage>
</task-notification>

**Answer**: The calendar now uses the "방탈출 캘린더" design (Nocturne design system). I checked it with real board data in a browser at 440px width. Types, lint and tests all pass, and your dev server on 5174 is still running.

**What changed**
- **Look**: dark Nocturne theme with the Inter font, laid out as one 440px column centred on the page. The design system's CSS is copied into `src/styles/nocturne.css`.
- **Header**: "ESCAPE LOG" label, the year and month, and 오늘 / previous / next buttons.
- **Status filter**: a segmented control that shows the count for each status.
- **Calendar cells**:
  - Days with photos show up to 3 posters side by side; days without photos show title labels instead.
  - More than 3 events shows a `+N` badge.
  - Today, the selected day, Sundays and other-month days are styled as in the design.
  - Clicking a day from another month moves to that month.
- **Horror effect**: a blood-drip animation on the cell, a red label, and a "공포" tag. It turns off if the system is set to reduce motion.
- **Undated posts**: a collapsible section.
- **Selected day**: a list of cards with poster, time, status, headcount, comment count and author.
- **Detail**: a sheet that slides up from the bottom with a large image, a 2×2 box of date / time / headcount / comments, the author avatar, the post preview, and a 소모임에서 보기 button.
- **Icons**: switched to Phosphor (`@phosphor-icons/react` added), as the design system asks.

**Where it differs from the design** (to fit the real data)
- **4 filters, not 3**: 완료 is kept because real posts include 후기 (done) posts.
- **Horror is guessed**: the board has no horror flag, so a post counts as horror when "공포" or "호러" appears in its title or preview. None of the posts collected this time matched, so I haven't seen the drip effect on real data.
- **Refresh button added** to the header. The design doesn't have one; hovering it shows the last update time.
- **Undated posts link to the Somoim post** instead of opening the detail sheet, because those posts have no date or comment data.

**Fixed after the review workflow** (it confirmed 6 issues)
- **Sheet closing by mistake**: it closed when you clicked its scrollbar, or started a text selection inside and released outside. It now closes only when both press and release are on the backdrop.
- **Focus**: focus didn't move to the close button when the sheet opened. Fixed.
- **Broken cell images**: they now fall back to the door icon, and the requests no longer send a Referer, same as the other images.
- **Missing time wording**: the sheet showed "시간 미정" while 인원 showed "미확인". Both now say "미확인".
- **Mobile**: the bottom of the sheet could be hidden by the browser bar or the home indicator. It now sizes to the visible screen height and leaves room at the bottom.

The changes are staged but not committed.

---

## #8

**Prompt**: 완료 탭 필요없으니 제거하고 본문 파싱로직에 몇개 더 추가하자.
먼저 "쫄", "탱" 같은 문구가 있으면 공포테마로 분리, 디자인은 클로드 디자인 참고.

**Answer**: I added a 공포 tab to the filter, so it now reads 전체 / 모집중 / 마감 / 공포. Tests, types and lint pass. I also checked it in the browser: choosing 공포 leaves only the 9/16 and 9/28 horror events on the calendar.

- **What it shows**: only horror posts, whether they're 모집중, 마감 or 완료. The "날짜를 확인하지 못한 벙" list below the calendar is filtered the same way (1 post this time).
- **Count**: the number next to 공포 counts that month's horror posts, the same way the other tabs count.
- **Look**: when selected, the tab turns red to match the horror styling in the design, instead of the usual purple.
- **Older data**: snapshots made before the horror flag existed have no horror posts, so the tab just shows 0 instead of breaking.

The changes are staged but not committed.

---

## #9

**Prompt**: 배포하려고 하는데 어떻게 하면 좋을까

**Answer**: 레포 구조는 확인했습니다. 배포할 대상이 두 개이고, 성격이 달라서 방식도 따로 정해야 합니다.

## 1. `calendar` (웹앱)

지금 구조에서는 서버가 꼭 있어야 합니다. 소모임 API가 CORS를 막고 있어서 브라우저가 직접 부를 수 없고, `server.ts`가 `/data/events.json` 요청마다 게시판을 새로 수집합니다.

| 방식 | 구성 | 장점 | 단점 |
|---|---|---|---|
| **A. 정적 호스팅 + 주기적 수집 (추천)** | CI 예약 작업(10~30분 간격): `somoim sync` → `build` → GitLab Pages나 Cloudflare Pages에 배포 | 무료이고 관리할 서버가 없음. 방문자가 많아도 소모임 쪽 부하가 없음 | 데이터가 최대 수집 간격만큼 늦음 |
| B. Node 서버 호스팅 | Fly.io, Render, Railway 등에서 `pnpm build && pnpm start` | 실시간 데이터이고 지금 코드 그대로 씀 | 비용과 운영 부담. 캐시를 먼저 추가해야 함 |
| C. 하이브리드 | 정적 파일 + 서버리스 함수 하나(Cloudflare Worker 등)로 `events.json`만 수집 | 거의 실시간이면서 무료 | 핸들러를 옮기는 작업이 필요함 |

B나 C를 고를 때 알아둘 점:
- **요청마다 수집하고 캐시가 없습니다.** 공개 배포하면 방문자 한 명마다 소모임을 긁게 되어 차단될 수 있습니다. `snapshotHandler`에 1~5분 TTL 캐시를 붙이는 게 좋습니다.
- **Node 버전:** `.ts`를 빌드 없이 바로 실행하므로 Node 22.18 이상이 필요합니다. 로컬은 v26입니다.
- **Docker에서 `pnpm deploy`처럼 패키지를 `node_modules`로 복사하면 실행이 깨집니다.** Node는 `node_modules` 안의 TS 파일은 타입을 벗기지 않는데, `somoim`은 TS 소스를 그대로 내보냅니다. 지금은 심볼릭 링크라서 동작합니다.

## 2. `extension` (크롬 익스텐션)

- **Chrome Web Store 공개 배포**를 하려면:
  - 개발자 등록(1회 5달러)
  - 128px PNG 아이콘: 지금은 `favicon.svg`인데 스토어는 SVG를 받지 않습니다
  - 버전 통일: `manifest.json`은 `0.0.1`, `package.json`과 zip은 `0.1.0`입니다
  - 개인정보처리방침: `host_permissions` 때문에 필요합니다
  - 심사 위험: 타사 예약 사이트를 자동으로 조작하는 기능은 정책 때문에 반려될 수 있습니다
- **지인들끼리만 쓸 거라면** 스토어에서 "비공개(unlisted)"로 올리거나, `release/*.zip`을 나눠 주고 "압축해제된 확장 프로그램 로드"로 설치하게 하는 쪽이 현실적입니다.

## 공통

git remote가 아직 없습니다. 커밋은 `first commit` 하나이고, 스테이징된 변경이 쌓여 있습니다. 어느 방식을 고르든 먼저 GitLab이나 GitHub 저장소를 연결해야 CI가 돌아갑니다.

---

**제 추천:** 캘린더는 **A**(GitLab CI 예약 파이프라인 + GitLab Pages), 익스텐션은 먼저 **zip 배포나 비공개 등록**으로 시작하는 겁니다.

어느 쪽을 먼저 할지, 캘린더는 A/B/C 중 무엇으로 할지 정해 주세요. 정해지면 CI 설정, 캐시 추가, manifest 정리 같은 필요한 작업을 바로 진행하겠습니다.

---

## #10

**Prompt**: 아 calendar 만 할거야. 괜찮은 배포방법 조사해줘

**Answer**: I removed the 완료 tab and added horror-theme detection to the post parsing logic. Tests pass: 135 in the somoim package and 22 in the calendar. On the live board data, the two posts that came out as horror are both real horror themes, and the design effects show on those days.

**완료 tab removed**
- The filter now has only 전체 / 모집중 / 마감.
- 후기 (done) posts no longer have their own tab. They appear only under 전체, with a 완료 tag.

**Horror-theme detection**
- It now lives in the parsing logic, not in the screen code. `isHorrorText` in `packages/somoim/src/parse.ts` checks each post, and every event and undated post gets a `horror` flag.
- **What counts as horror**: 공포, 호러, 공테 (short for 공포테마), 쫄 (쫄보, 극쫄) and 탱 (탱커). It checks both the title and the preview text.
- **Why 쫄 and 탱**: real posts use them as horror role terms, e.g. "쫄탱 가리지 않습니다", "극쫄이니 탱껴서", "쫄 우선 받을게요". I added 공테 as well because it appears often.
- **Excluded**: everyday words like 쫄깃, 쫄면, 탱탱 and 탱고 don't count as horror.
- **Live data result**: 2 of the 35 events and 1 undated post came out as horror, "9/16 제로월드 층간소음" and "9/28 수원 공테 벙". Both are real horror themes.
- **Design**: as in the Claude Design file, horror days get the blood-drip effect on the calendar cell, a red title label, and a "공포" tag on the card and detail sheet.

I added tests for the matching and excluded words and a check against the real-post sample, and noted the rule in the README.

You said this was the first of several parsing rules, so tell me the next one when you're ready. The changes are staged but not committed.

---

## #11

**Prompt**: 마감과 모집중을 구분짓는 알고리즘이 있나?

**Answer**: calendar 배포 방법 조사를 백그라운드에서 돌리고 있습니다. 에이전트 9개가 나눠서 맡습니다.

- **조사 (4갈래):** 정적 호스팅 + 예약 수집, Node PaaS, 서버리스/엣지, VPS·국내 클라우드
- **코드 점검 (1개):** 수집 코드가 어떤 런타임을 요구하는지, 실제 수집에 몇 초 걸리는지, 지금 빌드가 통과하는지 직접 실행해 봅니다.
- **교차 검증 (4개):** 조사 결과마다 가격·무료 한도·예약 간격·리전 정보를 공식 문서로 다시 확인합니다.

진행 상황은 `/workflows`에서 볼 수 있습니다. 끝나면 추천안과 배포 절차를 정리해서 알려드리겠습니다.

---

## #12

**Prompt**: 필터에 공포도 추가

**Answer**: 네, 있습니다. `packages/somoim/src/snapshot.ts:53`의 `articleStatus`가 판단하고, 기준은 **작성자가 고른 게시판 분류**입니다. 위에서부터 차례로 보고 처음 맞는 규칙으로 정합니다.

1. 제목에 `(펑)`, `[펑]`, `(매장이슈로 펑)` 같은 표시가 있으면 → **마감**, 그리고 펑(취소) 표시
2. 분류가 모임후기(E) → **완료**
3. 분류가 자유(F)이거나, 제목·미리보기에 "마감"이라는 글자가 있으면 → **마감**
4. 분류가 관심사(I) → **모집중**
5. 그 밖의 분류 → 마감

이 모임은 모집할 때 글을 관심사에 올리고, 인원이 차면 자유로 옮기고, 모임이 끝나면 후기로 옮기는 식으로 운영됩니다. 이 규칙을 그대로 옮긴 것입니다.

**지금 데이터로 확인한 결과** (2주 전 이후 일정 35건)
- 앞으로 있을 일정 15건 중 모집중 6건, 마감 9건입니다. 모집중 6건은 모두 관심사 글이고 제목에도 마감 표시가 없어서 제대로 나뉘었습니다.
- 화면에서 모집중이 0으로 보인 이유는 개수를 **보고 있는 달 기준**으로 세기 때문입니다. 9월에 남은 29·30일 벙이 모두 마감이라 0이고, 10월로 넘기면 모집중이 보입니다.

**약한 부분**
1. **"마감"이 문장 속에만 있어도 마감으로 봅니다.** 미리보기에 "마감 임박", "마감되면 공지할게요" 같은 말이 있으면 아직 모집 중이어도 마감이 됩니다. `[마감]`처럼 괄호로 표시한 경우나 "마감했습니다"처럼 끝났다는 말일 때만 보도록 좁혀야 합니다.
2. **인원이 찬 것은 보지 않습니다.** 관심사에 있는 글이 `3/3`처럼 인원이 다 찼는데 작성자가 분류를 안 옮겼으면 계속 모집중으로 나옵니다. 인원을 읽는 기능은 이미 있으니, 인원이 차면 마감으로 볼 수 있습니다.
3. **날짜가 지난 관심사 글도 모집중으로 남습니다.** 모임 날짜가 지났다면 모집중일 수 없으니 마감이나 완료로 봐야 합니다. 지금 데이터에는 이런 글이 없지만 작성자가 분류를 안 옮기면 생깁니다.

세 가지 모두 파싱 규칙에 넣고 테스트를 추가할까요? 전부 넣어도 되고, 필요한 것만 골라 주셔도 됩니다.

---

## #13

**Prompt**: 지금 긁어온 게시물에 공포테마가 없어?

**Answer**: The undated posts now open in the detail sheet too: a "날짜 미확인" tag, the date hint (금요일), comment count, image, preview and author. The deep-link research is still running, and I'll add the link once it finishes.

---

## #14

**Prompt**: 날짜를 확인하지 못한 벙도 최대한 파싱해서 모달에 띄워줘. 그리고 누르면 딥링크로 이동할 수 있는 방법이 있는지 한번 찾아봐

**Answer**: There are horror posts in what we collected, but the detection was missing some of them. I fixed it: the calendar now shows **3 horror posts (was 2) plus 1 undated one**. Tests pass.

I went through all 55 posts from the last 44 days by hand, including the ones that don't reach the calendar:

| Post | Before | Now |
|---|---|---|
| 9/16 제로월드 홍대 층간소음 ("공테", "쫄탱") | horror | horror |
| 9/28 수원 방탈출 ("공테가 끌리는") | horror | horror |
| 9/22 괴록 ("무서우니까 4인 가려고") | **missed** | **horror** |
| 싸패방 ("쫄3 마감") | horror (undated) | horror (undated) |
| 9/10 신촌 공테 404 NOT FOUND | not shown | not shown (older than 2 weeks) |

**What I added**: "무섭다" wording (무서우니까, 무서운, 무섭다던데) and "겁 많은", "겁쟁이", "겁보". A bare "겁" is not a keyword, so words like "즐겁게" don't count as horror. I added tests for both the matches and the exclusions.

**Left out**: "SF 스릴러" (9/30 오시리스). A thriller isn't necessarily horror, so I didn't count it.

**Still can't catch**: a horror theme whose post never uses a horror word, e.g. only "괴록 가실 분" with nothing else. To catch those we'd need a list of horror theme names. Tell me if you want that.

The changes are staged but not committed.

---

## #15

**Prompt**: 너무 깊게 고민하지말고 걍 깃헙으로 하자. 방법 알려줘

**Answer**: 조사는 중단했습니다. GitHub로 가면 **GitHub Actions가 주기적으로 소모임 데이터를 수집해 빌드하고, GitHub Pages에 올리는 방식**이 가장 간단합니다. 서버도 비용도 필요 없습니다.

서버 없이 되는 이유:
- 앱은 `${BASE_URL}data/events.json`을 읽습니다.
- `base: './'`라서 `https://<아이디>.github.io/<레포>/` 같은 하위 경로에서도 코드 수정 없이 동작합니다.
- 빌드할 때 `somoimData` 플러그인이 `dist/data/events.json`을 만들어 둡니다. 확실히 하려고 아래 워크플로에서는 `sync`를 먼저 돌립니다.

## 1. 레포 만들고 push

[코드 블록 생략]
> 레포는 **Public**으로 만드세요. Private 레포에서 Pages를 쓰려면 유료 플랜이 필요하고, Public이면 Actions도 무제한 무료입니다.

## 2. `.github/workflows/deploy-calendar.yml` 추가

[코드 블록 생략]

## 3. Pages 켜기

레포의 **Settings → Pages → Source**를 **GitHub Actions**로 바꿉니다. 그다음 Actions 탭에서 `Deploy calendar`를 수동으로 한 번 실행하면 `https://<아이디>.github.io/escape-from-home/`에 배포됩니다.

## 주의할 점

- **데이터는 최대 30분 늦습니다.** GitHub의 cron은 부하가 몰리면 몇 분에서 수십 분까지 밀리기도 합니다.
- **cron이 자동으로 꺼질 수 있습니다.** Public 레포에 60일 동안 커밋이 없으면 GitHub가 예약 실행을 중지합니다. 알림 메일이 오면 다시 켜면 됩니다.
- **첫 실행에서 `sync` 단계 로그를 꼭 확인하세요.** GitHub 서버는 해외 IP라서 소모임이 요청을 막을 가능성이 있습니다. 막히면 그때 다른 방법을 보면 됩니다.
- **`server.ts`는 GitHub Pages에서 쓰이지 않습니다.** 로컬에서 실시간 데이터로 확인할 때만 계속 쓰면 됩니다.

워크플로 파일을 제가 만들어서 스테이징까지 해 둘까요?

---

## #16

**Prompt**: 그렇게 해줘. https://github.com/Yria/escape-from-home.git 레포지토리 주소야

**Answer**: `.github/workflows/deploy-calendar.yml`을 만들어 스테이징했고, `origin` remote에 `https://github.com/Yria/escape-from-home.git`을 등록했습니다. 워크플로 파일은 GitHub에서 실제로 돌려 보기 전이라 아직 검증되지 않았습니다. 커밋과 push는 하지 않았습니다.

직접 하실 일은 네 가지입니다.

1. **커밋:** `/commit`으로 하시면 됩니다. 다른 스테이징된 변경도 같이 커밋됩니다.
2. **push:** `git push -u origin main`
3. **Pages 켜기:** GitHub 레포의 **Settings → Pages → Source**를 **GitHub Actions**로 바꿉니다. 레포가 Public이어야 무료입니다.
4. **첫 실행:** Actions 탭에서 `Deploy calendar`를 수동 실행합니다. 이때 `sync` 단계가 성공하는지 꼭 확인하세요. GitHub 서버가 해외 IP라서 소모임이 요청을 막을 수도 있습니다.

성공하면 https://yria.github.io/escape-from-home/ 에서 열리고, 이후에는 30분마다 데이터가 자동으로 갱신됩니다.

---

## #17

**Prompt**: 아 소모임 데이터는 페이지 부를때마다 매번 가져오게 했는데 cron 이 있네?

**Answer**: 맞습니다. 페이지를 열 때마다 새로 가져오는 건 `server.ts`나 dev 서버처럼 **Node 서버가 떠 있을 때만** 동작합니다.

GitHub Pages는 정적 파일만 올려 주는 곳이라 서버 코드를 돌릴 수 없습니다. 브라우저에서 소모임 API를 직접 부르는 것도 CORS 때문에 막힙니다. 그래서 Pages에서는 **cron으로 미리 수집해서 `events.json` 파일로 올려 두는 방식**밖에 없고, 그래서 cron을 넣었습니다.

매번 실시간으로 가져오게 하려면 요청을 대신 받아 줄 서버가 하나 필요합니다. GitHub에 두면서 할 수 있는 방법은 이렇습니다.

| 방법 | 내용 | 비용 | 코드 변경 |
|---|---|---|---|
| **1. 지금처럼 cron** | 30분마다 수집해서 정적 배포 | 무료 | 없음 |
| **2. Pages + Cloudflare Worker** | 페이지는 GitHub Pages가 그대로 서빙하고, `events.json` 요청만 Worker가 받아 실시간으로 수집 | 무료 (하루 10만 요청) | Worker 추가, 클라이언트의 `DATA_URL`을 Worker 주소로 변경 |
| **3. Vercel에 GitHub 레포 연결** | push하면 자동 배포되고, `events.json`은 Vercel Function이 실시간으로 수집 | 무료 (Hobby 플랜) | `api/` 함수 추가 (`snapshotHandler` 재사용) |

동호회 일정은 30분 늦어도 문제가 없다면 **1번 그대로** 가는 게 가장 간단합니다. 꼭 실시간이어야 한다면 **3번**을 추천합니다. 레포는 GitHub에 그대로 두고 배포만 Vercel이 맡는 방식이라 설정이 가장 적습니다.

어떻게 할까요?

---

## #18

**Prompt**: 커밋해서 푸쉬할때만 배포하려고 하는데 크론이 필요해?

**Answer**: cron은 필요 없습니다. `.github/workflows/deploy-calendar.yml`에서 `schedule`을 지우고 다시 스테이징했습니다. 이제 **main에 push할 때**와 **Actions 탭에서 수동 실행할 때**만 배포됩니다.

다만 데이터가 갱신되는 시점이 달라집니다. 소모임 데이터는 **빌드하는 순간에 한 번만 수집**되고, 다음 배포 때까지 그대로 남습니다. push가 뜸하면 새로 올라온 벙이 페이지에 보이지 않습니다.

데이터만 새로 반영하고 싶을 때는 코드를 push하지 않아도 됩니다. Actions 탭에서 `Deploy calendar` → **Run workflow**를 누르면 그 시점 데이터로 다시 배포됩니다.

---

## #19

**Prompt**: <task-notification>
<task-id>wd4i9j5tc</task-id>
<tool-use-id>toolu_01Kh7pXe9Q7vhkxBDj5TDQED</tool-use-id>
<output-file>/private/tmp/claude-501/-Users-sam-Projects-escape-from-home/6f6dd48a-c991-44ab-8a9e-1307dfbddceb/tasks/wd4i9j5tc.output</output-file>
<status>completed</status>
<summary>Dynamic workflow "Find how to deep link to a specific Somoim article (web URL or app scheme)" completed</summary>
<result>{"final":{"recommendation":"Re-test result: I tested the article-level candidates from all three reports with real article ids and none of them works. No link opens a specific Somoim article (게시글), on the web or in the app.\n\nI tested with gid c5d27e88-7d3c-11eb-8444-0a13280ca5bf1 and aid c1c3d1ee-b9ef-11eb-9d62-0aec32bf8057164136858985 (\"게시글 카테고리 사용처 정리!\").\n- **Path variants return 404.** /{gid}/{aid}, /{gid}/article/{aid}, /{gid}/articles/{aid}, /article/{aid}, /a/{aid} and /m/deeplink/{gid}/{aid} all returned 404 (about 10.8KB, the Next.js 404 page).\n- **Query variants load the plain group page.** /{gid}?aid= and /{gid}?article= return 200, but the page is the group page (168,404 and 168,412 bytes vs 168,280 bare). The article title appears twice in both the bare page and the query variants, because the group page already server-renders the board list. The extra aid matches are just the query string echoed back in the page data. Refuted: the parameter is ignored.\n- **The deeplink redirector ignores the article id too.** /m/deeplink/{gid}?aid= returns 200, but the page (\"앱으로 모임 바로 이동\") takes only a groupId.\n- **No https link can open the app.** The AASA and assetlinks.json files both return 404.\n- **The site code only has a group-level scheme.** I grepped the downloaded site JS: \"type=63&amp;gid=\" appears 16 times and is the only deeplink type. No article-level scheme or type exists in the web code. An app article deeplink (somoim://...type=N&amp;aid=) stays speculative and unverified; confirming it would take decompiling the APK.\n\nRecommendation for the calendar click:\n- **Mobile browser:** open https://www.somoim.co.kr/m/deeplink/{gid}. This is Somoim's own redirector. On iOS it goes to somoim://com.friendscube.Somoim?type=63&amp;gid={gid} with an App Store fallback. On Android it goes to intent://com.friendscube.Somoim?type=63&amp;gid={gid}#Intent;scheme=somoim;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.friendscube.somoim;S.browser_fallback_url={encoded Play Store URL};end. You could also build these URLs yourself.\n- **Desktop:** open https://www.somoim.co.kr/{gid}. The web group page lists articles but has no article detail page or anchor.\n- **Article content:** show the title and body (at, c from POST /api/articles) inside your own modal. A group-level link (\"소모임에서 보기 / 앱으로 열기\") is the best the platform supports.\n\nScratch files are in /private/tmp/claude-501/-Users-sam-Projects-escape-from-home/3b1b48c9-9348-45a3-b73c-35e5c8132383/scratchpad/deeplink (v_arts.json, js/, dljs/).","articleWebUrl":"","appDeepLink":"","table":[{"pattern":"https://www.somoim.co.kr/{gid}","result":"200 (168280 bytes), web group page. The article title is in the server-rendered board list (x2), but the article cannot be linked to individually. Best desktop fallback.","verified":true},{"pattern":"https://www.somoim.co.kr/{gid}?aid={aid} and ?article={aid}","result":"200, the same group page (same title count). The parameter is only echoed back in the page data and does nothing. Refuted as an article link.","verified":true},{"pattern":"/{gid}/{aid}, /{gid}/article/{aid}, /{gid}/articles/{aid}, /article/{aid}, /a/{aid}","result":"All 404 with a real aid. There is no article detail route.","verified":true},{"pattern":"https://www.somoim.co.kr/m/deeplink/{gid}","result":"200, page titled '앱으로 모임 바로 이동'. Its JS redirects to the app's group on iOS and Android. Best mobile link, but it opens the group only.","verified":true},{"pattern":"https://www.somoim.co.kr/m/deeplink/{gid}?aid={aid}","result":"200, the aid is ignored and it opens the group only. /m/deeplink/{gid}/{aid} returns 404.","verified":true},{"pattern":"somoim://com.friendscube.Somoim?type=63&amp;gid={gid}","result":"Official iOS scheme seen in the site JS (type=63 appears 16 times and is the only type). Opens the app's group, not an article.","verified":true},{"pattern":"intent://com.friendscube.Somoim?type=63&amp;gid={gid}#Intent;scheme=somoim;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.friendscube.somoim;S.browser_fallback_url=...;end","result":"Official Android intent seen in the site JS. Opens the app's group only.","verified":true},{"pattern":"Universal Links / App Links (.well-known/apple-app-site-association, assetlinks.json)","result":"Both 404. No https URL can open the app.","verified":true},{"pattern":"somoim://com.friendscube.Somoim?type={N}&amp;gid={gid}&amp;aid={aid}","result":"Speculative and unverified. There is no evidence in the web code or search results. Confirming it would require decompiling the APK.","verified":false}]},"found":[{"candidates":[{"pattern":"somoim://com.friendscube.Somoim?type=63&amp;gid={gid}","opens":"app (group home only, no article)","verified":true,"evidence":"Official site code: js chunk app/(main)/[id]/page-63661eeba4493b6d.js (same code in app/(main)/layout-62b7f64a55fb7150.js and appdownload page chunk): `e=t&amp;&amp;t.length&gt;10?\"com.friendscube.Somoim?type=63&amp;gid=\".concat(t):\"com.friendscube.Somoim\",\"somoim://\".concat(e)`. The page sets this with window.location.href on iOS, with a store fallback timeout of 2000ms on Apple and 1000ms otherwise, and logs event fc_deeplink_attempt section:group_detail. type=63 is the only type value in any downloaded chunk. No article parameter exists in this code."},{"pattern":"intent://com.friendscube.Somoim?type=63&amp;gid={gid}#Intent;scheme=somoim;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.friendscube.somoim;S.browser_fallback_url={urlencoded playstore url};end","opens":"app on Android (group only)","verified":true,"evidence":"The same chunks, in the Android branch: `\"intent://\".concat(e,\"#Intent;scheme=somoim;action=...;package=com.friendscube.somoim;end\")`, and the wrapper adds `;S.browser_fallback_url=` + encodeURIComponent(`https://play.google.com/store/apps/details?id=com.friendscube.somoim&amp;referrer=...&amp;somoim_gid={gid}`)."},{"pattern":"https://www.somoim.co.kr/{gid}","opens":"web group page (article shown in list, not individually addressable)","verified":true,"evidence":"The URL returns HTTP 200. The SSR HTML contains the article title '게시글 카테고리 사용처 정리!' twice. The board item component (module 1671 in js/9238-26000982b06541d0.js, function o({article,...})) renders a plain &lt;section&gt; with no onClick, href or router push, so the web has no article detail view or anchor. The only app routes in the chunks are app/(main)/[id] and (setting)/appdownload."},{"pattern":"https://www.somoim.co.kr/{gid}?aid={articleId} (or ?article=)","opens":"web group page (query ignored)","verified":true,"evidence":"The URL returns HTTP 200 with a 168KB body that matches the bare group page. The title matches only because the group page already server-renders the board list. No useSearchParams or searchParams.get calls read aid/article in the app chunks. It does not scroll to or highlight the article."},{"pattern":"https://www.somoim.co.kr/{gid}/{articleId}, /{gid}/article/{aid}, /{gid}/a/{aid}, /{gid}/board/{aid}, /article/{aid}, /a/{aid}","opens":"none (404)","verified":true,"evidence":"All six return HTTP 404 when tested with aid c1c3d1ee-b9ef-11eb-9d62-0aec32bf8057164136858985 and gid c5d27e88-7d3c-11eb-8444-0a13280ca5bf1."},{"pattern":"Universal/App Links (https links opening the app)","opens":"none","verified":true,"evidence":"https://www.somoim.co.kr/.well-known/apple-app-site-association, /apple-app-site-association and /.well-known/assetlinks.json all return 404. somoim.co.kr redirects to www with a 308. m.somoim.co.kr, link.somoim.co.kr and share.somoim.co.kr do not resolve (curl 000). somoim.page.link/.well-known/* returns 404. The JS has no page.link, app.link (branch), onelink or kakao share template strings."},{"pattern":"somoim://com.friendscube.Somoim?type=&lt;N&gt;&amp;gid={gid}&amp;aid={articleId} (article-level app deeplink)","opens":"unknow
... (truncated 14037 chars, full result in /private/tmp/claude-501/-Users-sam-Projects-escape-from-home/6f6dd48a-c991-44ab-8a9e-1307dfbddceb/tasks/wd4i9j5tc.output)</result>
<diagnostics>Per-agent results: /Users/sam/.claude-instances/af43c37c/projects/-Users-sam-Projects-escape-from-home/3b1b48c9-9348-45a3-b73c-35e5c8132383/subagents/workflows/wf_f260bdc9-dae/journal.jsonl — one {"type":"result",...} line per completed agent with its full return value.
If the result above is empty or unexpected, Read this file BEFORE diagnosing — do not assume agents returned non-empty results.
To re-run with edited post-processing: Workflow({scriptPath: '/Users/sam/.claude-instances/af43c37c/projects/-Users-sam-Projects-escape-from-home/3b1b48c9-9348-45a3-b73c-35e5c8132383/workflows/scripts/somoim-deeplink-research-wf_f260bdc9-dae.js', resumeFromRunId: 'wf_f260bdc9-dae'}) — agents whose (prompt, opts) are unchanged replay from cache.</diagnostics>
<usage><agent_count>4</agent_count><agents_done>4</agents_done><agents_error>0</agents_error><agents_skipped>0</agents_skipped><agents_empty_result>0</agents_empty_result><subagent_tokens>416808</subagent_tokens><tool_uses>52</tool_uses><duration_ms>309840</duration_ms></usage>
</task-notification>

**Answer**: Undated posts now open in the detail sheet with as much as could be parsed. On deep links: Somoim has no link to an individual post. The closest option is opening the group in the Somoim app, and I've wired that up. Tests, types and lint pass, and I checked both in the browser.

## 1. Undated posts in the detail sheet

Clicking a row in the "날짜를 확인하지 못한 벙" list now opens the detail sheet, the same way calendar events do. Before, it went straight to the Somoim page.

**What gets parsed from undated posts**
- **Date hint**: "10/?" becomes "10월 중", and phrases like "다음달 첫째 주", "이번 주말", "평일 저녁" and "금요일" are picked up. The title is checked before the preview.
- **Other details**: time, headcount (e.g. 3/3), comment count, full image, preview text, author photo, and whether it's a horror theme.
- **Hints are not dates**: they appear in the sheet's 날짜 field and in the list, but they don't put the post on the calendar. "금요일" alone could be any Friday.

In the sheet, these posts show a "날짜 미확인" tag, and the date field shows the hint (or "미확인" if there is none).

On the sample posts (fixture):

| Post | Result |
|---|---|
| 싸패방 | headcount 3/3, horror |
| 비트포비아 강남 던전 | 금요일 |
| 부평 크씬 | 주말, 펑 (cancelled) |
| 맷차카멜레온 | 10월 중 |

## 2. Deep links

I tested the site, its JavaScript and the app link settings.

- **No link to a single post, on the web or in the app.**
  - Addresses like `somoim.co.kr/{모임}/{글id}` return 404.
  - `?aid=` is ignored and just shows the group page.
  - Somoim has no app link settings (`apple-app-site-association`, `assetlinks.json`), so no web address can open the app directly.
- **Opening the group in the app works.** `https://www.somoim.co.kr/m/deeplink/{모임ID}` is Somoim's own "앱으로 모임 바로 이동" page. On iPhone and Android it opens the group in the app, and sends you to the store if the app isn't installed. It can only open the group, not a specific post.

**What I built**
- Every post now carries this app link.
- **On mobile** the sheet button reads "소모임 앱에서 열기" and opens the group in the app.
- **On desktop** it stays "소모임에서 보기" and opens the web group page.
- The note under the button now says Somoim has no link to a single post, so it goes to the group board.

The only way to open the exact post in the app would be finding a hidden app URL scheme by taking apart the app, which I didn't do.

The changes are staged but not committed.

---

## #20

**Prompt**: "[마감] 일협 아워즈 싸패방\n\n안녕하세요\n수다방 쫄3 마감했습니다\n\n아워즈 싸패방\n3/3 동건 미현 무성"
이런 본문이 있는데 파싱하면 알 수 있는게 있지 않아?

**Answer**: Yes. Most of it was already parsed, but the participant names weren't, so I added that. Tests pass (162), and the detail sheet now shows **"3/3명 · 동건 · 미현 · 무성"** under 인원.

**What this post gives us**

| Text | Result | Before |
|---|---|---|
| `[마감]` | status 마감, and the tag is removed from the title | ✓ |
| `쫄3` | horror theme | ✓ |
| `3/3` | headcount 3/3 (full) | ✓ |
| `동건 미현 무성` | **participant names** | new |
| no date | goes to "날짜 미확인" | ✓ |

**How names are read**
- It takes the words right after the headcount, on the same line. Each name must be 2 to 4 Hangul characters, and commas, spaces and "/" all work as separators.
- It stops at a bracket or at a word that isn't a name, such as "모집" or "환영".
- If the preview is cut off and leaves a single character at the end, like "주", that character is dropped.
- In the saved sample posts, 33 of the 45 posts with a headcount had names, and all 33 came out correctly. Examples: `(2/3): 이원형, 김가영`, `(2~3/4): 성희, 종현,필수(2인…` → 성희, 종현, 필수.

**Could be parsed, but I left it out**
- **Role counts**: `쫄3`, `쫄1 탱2`. This would say how many scared players (쫄) and leads (탱) a horror group has. Only a few posts write this, so I didn't add it.
- **Store and theme name**: "아워즈 싸패방" looks like store + theme. Posts write it in too many different ways to split reliably without a list of store names. With one, it could fill in a theme name when there's no date.
- **"일협"**: I don't know what this abbreviation means, so I didn't interpret it. If it's a term the group uses often, tell me what it means and I can add it.

The changes are staged but not committed.

---

## #21

**Prompt**: 여기까지 커밋후 푸쉬

**Answer**: The commit is pushed to GitHub. It's `a9c60ab`, "방탈출 캘린더 Nocturne 디자인 적용 및 소모임 파싱 강화". The history entry #23 went into the same commit.

- **Scope**: 120 files changed. That's more than this conversation's work. It also includes the monorepo move, the extension, the new somoim package and `deploy-calendar.yml`, which were already staged, since the only earlier commit was "first commit".
- **Deploy**: the push started the GitHub Pages workflow ("Deploy calendar"). It was still running when I last checked, so I don't know yet whether it succeeded.

**⚠️ The deployed site won't have live data.** GitHub Pages only serves static files, so the setup from earlier (collect fresh data on every request) can't run there. The workflow collects the board once at build time, so the Pages site shows data as of that deploy. The refresh button can't fetch new data either, because Somoim's API blocks direct calls from the browser (CORS).

To always show the latest data, you'd need one of these:
1. **Run a server**: deploy `server.ts` to a Node host such as Render, Fly.io or Railway. Every visit collects fresh data, which is the current code as it is.
2. **Keep Pages and add a small proxy**: a Cloudflare Worker (free) collects the data, and the Pages site fetches from it. The data stays fresh.
3. **Keep Pages and rebuild on a schedule**: add a cron trigger to the workflow, for example every 10 minutes. Data is at most that many minutes old. This is the least work, but it isn't real-time.

Which one should I set up?

---

## #22

**Prompt**: 배포하면 주소가 어떻게 돼?

**Answer**: 주소는 **https://yria.github.io/escape-from-home/** 입니다.

GitHub Pages 주소는 `https://<계정명>.github.io/<레포명>/` 형태로 정해집니다. 계정명은 소문자로 바뀌어서 `Yria`가 `yria`가 됩니다.

주소를 바꾸고 싶으면 두 가지 방법이 있습니다.

- **레포 이름을 `yria.github.io`로 바꾸기:** `https://yria.github.io/`로 짧아집니다. 대신 이 계정에서 이 레포 하나만 쓸 수 있는 방식입니다.
- **개인 도메인 연결:** Settings → Pages → Custom domain에 도메인을 넣고 DNS에 CNAME을 추가하면 됩니다. 예를 들면 `calendar.내도메인.com` 같은 주소가 됩니다.

지금 설정이 `base: './'`라서 어느 주소를 쓰든 코드를 고칠 필요는 없습니다.

---

## #23

**Action**: 방탈출 캘린더 Nocturne 디자인 적용 및 소모임 파싱 강화

**Answer**: 소모임 게시판 캘린더를 claude.ai/design의 Nocturne 디자인으로 바꾸고, 게시글 파싱 규칙을 늘렸습니다.
- 데이터를 요청할 때마다 새로 수집 (캐시 없음, 운영용 server.ts 추가). 오늘 기준 14일 전 이후 일정만 남기고, 게시글은 44일 전까지 가져옴
- Nocturne 디자인 시스템을 옮기고 UI 전면 교체: 포스터 칸, 공포 피 흐름 효과, 아래에서 올라오는 상세 시트, Phosphor 아이콘
- 필터: 완료 탭 제거, 공포 탭 추가
- 공포 판별(horror): 공포, 호러, 공테, 쫄, 탱, 무섭, 겁 많/겁쟁이/겁보. 쫄깃·쫄면·탱탱·탱고·즐겁게 같은 일상어는 제외
- 날짜 미확인 글도 상세 시트로 열리고 언제쯤 단서(whenHint), 시간, 인원, 댓글, 사진을 읽음
- 참여자 이름(members) 파싱: 인원 표기 바로 뒤의 이름 목록
- 소모임에는 글 하나로 가는 링크가 없어서, 모바일에서는 /m/deeplink/{gid}로 앱의 모임을 열도록 함
- 리뷰 워크플로우로 찾은 시트 백드롭·포커스·이미지 대체·dvh 문제 수정

## #23

**Prompt**: 서버가 필요해? 왜?

**Answer**: Because of browser security rules. A web page can't read data straight from Somoim, so something outside the browser has to fetch it for the page.

**Why the browser can't fetch it itself**
- When a page calls another site's API, the browser only lets the page read the response if that site explicitly allows it with a CORS header (`Access-Control-Allow-Origin`).
- I checked Somoim's `/api/articles` earlier in this conversation: the response has no such header. So if our page on `yria.github.io` calls Somoim directly, the request goes out but the browser blocks the page from reading the reply.
- The rule only applies inside browsers. Node, curl and GitHub Actions don't enforce it. That's why the dev server, `server.ts` and the build step can all collect the board fine.

**So something outside the browser has to fetch it**
1. **A server** (`server.ts` on Render, Fly.io and similar): fetches on every visit, so data is always current.
2. **A serverless proxy** (Cloudflare Worker): technically still a server, but you only write a small function. There's nothing to run or maintain, and the free tier is enough. The Pages site can stay as it is.
3. **Rebuild on a schedule** (GitHub Actions cron): no server at all. GitHub fetches the board every N minutes and redeploys the Pages site, so data is up to N minutes old. GitHub's scheduled runs are delayed often, so "every 5 minutes" in practice becomes roughly every 10–30 minutes.

Public CORS proxies (sites that relay any request for you) also work without a server, but they're unreliable and your traffic goes through someone else's server, so I don't recommend them.

**My recommendation**: if you want data to be current every time someone opens the page, go with **2, the Cloudflare Worker**. It's free, needs no server management, and keeps GitHub Pages. If being 10–30 minutes behind is fine, **3** is the least work.

---

## #24

**Prompt**: 그럼 이걸 가능하게 하는 배포법을 찾아줘

**Answer**: The deployment research is running in the background. It's comparing four groups:
- Cloudflare Workers / Pages
- Vercel / Netlify
- Hosts that can run `server.ts` as it is (Render, Fly and others)
- What our code would need to change for each

I'll write up a recommendation once it finishes.

---

## #25

**Prompt**: <task-notification>
<task-id>w8e7gw82j</task-id>
<tool-use-id>toolu_01BGTwBCivCLK6cGJdg218bN</tool-use-id>
<output-file>/private/tmp/claude-501/-Users-sam-Projects-escape-from-home/6f6dd48a-c991-44ab-8a9e-1307dfbddceb/tasks/w8e7gw82j.output</output-file>
<status>completed</status>
<summary>Dynamic workflow "Research deployment options that let the calendar fetch Somoim data live on every request" completed</summary>
<result>"# \"항상 최신판\" 배포 방법 추천 (2026-09 기준)\n\n**결론: Cloudflare Workers + Static Assets로 옮기는 게 가장 좋습니다.** 워커 하나가 `dist/`를 서빙하고, `/data/events.json` 요청만 소모임을 실시간으로 수집합니다. 무료이고 카드 등록도 필요 없으며, 프론트엔드 코드는 바꾸지 않습니다. 2순위는 Vercel Hobby(서울 리전), 3순위는 Google Cloud Run입니다.\n\n## 1. 검증 결과\n\n### 공식 문서로 다시 확인한 것\n- **Cloudflare Workers Free**\n  - 하루 100k 요청, 요청당 CPU 10ms. fetch를 기다리는 시간은 CPU 시간에 들어가지 않습니다.\n  - 가끔 10ms를 넘는 건 허용되지만, 계속 넘으면 요청이 강제 종료됩니다.\n  - 유료 플랜은 월 $5이고 CPU 기본 30초입니다.\n- **run_worker_first**\n  - 기본 동작은 정적 파일이 있으면 워커를 실행하지 않고 파일을 바로 줍니다.\n  - 그래서 `run_worker_first: [\"/data/events.json\"]`이 **필수**입니다. 배열 형식이 공식 예제에 있습니다.\n- **Vercel Hobby**\n  - 월 1M 호출, Active CPU 4시간, 함수 실행 최대 300초.\n  - 함수 리전은 1개만 가능하지만 어디든 고를 수 있습니다(`icn1` 서울 가능).\n  - 한도를 넘으면 요금이 나가지 않고 팀이 일시정지됩니다. 롤링 30일 기준입니다.\n- **레포 확인**\n  - `buildSnapshot()`은 이미 `timeoutMs`와 `signal` 옵션을 받습니다 (`packages/somoim/src/snapshot.ts:174`).\n  - 현재 워크플로는 `somoim sync` → `pnpm build` → GitHub Pages 배포 순서입니다.\n  - `public/data/events.json`이 빌드 시 `dist/data/events.json`에 복사됩니다.\n\n### 보고서끼리 맞지 않거나 근거가 약한 것\n- **CPU 측정값이 다릅니다.** 콜드 기준으로 한 보고서는 11.9ms(140개 글 fixture), 다른 보고서는 8.6ms(실제 55개 글)입니다.\n  - 실제 응답 크기는 25–34KB로, 가정했던 50–150KB보다 작습니다.\n  - 그래서 **평소에는 10ms 이내, 콜드 스타트 때만 경계선**이라고 보는 게 맞습니다.\n  - 결정적인 수치는 아니므로 배포 후 로그에서 `exceededCpu`가 나오는지 확인해야 합니다.\n- **Netlify 함수 타임아웃이 보고서마다 다릅니다(60초 vs 10초).** 다시 확인하지 않았습니다. 순위에서 빠져서 영향은 없습니다.\n- **최악의 경우 응답 시간이 30초입니다.** 페이지당 10초 타임아웃 × 3페이지입니다. 모든 플랫폼에서 `timeoutMs: 4000`에 전체 `signal: AbortSignal.timeout(8000)`을 거는 게 좋습니다. 그래야 플랫폼이 끊기 전에 fallback으로 넘어갑니다.\n- **확인이 불가능한 것**\n  - Workers Builds 무료 빌드 시간(월 3,000분)은 서드파티 출처뿐이라 GitHub Actions 배포를 권합니다.\n  - 소모임이 데이터센터 IP를 차단하는지는 **어느 플랫폼이든 배포 전에 알 수 없습니다.**\n- **Vercel의 TS 번들링이 가장 큰 미지수입니다.** somoim 패키지가 `.ts` 소스와 `.ts` 확장자 import를 그대로 내보내고, calendar tsconfig는 project references를 씁니다. `@vercel/node`가 이를 처리하는지는 `vercel build`로 직접 확인해야 합니다.\n\n## 2. 추천 순위\n\n### 1순위: Cloudflare Workers + Static Assets\n**왜**\n- 페이지를 열 때마다 워커 호출은 1회뿐이고, 나머지 정적 요청은 무료·무제한입니다.\n- wrangler(esbuild)가 워크스페이스의 TS 소스를 그대로 번들합니다. `src/index.ts` 쪽 코드에는 Node API가 없어서 `nodejs_compat`도 필요 없습니다.\n- 같은 도메인에서 서빙하니 `useSnapshot.ts`를 바꿀 필요가 없습니다.\n\n**추가하거나 바꿀 파일**\n- `playground/calendar/wrangler.jsonc`\n  - `main: ./worker/index.ts`, `compatibility_date: 2026-09-xx`\n  - `assets: { directory: ./dist, binding: ASSETS, not_found_handling: single-page-application, run_worker_first: [\"/data/events.json\"] }`\n  - `observability.enabled: true`, `placement.mode: smart` (소모임 서버가 AWS 도쿄에 있어서, 실행 위치를 그쪽 가까이로 옮기려는 설정)\n- `playground/calendar/worker/index.ts`\n  - `/data/events.json` 요청이면 `buildSnapshot({ timeoutMs: 4000, signal: AbortSignal.timeout(8000) })`를 호출합니다.\n  - 동시에 들어온 요청은 진행 중인 수집 하나를 공유합니다.\n  - 응답 헤더는 `no-store`입니다.\n  - 실패하면 순서대로 fallback합니다: 마지막 성공 결과(`X-Somoim-Fallback: last`) → `env.ASSETS.fetch`로 빌드 때 만든 파일(`X-Somoim-Fallback: file`) → 502.\n  - 그 외 경로는 전부 `env.ASSETS.fetch(req)`로 넘깁니다.\n  - import는 `@escape-from-home/somoim`의 기본 export만 씁니다. `/node`는 금지입니다.\n- (권장) `playground/calendar/vite/snapshotHandler.ts`를 런타임과 무관한 코어로 분리합니다. 입력 `collect`/`loadFallback`, 출력은 Web 표준 `Response`입니다. 여기에 Node 어댑터(dev 미들웨어, `server.ts`)와 Worker 어댑터를 얹으면 dev와 prod가 같은 로직을 씁니다.\n- `playground/calendar/package.json`: devDependencies에 `wrangler`(4.20 이상), `@cloudflare/workers-types`를 추가합니다.\n\n**배포 (GitHub Actions)**\n- `.github/workflows/deploy-calendar.yml`에서 checkout, pnpm, node 26, install, `somoim sync`, build 단계는 그대로 둡니다.\n- `upload-pages-artifact`, `deploy-pages`, `pages`/`id-token` 권한은 지우고 다음으로 바꿉니다.\n  - `cloudflare/wrangler-action@v4`\n  - `apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}`\n  - `accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`\n  - `workingDirectory: playground/calendar`\n  - `command: deploy`\n- 토큰은 \"Edit Cloudflare Workers\" 템플릿으로 만듭니다.\n- 결과 주소는 `https://escape-calendar.&lt;sub&gt;.workers.dev`입니다.\n\n**기존 GitHub Pages는?** 워크플로를 위처럼 교체하면 이후로 갱신되지 않습니다. 저장소 설정에서 Pages를 끄거나, 옛 URL에 이동 안내만 남겨 두면 됩니다. `somoim sync` 단계는 fallback 파일을 최신으로 유지하는 용도로 계속 둡니다.\n\n**남는 위험**\n- CPU 10ms 초과(Error 1102): 월 $5 유료 플랜으로 해결됩니다.\n- 한도 카운터가 매일 09:00 KST(00:00 UTC)에 초기화되고, 넘으면 그날은 바로 차단됩니다. 개인 사용량에선 문제없습니다.\n- 페이지를 열 때마다 데이터가 뜨기까지 약 0.5–1초 걸립니다. 기존 로딩 UI로 충분합니다.\n\n**변형: 1순위를 그대로 두고 github.io URL만 유지하고 싶다면**\n- 워커는 데이터만 담당(`ACAO: https://yria.github.io`)하고, 프론트는 `VITE_DATA_URL` 환경변수로 워커 주소를 가리킵니다.\n- 배포 대상이 둘이 되고 CORS 설정이 추가됩니다. URL 유지가 꼭 필요할 때만 권합니다.\n\n### 2순위: Vercel Hobby, 함수 리전 `icn1`(서울)\n**왜**\n- 소모임 서버와 가까운 서울에서 돌고, 실행 시간은 최대 300초입니다.\n- 순수 CPU 시간 4시간/월은 이 용도에 넉넉합니다.\n- 카드가 필요 없습니다. Yria는 개인 계정이라 Hobby로 연결할 수 있습니다.\n\n**추가하거나 바꿀 파일**\n- `playground/calendar/api/events.ts`: 1순위와 같은 코어를 쓰는 Web 핸들러입니다.\n- `playground/calendar/vercel.json`: `regions: [\"icn1\"]`, 그리고 rewrite `/data/events.json` → `/api/events`.\n- **fallback 파일 이름 변경이 필수입니다.** 예: `public/data/events.fallback.json`. Vercel은 rewrite보다 정적 파일을 먼저 확인해서, 이름이 같으면 함수가 절대 실행되지 않습니다. `somoimData.ts`의 출력 경로도 같이 바꿔야 합니다.\n- `server.ts`가 Vercel의 zero-config 서버 진입점으로 잡힐 수 있습니다. 문제가 되면 `scripts/serve.ts`로 옮깁니다.\n\n**배포 (GitHub 연동)**\n- Vercel에서 저장소를 import하고 Root Directory를 `playground/calendar`, 프리셋은 Vite, Node는 24.x로 설정합니다. Node 26은 제공되지 않습니다.\n- 먼저 로컬에서 `vercel build`로 번들이 되는지 확인합니다.\n  - 실패하면 esbuild로 함수를 미리 번들해서 Build Output API 형식으로 내보냅니다 (`.vercel/output/functions/...func`, runtime `nodejs24.x`).\n\n**기존 GitHub Pages는?** Vercel이 git 연동으로 직접 배포하므로 `deploy-calendar.yml`은 삭제하거나 `workflow_dispatch` 전용으로 바꿉니다.\n\n**남는 위험**\n- TS 번들링 실패 가능성이 가장 큽니다.\n- Hobby는 런타임 로그를 1시간만 보관합니다.\n- 한도를 넘으면 사이트가 정지되고, 한도 아래로 내려와도 정지가 풀리지 않았다는 포럼 사례가 있습니다.\n- 비상업적 용도로만 쓸 수 있습니다.\n\n### 3순위: Google Cloud Run (서울 `asia-northeast3`, 최소 인스턴스 0)\n**왜**\n- 기존 `server.ts`가 **코드 수정 없이** 돌아갑니다(`PORT` 환경변수 사용, 모든 인터페이스 바인딩).\n- 한국 리전이 있고 콜드 스타트는 몇 초 수준입니다.\n- 개인 트래픽이면 상시 무료 구간 안에서 사실상 $0입니다.\n\n**추가할 파일**\n- 루트 `Dockerfile`\n  - `node:26-slim` 기반, `npm i -g pnpm@11.22.0`(Node 25부터 Corepack이 빠짐).\n  - 레포 전체를 복사한 뒤 install → `somoim sync` → build.\n  - `WORKDIR playground/calendar`, `CMD [\"node\",\"server.ts\"]`.\n  - `pnpm deploy`/prod 전용 복사는 쓰지 마세요. Node는 `node_modules` 안의 `.ts`를 타입 스트리핑하지 않습니다.\n- `.dockerignore`\n\n**배포 (GitHub Actions)**\n- `google-github-actions/auth`로 인증한 뒤 `deploy-cloudrun`으로 `--source . --region asia-northeast3 --allow-unauthenticated --max-instances 2` 배포합니다.\n- Pages 관련 job은 교체합니다.\n\n**남는 위험**\n- 카드가 연결된 결제 계정이 필요합니다. 예산 알림을 꼭 설정하세요.\n- GCP 프로젝트, IAM, Artifact Registry 정리 등 운영 부담이 앞의 두 방법보다 큽니다.\n\n**순위에서 뺀 것**\n- **Render**: 15분 유휴 후 첫 요청이 약 1분 걸립니다.\n- **Netlify**: 무료 플랜은 리전이 오하이오로 고정되고, 크레딧 300 중 production 배포 1회당 15를 씁니다.\n- **Fly / Railway**: 무료가 아닙니다.\n- **Koyeb**: 무료 리전이 EU/미국뿐이고 카드 등록 시 $29를 임시 결제(홀드)합니다.\n- **Deno Deploy**: Node가 아닌 Deno 런타임이고 아시아 리전이 없습니다.\n\n## 3. 공통 위험: 소모임이 데이터센터 IP를 차단할 경우\n- **왜 모르는가**: 소모임 서버는 AWS 도쿄의 Next.js 앱이고 WAF 헤더는 보이지 않습니다. 다만 배포 전에는 확인할 방법이 없습니다. Cloudflare는 외부 요청마다 `CF-Worker` 헤더를 붙이기 때문에 이걸로 걸러낼 수 있습니다.\n- **감지 방법**\n  - 배포 직후 `curl -i https://&lt;host&gt;/data/events.json`으로 `X-Somoim-Fallback` 헤더가 **없는지**, `generatedAt`이 방금 시각인지 확인합니다.\n  - catch 블록에서 상류 HTTP 상태를 로그로 남깁니다. 403/429, HTML 챌린지 페이지(JSON 파싱 실패), 타임아웃이 차단 신호입니다.\n  - 로그는 `wrangler tail`, Workers Logs, Vercel 로그에서 봅니다.\n- **fallback**\n  - 당장은 빌드 때 만든 스냅샷(매 push마다 `sync`로 갱신)을 서빙하고, 헤더로 fallback임을 표시합니다.\n  - 차단이 확인되면 다른 IP 대역의 플랫폼으로 데이터 경로만 옮깁니다. 예: Cloudflare에서 막히면 Vercel `icn1`이나 Cloud Run으로.\n  - 최후 수단은 GitHub Actions cron(예: 10분마다) 재배포인데, 이는 \"항상 최신판\"을 포기하고 준실시간으로 타협하는 것입니다.\n\n## 출처\n- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [Pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [Static Assets routing](https://developers.cloudflare.com/workers/static-assets/) · [run_worker_first](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) · [SPA shell 예제](https://developers.cloudflare.com/workers/examples/spa-shell/) · [wrangler-action](https://github.com/cloudflare/wrangler-action)\n- [Vercel Hobby](ht
... (truncated 685 chars, full result in /private/tmp/claude-501/-Users-sam-Projects-escape-from-home/6f6dd48a-c991-44ab-8a9e-1307dfbddceb/tasks/w8e7gw82j.output)</result>
<diagnostics>Per-agent results: /Users/sam/.claude-instances/af43c37c/projects/-Users-sam-Projects-escape-from-home/3b1b48c9-9348-45a3-b73c-35e5c8132383/subagents/workflows/wf_341a44ca-a20/journal.jsonl — one {"type":"result",...} line per completed agent with its full return value.
If the result above is empty or unexpected, Read this file BEFORE diagnosing — do not assume agents returned non-empty results.
To re-run with edited post-processing: Workflow({scriptPath: '/Users/sam/.claude-instances/af43c37c/projects/-Users-sam-Projects-escape-from-home/3b1b48c9-9348-45a3-b73c-35e5c8132383/workflows/scripts/live-deploy-research-wf_341a44ca-a20.js', resumeFromRunId: 'wf_341a44ca-a20'}) — agents whose (prompt, opts) are unchanged replay from cache.</diagnostics>
<usage><agent_count>5</agent_count><agents_done>5</agents_done><agents_error>0</agents_error><agents_skipped>0</agents_skipped><agents_empty_result>0</agents_empty_result><subagent_tokens>608430</subagent_tokens><tool_uses>75</tool_uses><duration_ms>433099</duration_ms></usage>
</task-notification>

**Answer**: I compared the platforms against current (2026) official docs. The best fit is **Cloudflare Workers + Static Assets**: it's free, needs no card, and needs no changes to the frontend code.

## Recommendation: Cloudflare Workers + Static Assets

**How it works**: one Worker serves the built files (`dist/`). Only requests for `/data/events.json` collect Somoim's board in real time.

**Why this one**
- The free tier allows 100k requests a day. Each page open calls the Worker once; the other static files are free and unlimited.
- Time spent waiting on Somoim's reply doesn't count toward the free CPU limit.
- The page and the data come from the same address, so there are no CORS issues and the frontend (`useSnapshot`) doesn't change.
- wrangler bundles the somoim package's TS source as it is. The code has no Node-only APIs, so it runs without extra settings.

**What I'd add or change**
- **`playground/calendar/wrangler.jsonc`**: must set `run_worker_first: ["/data/events.json"]`. Without it, Cloudflare serves the static file with that name directly and the Worker never runs.
- **`playground/calendar/worker/index.ts`**: collects on each request and responds with `no-store`. If collection fails, it falls back to the last successful result, then to the snapshot made at build time.
- **Shared handler**: split the one in `vite/snapshotHandler.ts` so dev, `server.ts` and the Worker all use the same logic.
- **Timeouts**: shorten to 4 seconds per page and 8 seconds overall. The current worst case is 30 seconds (10 seconds × 3 pages).
- **`deploy-calendar.yml`**: swap the GitHub Pages deploy step for `cloudflare/wrangler-action`.

**Address**: it moves from `yria.github.io/escape-from-home` to `https://<이름>.<서브도메인>.workers.dev`. If you need to keep the old address, there's a variant: the Pages site stays and only the data comes from the Worker. That means two deploy targets and extra CORS setup.

**Risks**
- **CPU limit**: the free plan allows 10ms of CPU per request, and measurements were 8.6–11.9ms. That's normally within the limit but close on a cold start. I'd check the logs after deploying, and if it's exceeded, the $5/month plan fixes it.
- **Somoim blocking datacenter IPs**: this can't be known before deploying, on any platform. Right after deploying, I'd confirm that the response has no `X-Somoim-Fallback` header and that `generatedAt` is the current time. If it's blocked, only the data would move to another platform.

## Alternatives
- **2nd: Vercel Hobby (Seoul region)**. It runs close to Somoim's server, but it's the least certain whether our TS package bundles as is. It's also for non-commercial use only.
- **3rd: Google Cloud Run (Seoul)**. `server.ts` runs with no code changes, but it needs a card on a billing account and has the most setup overhead.

Ruled out:
- **Render**: the first request after going idle takes about a minute.
- **Netlify**: the free plan's region is fixed to the US.
- **Fly and Railway**: not free.
- **Koyeb and Deno Deploy**: no Asian region, or not Node.

## Next step
I can write the code for option 1 now: the Worker, the wrangler config, the shared handler and the deploy workflow. I'll first check it runs locally with `wrangler dev` and actually collects data. Only you can do these two steps:
1. Create a Cloudflare account (free).
2. Create an API token with the "Edit Cloudflare Workers" template, and add it to the GitHub repo secrets along with your Account ID as `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Should I go ahead with option 1? Also, do you need to keep the current `github.io` address?

Sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [Pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [Static Assets routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) · [wrangler-action](https://github.com/cloudflare/wrangler-action)

---

## #26

**Prompt**: 한글로 설명해봐

**Answer**: 쉬운 말로 다시 정리하면 이렇습니다.

## 지금 문제
- 지금 사이트는 **파일만 올려 두는 곳**(GitHub Pages)에 있습니다. 그래서 들어올 때마다 소모임 게시판을 새로 가져오는 일을 해 줄 곳이 없습니다.
- 브라우저가 소모임에서 직접 가져오는 것도 안 됩니다. 소모임이 **다른 사이트에서 자기 글을 읽어 가는 것을 허락하지 않기** 때문에 브라우저가 막습니다.
- 그래서 **사이트 대신 게시판을 가져와 줄 작은 프로그램**을 인터넷 어딘가에 올려 둬야 합니다.

## 추천: 클라우드플레어 워커
클라우드플레어는 **작은 프로그램을 무료로 인터넷에 올려 두고 돌려 주는 서비스**입니다. 컴퓨터를 따로 켜 두거나 관리할 필요가 없습니다.

**동작 방식**
1. 누가 캘린더에 들어옵니다.
2. 화면(디자인, 버튼 같은 파일)은 클라우드플레어가 바로 보내 줍니다.
3. 일정 데이터를 달라는 요청이 오면, 워커가 **그 순간 소모임 게시판을 가져와** 정리해서 보내 줍니다.
4. 그래서 들어올 때마다 항상 최신 일정이 보입니다.

**좋은 점**
- **무료**이고 카드 등록도 필요 없습니다. 하루 10만 번까지 가능해서 개인이 쓰기엔 충분합니다.
- 화면 코드는 **거의 그대로** 둬도 됩니다. 게시판 가져오는 코드도 지금 것을 그대로 씁니다.
- 가져오기에 실패하면 **바로 전에 가져온 일정**, 그것도 없으면 **배포할 때 만들어 둔 일정**을 대신 보여 줍니다. 빈 화면이 뜨지 않습니다.

**달라지는 점**
- 주소가 바뀝니다. 지금은 `yria.github.io/escape-from-home`이고, 바뀌면 `이름.workers.dev` 같은 주소가 됩니다. 지금 주소를 꼭 써야 한다면 방법은 있지만, 올리는 곳이 두 군데로 늘어나 조금 복잡해집니다.

**걱정되는 점**
- **무료 한도 안에 들어가는지**: 무료 플랜은 요청 하나를 처리할 때 계산을 아주 짧게만 하도록 제한합니다. 재 보니 평소엔 들어오고, 처음 켜질 때만 한도에 딱 걸칠 수 있는 정도였습니다. 올린 뒤 기록을 보고, 넘치면 월 5달러 요금제로 바꾸면 됩니다.
- **소모임이 막을 수도 있음**: 소모임이 이런 서비스에서 오는 접속을 막는지는 **올려 봐야 알 수 있습니다**. 올린 직후 진짜 새 데이터가 오는지 확인하겠습니다. 막혀 있으면 다른 서비스로 옮기면 됩니다.

## 다른 방법 (차선책)
- **버셀(Vercel)**: 역시 무료이고 서울에서 돌아서 소모임과 가깝습니다. 다만 우리 코드가 그대로 올라갈지 확실하지 않고, 돈 버는 용도로는 쓸 수 없습니다.
- **구글 클라우드 런**: 지금 만들어 둔 서버 코드를 고치지 않고 그대로 올릴 수 있습니다. 다만 카드 등록이 필요하고 설정할 것이 가장 많습니다.
- 그 밖의 서비스는 오래 안 쓰면 잠들어서 첫 접속이 1분쯤 걸리거나, 무료가 아니거나, 서버가 한국에서 너무 멀어서 뺐습니다.

## 진행하려면
제가 할 일:
- 워커 프로그램과 설정 파일을 만들고, 제 컴퓨터에서 먼저 돌려서 게시판을 잘 가져오는지 확인합니다.
- GitHub에 올릴 때마다 자동으로 클라우드플레어에 배포되게 바꿉니다.

직접 해 주셔야 할 일 (계정이 필요해서 제가 할 수 없습니다):
1. 클라우드플레어 무료 가입
2. 클라우드플레어에서 **배포용 열쇠(API 토큰)**를 만들어 GitHub 저장소 설정에 넣기. 방법은 그때 순서대로 알려 드리겠습니다.

이대로 진행할까요? 그리고 지금 주소(`github.io`)를 꼭 유지해야 하나요?

---

## #27

**Prompt**: 무료이고 제일 만만한게 뭐야

**Answer**: 무료 중에서 제일 만만한 건 두 가지입니다. "항상 최신"이 꼭 필요한지에 따라 고르면 됩니다.

## 1. 제일 만만함: 지금 그대로 두고 자동으로 자주 다시 올리기
- **할 일**: 제가 배포 설정 파일(`deploy-calendar.yml`)에 몇 줄만 넣으면 끝입니다. 새로 가입할 곳도 없고 주소도 그대로입니다.
- **방식**: GitHub가 정해진 간격(예: 10분)마다 게시판을 새로 가져와 사이트를 다시 올립니다.
- **단점**: **실시간이 아닙니다.** GitHub의 예약 실행은 자주 밀려서 실제로는 10~30분쯤 늦은 데이터일 수 있습니다. 새로고침 버튼을 눌러도 그 사이에는 새 데이터가 안 나옵니다.

## 2. 실시간 중에 제일 만만함: 클라우드플레어 워커
- **할 일**: 클라우드플레어 가입, 그리고 배포용 열쇠 하나를 GitHub에 넣기. 나머지 코드는 제가 다 합니다.
- **장점**: 들어올 때마다 **진짜 최신**입니다. 카드 등록 없이 무료입니다.
- **단점**: 주소가 `...workers.dev`로 바뀌고, 소모임이 클라우드플레어 접속을 막는지는 올려 봐야 압니다.

## 정리
- "몇십 분 늦어도 괜찮다" → **1번**. 지금 바로 해 드릴 수 있습니다.
- "처음 말한 대로 항상 최신이어야 한다" → **2번**.

처음에 항상 최신판이어야 한다고 하셨으니 **2번을 추천**합니다. 어느 쪽으로 할까요?

---

## #28

**Prompt**: 깃헙으로 하면 서버필요없어?

**Answer**: 네, GitHub만 쓰면 **서버는 필요 없습니다.** 대신 **실시간은 안 됩니다.**

**왜 서버가 필요 없는지**
- GitHub에는 **정해진 시간마다 코드를 대신 돌려 주는 기능**(GitHub Actions)이 있습니다.
- 이 기능이 예를 들어 10분마다 게시판을 가져와 일정 파일을 새로 만들고, 사이트를 다시 올립니다.
- 방문자는 그렇게 만들어 둔 파일을 읽기만 합니다. 그래서 따로 켜 둘 서버가 없습니다.

**왜 실시간은 안 되는지**
- GitHub Pages는 **파일만 보여 주는 곳**이라, 누가 들어오는 순간에 코드를 실행할 수 없습니다.
- 그래서 데이터는 "마지막으로 다시 올린 시점"의 것입니다.
- 예약 실행은 5분보다 짧게 잡을 수 없고, GitHub가 바쁘면 자주 밀립니다. 실제로는 **10~30분 늦은 데이터**라고 보시면 됩니다.

**비용과 주의할 점**
- 공개 저장소면 GitHub Actions는 **무료이고 횟수 제한도 없습니다.** 지금 Pages를 무료로 쓰고 있으니 공개 저장소일 가능성이 큽니다.
- **60일 동안 저장소에 아무 변경이 없으면** GitHub가 예약 실행을 자동으로 멈춥니다. 가끔 커밋하거나, 멈추면 다시 켜 줘야 합니다.
- 화면의 새로고침 버튼은 이 방식에서 의미가 없어집니다. 그래서 버튼을 없애고 "마지막 갱신 ○시 ○분"만 보여 주는 게 맞습니다.

**정리**
- 서버 없이, 새 가입 없이, 주소도 그대로 가려면 → **GitHub 예약 실행**
- 들어올 때마다 진짜 최신이어야 하면 → 어떤 형태든 대신 가져와 줄 곳이 필요하고, 그중 제일 쉬운 게 **클라우드플레어 워커**

GitHub 방식으로 할까요? 하신다면 몇 분 간격으로 할지(추천은 10분)도 알려 주세요.

---

## #29

**Prompt**: 아 그럼 깃헙써도 돼. 일정은 30분단위로 가져오면 되니까. 근데 이거 주기짧으면 돈나가?

**Answer**: **No, it won't cost anything.** The repo is public, and GitHub Actions is free with no usage limit for public repos. Even every 5 minutes would still be free.

For reference, a private repo gets 2,000 free minutes a month. Each run takes about 45 seconds, so every 30 minutes would come to roughly 1,500 minutes a month, which also fits within the free amount. The Pages site itself is free as well.

**What I changed**
- I added a schedule to the deploy settings (`.github/workflows/deploy-calendar.yml`) so it collects the board and redeploys **every 30 minutes**.
- It runs at **7 and 37 minutes past each hour** instead of on the hour and half hour. Those times are when everyone's scheduled runs pile up and get delayed the most.

**Worth knowing**
- **How old the data can be**: up to 30 minutes plus however long GitHub delays the run. Usually it's within 30–40 minutes.
- **Auto-stop after 60 days**: if the repo has no activity for 60 days, GitHub pauses scheduled runs. If that happens, turn it back on from the **Actions** tab.
- **The new schedule only starts after it's pushed to main.** The change is staged but not committed yet. Tell me if you want me to commit and push it.

---

## #30

**Prompt**: 그럼 간격 최대한짧게하고 배포해. 크론으로 돌려서 데이터 캐싱하는거지?

**Answer**: _(응답 대기 중…)_

---

## #31

**Action**: 캘린더 배포에 5분 간격 예약 실행 추가

**Answer**: GitHub Pages는 정적이라 방문할 때 수집할 수 없어서, GitHub Actions 예약 실행(cron)으로 5분마다 소모임 게시판을 다시 긁어 data/events.json으로 구워 재배포하도록 했습니다. 서버 없이 주기적으로 캐시를 갱신하는 방식입니다.
- cron '2-59/5 * * * *': GitHub 예약 실행의 최소 간격. 정각 근처에 몰리는 걸 피하려고 2분부터 시작
- 공개 저장소라 Actions와 Pages 모두 무료
- 60일 동안 커밋이 없으면 예약 실행이 멈추므로 Actions 탭에서 다시 켜야 함

## #31

**Prompt**: 잠깐 커밋이 없으면 멈춘다고? 이 코드는 거의 수정할일이 없을거같은데

**Answer**: Yes, it would stop. GitHub counts only **new commits** as activity, and the scheduled runs themselves don't count. So if nobody commits for 60 days, the schedule gets paused automatically. GitHub sends an email a few days beforehand.

## Keeping it running without commits
GitHub has a feature to "re-enable a workflow" (`gh workflow enable`). Calling it regularly restarts the 60-day timer, so you don't need to make dummy commits.

- **How**: add one small file, `.github/workflows/keepalive.yml`. On the 1st and 15th of each month it re-enables itself and the calendar deploy workflow.
- **Needs**: only GitHub's built-in permission (`actions: write`). No extra token, no outside service.
- **Cost**: free. It runs twice a month for a few seconds.
- **Caveat**: GitHub doesn't officially document that this resets the timer. Many projects use it and it works, according to the [community discussion](https://github.com/orgs/community/discussions/184653) and [keepalive-workflow](https://github.com/marketplace/actions/keepalive-workflow). If it ever doesn't work, you'll still get GitHub's warning email first, and you can press "Enable" once in the Actions tab.

Should I add this and deploy it?

**Status**: the 5-minute schedule is already pushed and running (`f02ba62`). One thing I didn't finish: my history entry got the same number, #30, as one that was already there. The command to renumber it to #31 was the one you stopped. I can fix it in the same commit if you go ahead.

Sources:
- [Disabling and enabling a workflow - GitHub Docs](https://docs.github.com/actions/managing-workflow-runs/disabling-and-enabling-a-workflow)
- [Keepalive Workflow · GitHub Marketplace](https://github.com/marketplace/actions/keepalive-workflow)
- [GitHub community discussion #184653](https://github.com/orgs/community/discussions/184653)
- [GitHub community discussion #57858](https://github.com/orgs/community/discussions/57858)

---

## #32

**Prompt**: 그럼 다른방법 쓸래. 버셀이나 클라우드플레어는 어때

**Answer**: Both are free, and both **fetch fresh data every time someone visits**. So cron and the 60-day auto-stop stop being a concern.

## Comparison

| | Cloudflare Workers | Vercel |
|---|---|---|
| **Cost** | Free, no card | Free, no card |
| **Free limit** | 100k requests/day | 1M calls/month |
| **Data freshness** | Fetched on every visit | Fetched on every visit |
| **Server location** | Picked automatically (can be set near Somoim's server in Tokyo) | Can be pinned to **Seoul** |
| **Code changes** | Moderate (add a Worker file and a config file) | Moderate (add a function file and a config file) |
| **Risk of failing to deploy as is** | Low. It bundles our TS code as is | **Higher.** It may not handle the way our package ships TS source |
| **Other limits** | Very little CPU time per request. Normally within it, borderline on a cold start | **Non-commercial use only.** Going over the limit suspends the site |
| **How it deploys** | Automatically through the GitHub workflow (token goes in GitHub) | Link the repo on Vercel and it deploys on each push |
| **Address** | `이름.서브도메인.workers.dev` | `이름.vercel.app` |

## My recommendation: Cloudflare
- It's the most likely to run our code as is, so it has the least deploy trouble.
- Its free limit resets daily, and even going over it doesn't suspend the site.
- Vercel is closer (Seoul), but the risk of the build not working as is makes it harder to recommend.

Both share one risk: whether Somoim blocks connections from these services is only known after deploying. If Cloudflare turns out to be blocked, we'd move just the data part to Vercel.

## If you go with Cloudflare
**My part**
- Write the Worker and its config file.
- Test locally that it actually collects data.
- Change the GitHub workflow to deploy to Cloudflare.
- Remove the 5-minute cron I just added, since it won't be needed anymore.

**Your part**
1. Sign up for Cloudflare (free).
2. Create an API token and put it in GitHub. I'll walk you through the steps when we get there.

Which one should I go with?

---

## #33

**Prompt**: 잠깐 이전설명에 깃헙에서 가능하다고 한거야? 한글로좀 말해봐

**Answer**: 네, GitHub로도 **됩니다.** 다만 방식이 다릅니다.

## GitHub 방식: "미리 받아 두기"
- GitHub가 **5분마다** 소모임 게시판을 가져와서 파일로 저장해 둡니다.
- 방문자는 그 저장된 파일을 봅니다.
- 그래서 데이터는 **최대 5분(밀리면 10~30분) 전 것**입니다.
- 서버도, 새 가입도 필요 없고 주소도 그대로입니다.
- **지금 이 방식으로 이미 배포되어 돌아가고 있습니다.**

걸리는 점은 하나입니다.
- 저장소에 60일 동안 새 커밋이 없으면 GitHub가 5분마다 하던 작업을 **알아서 멈춥니다.**
- 이건 **파일 하나를 추가하면 막을 수 있습니다.** 한 달에 두 번 GitHub에게 "이 작업 계속 켜 둬"라고 알려 주는 방식입니다. 무료이고 가입할 것도 없습니다.

## 클라우드플레어·버셀 방식: "들어올 때마다 가져오기"
- 누가 들어오는 **그 순간** 소모임 게시판을 가져옵니다.
- 그래서 항상 **지금 이 순간의 데이터**입니다.
- 멈출 걱정도 없습니다.
- 대신 새로 가입해야 하고 주소가 바뀝니다.

## 정리

| | GitHub (지금 방식) | 클라우드플레어 |
|---|---|---|
| 데이터 | 5~30분 전 | 지금 이 순간 |
| 가입 | 필요 없음 | 필요함 |
| 주소 | 그대로 | 바뀜 |
| 60일 멈춤 | 파일 하나로 해결 | 해당 없음 |
| 비용 | 무료 | 무료 |

아까 "30분 간격이면 된다"고 하셨으니 **GitHub 방식에 멈춤 방지 파일만 추가하는 걸 추천**합니다. 가장 간단하고 지금 주소도 그대로 씁니다.

어느 쪽으로 할까요?

---

## #34

**Prompt**: 버셀로 할거고 [Image #1] 여기서 셋팅 어떻게해야할지알려줘

**Answer**: I've got the Vercel setup ready and tested locally, but it isn't pushed yet. Vercel builds whatever is on GitHub, so **this code needs to be pushed first**. Nothing is committed yet either.

## What to pick on that screen

1. **Don't use "Import multi-service project" (the Services preset).** Leave that section alone.
2. In the **calendar** row (not extension), click **"Import single project →"**.
3. On the next screen:
   - **Project Name**: pick anything. It becomes the address, e.g. `escape-calendar` → `escape-calendar.vercel.app`.
   - **Root Directory**: should be `playground/calendar`. That button fills it in.
   - **Framework Preset**: Vite (leave it).
   - **Build Command / Output Directory / Install Command**: **don't touch any of them**. The `vercel.json` file I added overrides them.
   - **Environment Variables**: none needed.
4. Click **Deploy**.

After it's created, check two things under Project **Settings → Build and Deployment**:
- **Node.js Version**: `24.x`.
- **"Include files outside the root directory in the Build Step"**: on (it's on by default). The calendar needs the somoim package in the same repo, so this must be on.

## What I built
- **The function** (`server/vercelEvents.ts`): collects the Somoim board fresh on every visit. It runs in the Seoul region.
- **Bundling**: Vercel's own conversion broke the function, because our package ships TypeScript source that it couldn't resolve. So `scripts/vercel-output.ts` bundles the function into one file with Vite and hands Vercel the finished result.
- **Fallback**: if collection fails, it shows the data from the previous run. If there is none, it shows the data made at deploy time.
- **Local tests**:
  - Live collection works: 35 events in 0.57s, not cached.
  - With the network cut, it falls back to the saved data.
  - Vercel's build tool uses our output as it is.
- **GitHub cron removed**: the 5-minute scheduled run isn't needed anymore.

## Still to decide
- **Push**: the Vercel code is staged but not committed. Should I commit and push? You can do the Vercel import before or after. Once the code is on GitHub, Vercel redeploys automatically.
- **GitHub Pages**: it still redeploys on every push. After Vercel is confirmed working, should I remove that deploy workflow too?

Once it's deployed, send me the address. I'll check whether Somoim blocks requests from Vercel, by making sure the response doesn't come back marked as fallback data.

Sources: [Vercel rewrites](https://vercel.com/docs/routing/rewrites) · [Function regions](https://vercel.com/docs/functions/configuring-functions/region) · [Build Output API](https://vercel.com/docs/build-output-api/configuration)

---

## #35

**Prompt**: 그럼 버셀로 배포할거니까 코드수정할거 있음 수정하고 최종 커밋 푸쉬해

**Answer**: The Vercel setup is committed and pushed (`480ee7c`, on main). Before pushing I confirmed the build, tests, types and lint all pass, and that Vercel's own build tool uses our function output as it is.

**Changes in this commit**
- **Node version**: set to 24 or above in `package.json`, so you don't need to set it in Vercel.
- **GitHub Pages deploy removed**, including the 5-minute scheduled run. Now only Vercel deploys.
- **Committed along with it**: the Vercel function, the bundling script, `vercel.json` (Seoul region), and the fallback file handling.

**Next, in Vercel**
1. On that screen, click **"Import single project"** in the **calendar** row.
2. Enter a Project Name and leave everything else at the defaults.
3. Click **Deploy**. It builds the code I just pushed.

**After it's deployed**
- **Send me the address.** I'll check whether data is really being collected live. If the response is marked as fallback, or the time in it is old, Somoim is blocking requests from Vercel.
- **The old GitHub Pages site** stays up with its last deploy. To take it down completely, switch Pages off in the GitHub repo under **Settings → Pages**.

---

## #36

**Prompt**: https://escape-from-home.vercel.app/

**Answer**: The site is live at https://escape-from-home.vercel.app/, and it collects fresh board data every time it's opened. Somoim isn't blocking requests from Vercel.

I requested the data twice, 3 seconds apart:

| Check | Result |
|---|---|
| Collection time | 16:33:37, then 16:33:40, so each request collected again |
| Fallback marker (`X-Somoim-Fallback`) | none, so it's real live data |
| Caching | `no-store`, not cached |
| Run location | `icn1` (Seoul) |
| Data | 35 events and 2 undated posts, including the new fields such as participant names |

I also opened the page in a browser:
- 14 days on the calendar have events.
- The drip effect shows on the 3 horror days.
- The filter reads 전체 23 / 모집중 0 / 마감 5 / 공포 3.
- No error notices and no console errors.

From now on, every push to main redeploys automatically. If you don't need the old GitHub Pages address anymore, switch Pages off in the GitHub repo under **Settings → Pages**.

---

## #37

**Prompt**: 웹앱으로 바탕화면에 추가할 수 있게 해주고 작업끝나면 커밋하고 배포해

**Answer**: _(응답 대기 중…)_

---

## #38

**Prompt**: 필터의 카운터가 월별로 되어있는데 전체로 해줘 이것도 끝나면 커밋후 배포

**Answer**: Both changes are committed and live at https://escape-from-home.vercel.app/: you can add the calendar to your home screen as an app, and the filter now counts everything instead of just the month you're viewing.

## 1. Home-screen app (`f8e2f16`)
- **Name**: "방탈출 캘린더" in full, and **"방탈출"** under the icon.
- **Opens without the address bar**, portrait only, in the dark navy theme color.
- **New icon**: a purple keyhole on dark navy, the Nocturne colors. The favicon was changed to match.
- **Icon files**: sizes for Android (192, 512, and a version that fits circular or rounded icon masks) and for iPhone (180).
- **iPhone**: the page draws behind the status bar, so I pushed the top header down to leave room for it.
- **No service worker**: Chrome doesn't need one to install a web app anymore, and a cached copy could show old events. The catch is that the app won't open when you're offline.

On the live site, the manifest and all 4 icons load, and the manifest link is in the page.

**How to add it**
- **iPhone (Safari)**: tap Share, then **홈 화면에 추가**.
- **Android (Chrome)**: open the ⋮ menu, then **홈 화면에 추가** or **앱 설치**.
- **Desktop (Chrome/Edge)**: click the install icon at the right end of the address bar.

## 2. Filter counts cover everything (`0189d7c`)
- The numbers now count everything collected, whatever month you're looking at.
- The filter also applies to the "날짜 미확인" list, so those posts are included in the counts.
- On the live site it shows **전체 37 / 모집중 6 / 마감 13 / 공포 4**, and the numbers stay the same when you move from September to October.

Sources: [Revisiting Chrome's installability criteria](https://developer.chrome.com/blog/update-install-criteria) · [Making PWAs installable - MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) · [What Makes A PWA Installable?](https://modernwebweekly.substack.com/p/what-makes-a-pwa-installable)

---

## #39

**Prompt**: go on

**Answer**: _(응답 대기 중…)_

---

## #40

**Prompt**: go on

**Answer**: Nothing is left over from the last requests. Both changes, the home-screen app and the filter counts across all events, are committed, pushed and live at https://escape-from-home.vercel.app/.

The only uncommitted change is the history file (`.agent-history/main.md`), which the hook updates after every reply. It's staged and will go in with the next commit.

Some follow-ups I mentioned earlier, if you want to pick one:
1. **Better open/closed detection**: only treat "마감" as closed when it's marked like `[마감]` or says it's finished, count a post as closed once its headcount is full, and close out posts whose date has passed.
2. **Horror theme list**: catch horror posts that never use a horror word, such as "괴록 가실 분".
3. **Role counts**: read `쫄3` or `쫄1 탱2` as the number of each role.
4. **Turn off the old GitHub Pages site**: in the GitHub repo, **Settings → Pages**.

Tell me which one to do, or what else you need.

---

## #41

**Prompt**: 개선사항 진행해.
1. 그대로 진행
2. 이건 패스.
3. 공포 테마의 경우 해당 개선사항을 반영했으면 좋겠음. 모달도 조금 디자인 색다르게 해서 공포테마임을 확실하게 알 수 있게.
4. 이미 진행함.

추가로 캘린더 날짜의 숫자가 잘 안보여서 가독성 올렸음 좋겠음.

**Answer**: _(응답 대기 중…)_

---

## #42

**Prompt**: 마감된 일정은 캘린더 내에서 표시를 좀 dim 처리해줘

**Answer**: All four changes are done and checked in the browser, including the dimming you asked for partway through. Tests pass (191 in somoim, 23 in the calendar), along with types and lint. Everything is staged but not yet committed or deployed.

## 1. Better open/closed detection
Posts in 관심사 (normally 모집중) are now shown as 마감 in these cases:
- **The text says it's closed**: `[마감]`, `(마감)`, "마감했습니다", "모집 마감". Phrases like "마감 임박", "마감되면 공지할게요" or "모집 마감 예정" no longer count as closed.
- **The headcount is full**, e.g. 3/3.
- **The meeting date has passed.** On the day itself it still counts as 모집중.

**No post changes status on current data.** None of today's 55 posts are written in a way these rules catch. The rules apply as new posts come in.

## 3. Horror roles, and a distinct sheet for horror posts
- **Role parsing**:
  - Counts like "쫄3" and "탱 1명".
  - The role being sought: "쫄을 찾습니다" and "쫄 우선" → looking for 쫄; "쫄탱 가리지 않습니다" and "구분없이" → either is fine.
  - On current data, "싸패방" reads as 쫄 3명 and "층간소음" reads as 쫄·탱 무관.
- **Horror detail sheet**:
  - A blood-drip band animates across the top.
  - Red-tinted background and a red-toned photo.
  - A skull warning line.
  - A red glow on the title, with red accents on the info box, buttons and backdrop.
  - A **쫄·탱** row shows the role chips, or says the post doesn't mention roles.

## Calendar date numbers
- They're now larger (12px) and bold.
- On cells with posters, the number sits on a dark pill so it's readable on any image.
- Today's date uses a brighter accent pill.

## Dimming closed events
- Posters and title labels for events that are 마감, 완료 or 펑 are shown greyed out and darker.
- If every event on a day has ended, the cell background is darker too, so days with 모집중 events stand out.

Should I commit and deploy?

---

## #43

**Prompt**: 딥링크로 게시물로 직접 이동하게 하고싶은데 이거 분석할 방법 잇을까

**Answer**: 네, 분석할 수 있습니다. 먼저 웹 쪽을 확인해 봤는데, 웹만으로는 게시글 딥링크를 찾을 수 없었습니다. 남은 길은 앱 쪽을 분석하는 것입니다.

## 웹에서 확인한 것
`/m/deeplink/{gid}` 페이지의 Next.js 코드를 받아서 뜯어보니, 앱을 여는 주소가 이렇게 만들어집니다.

- iOS: `somoim://com.friendscube.Somoim?type=63&gid={gid}`
- Android: `intent://com.friendscube.Somoim?type=63&gid={gid}#Intent;scheme=somoim;...;package=com.friendscube.somoim;end`

즉 **앱은 `type=숫자` 로 어느 화면을 열지 정합니다.** `63`이 모임 화면입니다. 게시글 화면에도 번호가 따로 있을 가능성이 높지만, 웹 코드에는 `type=63` 하나뿐입니다. 공유 기능 코드도, 게시글 id를 넣는 자리(`aid=` 같은 것)도 없습니다. `assetlinks.json`과 `apple-app-site-association`도 여전히 404라서, 일반 https 주소로 앱을 여는 방식(유니버설 링크/앱 링크)도 쓸 수 없습니다.

## 게시글 번호를 알아내는 방법 (쉬운 순서)

1. **앱에서 게시글 공유하기 (가장 쉬움)**: 앱에서 벙 글 하나를 "공유 → 링크 복사" 해서 붙여넣어 보세요. 주소에 `type=`이나 글 id가 들어 있으면 그대로 따라 만들면 됩니다. 단축 링크라면 `curl -sIL <링크>`로 끝까지 따라가 보면 됩니다.
2. **폰에서 번호 바꿔 넣어 보기**: Android라면 `adb shell am start -a android.intent.action.VIEW -d "somoim://com.friendscube.Somoim?type=N&gid=...&aid=..."` 식으로 `type`과 파라미터 이름을 바꿔 가며 어떤 화면이 열리는지 봅니다. 번호를 모르는 채로 찍는 방식이라 오래 걸릴 수 있습니다.
3. **Android 앱 코드 뜯어보기 (가장 확실함)**: `com.friendscube.somoim` APK를 jadx로 디컴파일합니다. 그다음 `AndroidManifest.xml`에서 `somoim` 스킴을 받는 Activity를 찾고, 그 코드에서 `getQueryParameter("type")`을 따라가면 번호별로 어떤 화면을 여는지 목록이 나옵니다. 푸시 알림도 같은 번호를 쓰는 경우가 많아서 게시글·댓글 알림 번호를 함께 찾을 수 있습니다.
4. **앱 통신 엿보기 (보조 수단)**: mitmproxy나 Charles로 앱이 서버와 주고받는 내용을 봅니다. 게시글 상세 API나 공유 링크를 만드는 API가 따로 있는지 알 수 있습니다. 앱이 인증서 고정(pinning)을 쓰면 막힙니다.

1번을 먼저 해 보시길 권합니다. 1분이면 끝나고, 결과가 나오면 거기서 멈추면 됩니다. 공유 링크가 모임 주소로만 나오면 3번이 가장 확실합니다. 다만 3번은 남의 앱 APK를 받아서 디컴파일하는 일이라, 원하시는지 확인한 뒤에 진행하겠습니다.

게시글 번호를 찾으면 `packages/somoim/src/snapshot.ts:30`의 `groupAppUrl` 옆에 게시글용 주소를 만드는 함수를 하나 추가하면 됩니다. 앱이 없는 사람은 지금처럼 모임 페이지로 보내면 됩니다.

공유 링크를 붙여 주시거나 APK 분석을 진행하라고 하시면 이어서 하겠습니다.

---

## #44

**Prompt**: 앱에 모임채팅방에 공유하기만 있지 외부공유하기가 없네

**Answer**: 그럼 공유 링크로 알아내는 방법은 안 되네요. 남은 방법은 앱 코드를 직접 보는 것이고, 이 Mac에는 `adb`가 이미 깔려 있어서 준비가 거의 끝나 있습니다.

## 진행 순서
1. **폰에서 APK 꺼내기**: 소모임이 설치된 Android 폰을 USB로 연결하고 USB 디버깅을 켜 주세요. 폰에 설치된 앱에서 직접 꺼내므로 외부 사이트에서 APK를 받을 필요가 없습니다.
[코드 블록 생략]
2. **디컴파일**: `brew install jadx`로 jadx를 설치한 뒤 소스로 풀어냅니다.
3. **분석**
   - `AndroidManifest.xml`에서 `somoim` 스킴을 받는 Activity를 찾습니다.
   - 그 Activity에서 `type` 값을 어떻게 나누어 처리하는지 따라가서, `63` 외에 게시글·댓글 화면 번호와 필요한 파라미터 이름을 알아냅니다.
   - 채팅방에 게시글을 공유할 때 메시지에 무엇이 담기는지도 같이 봅니다. 채팅에서 공유된 글을 누르면 그 글이 열리므로, 게시글을 여는 방법이 그 코드 안에 있을 가능성이 높습니다.
4. **실제 확인**: 찾은 주소로 `adb shell am start -d "somoim://...type=N&gid=...&..."`를 실행해서 해당 게시글이 바로 열리는지 확인합니다.
5. 열리면 `snapshot.ts`에 게시글용 주소를 만드는 함수를 추가합니다.

## 부탁드릴 것
- 폰을 연결하고 USB 디버깅을 켠 뒤 알려 주세요. 연결은 `adb devices`로 제가 확인하겠습니다.
- 소모임 앱의 APK를 받아 디컴파일하는 작업입니다. 앱을 수정하거나 배포하지 않고 딥링크 규칙만 읽어 오는 용도인데, 이대로 진행해도 괜찮은지 알려 주세요.

Android 폰이 없고 iPhone만 있으면 이 방법은 쓸 수 없습니다. 그때는 외부 사이트에서 APK를 받아 디컴파일만 하는 방법으로 바꿔야 합니다.

---

## #45

**Prompt**: ~/Downloads 폴더에 소모임+-+취미모임+동호회+앱+_+우리동네+취미+모임_5.8.3_APKPure.apk 이런 이름으로 있는 apk 인데 분석가능?

**Answer**: 모바일의 "소모임 앱에서 열기" 버튼이 이제 소모임 웹 페이지를 거치지 않고 앱의 모임 화면을 바로 엽니다. 타입 검사와 테스트는 모두 통과했지만, 실제 폰에서 앱이 열리는지는 아직 확인하지 못했습니다(연결된 기기가 없었습니다).

**기기별 동작**
- **Android**: `intent://…?type=63&gid=…` 주소로 앱을 엽니다. 앱이 없으면 소모임 안내 페이지 `/m/deeplink/{gid}`(스토어로 연결)로 자동으로 넘어갑니다.
- **iOS**: `somoim://…?type=63&gid=…` 주소로 엽니다. iOS는 앱이 없을 때 대신 갈 곳을 주소에 담을 수 없습니다. 그래서 1.5초 안에 화면이 가려지지 않으면(= 앱이 안 열리면) 같은 안내 페이지로 보냅니다.
- **데스크톱**: 지금처럼 웹 모임 페이지를 엽니다.

**바뀐 파일**
- `packages/somoim/src/snapshot.ts`: 기기에 맞는 앱 주소를 만드는 `groupAppLaunchUrl(gid, 'android' | 'ios')`를 추가했습니다.
- `packages/somoim/src/types.ts`: `ScheduleEvent`와 `UndatedPost`에 `groupId` 필드를 추가하고, 스냅샷을 만들 때 채우도록 했습니다.
- `playground/calendar/src/components/EventSheet.tsx`: 기기를 android / ios / 데스크톱으로 구분하고, 버튼이 새 주소를 쓰도록 바꿨습니다. iOS용 대체 이동도 여기 있습니다.
- `api.test.ts`에 주소 형식과 `groupId` 테스트를 추가했습니다. README에는 디컴파일로 확인한 내용(게시글을 여는 딥링크 번호는 없음)을 적었습니다.

**검증**
- somoim 테스트 198개, calendar 테스트 24개, `tsc`, eslint 모두 통과했습니다.
- 로컬 `events.json`을 다시 만들어 `groupId`가 들어간 것을 확인했습니다. 이 파일은 git에 올라가지 않는 로컬 파일입니다.
- 폰에서는 Android에 설치 여부별로 한 번씩, iOS Safari와 카카오톡 인앱 브라우저에서 확인해 주세요. 카카오톡 같은 인앱 브라우저는 앱을 여는 주소를 막는 경우가 있습니다.

바뀐 파일은 staging만 하고 커밋은 하지 않았습니다. 원래 있던 미커밋 변경도 staging에 함께 들어가 있습니다.

---

## #46

**Prompt**: 파싱해서 분석한 날짜가 실제 월일과 다르면 날짜찾지 못한 일정으로 분류해줘

**Answer**: 분석이 끝났습니다. 결론은, **이 앱(5.8.3)에는 밖에서 특정 게시글을 바로 여는 딥링크가 없습니다.**

## 앱으로 들어오는 길은 세 가지뿐
- **`somoim://com.friendscube.Somoim?type=N&...`**: 카카오 공유 링크도 같은 형식으로 들어와 여기서 처리됩니다. 받는 `type`은 40~43, 50~52, 60~63뿐이고, 이 가운데 게시글 id를 읽는 번호는 없습니다. 주로 쓰는 번호는 이렇습니다.
  - `63`: 모임 화면 (`gid`)
  - `52`: 모임 일정 (`gid`, `e_d`, `e_t`)
  - `50`·`51`·`61`·`62`: 초대, 모임 정보 (`gid`, `it`, `gn`, `ge`)
- **`https://somoim.friendscube.com/g/...`**: 주소의 마지막 부분을 모임 id로 보고 `type=63`으로 바꿔서 엽니다. 이것도 모임까지만 갑니다.
- **다른 앱에서 텍스트 공유(`SEND text/plain`)**: 게시글과는 관계없습니다.

## 게시글을 여는 코드는 푸시 알림에만 있음
게시글 id(`aid`)를 받아 글을 여는 코드는 `FCTabBarFragmentActivity`의 푸시 알림 처리 부분(알림 번호 40, 41, 52, 422, 440, 441)에만 있습니다. 그런데 이 화면은 manifest에서 외부 호출을 받지 않도록 되어 있습니다. 소모임 서버가 보낸 알림만 이 화면을 열 수 있고, 웹 링크나 `adb`로는 호출할 수 없습니다. 채팅방 공유도 같은 앱 안에서만 동작하는 길이라 밖에서 쓸 수 없습니다.

## 지금 할 수 있는 최선
- **모바일에서 모임 화면을 바로 열기**: 지금은 `/m/deeplink/{gid}` 웹 페이지를 한 번 거칩니다. 대신 Android는 `intent://com.friendscube.Somoim?type=63&gid=...#Intent;scheme=somoim;package=com.friendscube.somoim;end`, iOS는 `somoim://...type=63&gid=...`를 직접 쓰면 중간 페이지 없이 앱이 열립니다. 앱이 없으면 스토어로 보내지 않고 실패하므로 그 경우 처리가 필요합니다.
- **글을 찾기 쉽게 하기**: 모임 화면에서 사용자가 게시판으로 가서 글을 찾아야 합니다. 그래서 캘린더의 버튼 옆에 글 제목을 복사하는 기능을 두거나, "게시판에서 'OO' 글" 같은 안내를 보여 주는 방법이 현실적입니다.

앱 버전이 올라가면 게시글용 `type`이 추가될 수 있으니, 새 APK가 나오면 `FCAppActivity`의 `X(Uri)` 부분만 다시 보면 됩니다. 위 두 가지 중 적용하고 싶은 것이 있으면 말씀해 주세요.

---

## #47

**Prompt**: 모바일에서 모임화면을 바로열기 만 적용해줘.

**Answer**: Posts whose parsed date looks wrong now go to "날짜 미확인" instead of the calendar. I took "wrong" to mean **the weekday written in the post doesn't match the date's actual weekday**, e.g. "9/30(목)" when 9/30 is a Wednesday. If you meant a different case, tell me which. Tests pass (196 in somoim, 24 in the calendar), along with types and lint.

**What changed**
- **Before**: when the weekday didn't match, the code quietly kept the date (and could shift it to another year), then put the post on the calendar.
- **Now**: if the weekday doesn't fit the date in any plausible year, the post goes to "날짜 미확인". Posts that don't state a weekday stay on the calendar as before.
- **List row**: shows "9월 30일 (목)? 요일 불일치" in amber.
- **Detail sheet**: the 날짜 field shows "9월 30일 (목)?", and underneath, "9월 30일은 수요일이라 날짜·요일 중 하나가 틀렸어요".
- **Still works as before**: late 후기 posts whose weekday matches a year within about 6 months still go to that year. Dates that don't exist, like 9/31, were already sent to 날짜 미확인.
- **Changed test**: one existing test assumed "keep the date even when the weekday is a typo". I changed it to expect 날짜 미확인, since that's now the intended behavior.

**Check against real data**
- **No mismatches right now**: none of the 55 current posts or the 140 sample posts has a weekday that doesn't match its date.
- **No misparsed dates either**: every parsed date appears in its post and falls within a sensible range of the posting date.
- **Checked with a test post**: since there's no real case, I injected one in the browser to confirm the list row and sheet above display correctly.

If you've seen a specific post with a wrong date, send me its title and I'll trace why.

The earlier changes (status rules, horror sheet, date number readability, dimming) are all staged together with this and not yet committed or deployed. Should I commit and deploy?

---

## #48

**Prompt**: 여기까지 커밋후 배포

**Answer**: Committed, pushed and deployed: `a436788` is live at https://escape-from-home.vercel.app/.

I checked the live site after the deploy:
- **Data**: collected fresh on every request from the Seoul region, with no fallback marker.
- **New fields**: `roles` and `dateConflict` are in the response.
- **Role parsing**: 층간소음 reads as 쫄·탱 무관, and 싸패방 as 쫄 3명.
- **Styles**: the new CSS is live, including the horror sheet and the dimmed cells.

The deploy includes:
- **Status rules**: "마감 임박" is no longer treated as closed. A post also counts as closed when its headcount is full or its date has passed.
- **Horror**: role parsing (쫄/탱), and a distinct detail sheet with the blood drip, red tones and skull warning.
- **Weekday mismatch**: posts whose written weekday doesn't match the date go to "날짜 미확인", with an explanation in the list and sheet.
- **Calendar**: larger, bold date numbers, and finished events (마감, 완료, 펑) are dimmed.

---

## #49

**Prompt**: 푸쉬메세지론 이동가능하다매. 방법이 아예없나?

**Answer**: 웹 링크로 게시글까지 바로 가는 방법은 없습니다. 푸시 알림이 게시글을 열 수 있는 것은 앱이 자기 자신에게 여는 길이라서, 밖에서는 같은 길을 쓸 수 없습니다.

## 푸시 알림이 게시글을 여는 과정
1. 소모임 서버가 FCM(구글 푸시 서비스)으로 알림을 보냅니다. 여기에 알림 종류(`pt`)와 게시글 id(`aid`)가 들어 있습니다.
2. 앱의 `FCFirebaseMessagingService` → `FCFcmWorker` → `rh/b.java`가 알림을 받아 화면에 띄웁니다. 이때 알림을 누르면 탭 화면(`FCTabBarFragmentActivity`)이 열리도록 설정해 둡니다.
3. 사용자가 알림을 누르면 탭 화면이 게시글 id를 읽어 그 글을 엽니다.

탭 화면은 외부에서 호출할 수 없게 되어 있습니다. 알림은 앱이 직접 만든 것이라 예외로 열 수 있는 것입니다.

## 우회할 수 있는지 확인한 것
| 시도 | 결과 |
|---|---|
| `somoim://…?type=40&aid=…` | 딥링크 `type` 40~43은 푸시 알림 번호와 이름만 같고 실제로는 분석 로그(`kakaoMenu` 등)만 남깁니다. `aid`는 읽지 않습니다. |
| `intent://…;S.aid=…;i.pt=40;end`로 외부에서 받는 화면(`FCAppActivity`)에 값 실어 보내기 | `FCAppActivity`는 탭 화면을 열 때 새 intent를 만들고 `pt` 50/10/11과 `gid`만 넣습니다. 전달한 값은 탭 화면까지 넘어가지 않습니다. |
| 가짜 푸시 알림 보내기 | 소모임 서버의 FCM 인증 정보가 있어야 합니다. 앱의 푸시 수신 부분도 Google Play 서비스에서 온 것만 받으므로 흉내 낼 수 없습니다. |
| `adb shell am start -n …/FCTabBarFragmentActivity --es aid …` | 외부 호출이 막힌 화면이라 루팅한 본인 폰에서만 됩니다. 캘린더를 쓰는 다른 사람에게는 쓸 수 없습니다. |

## 남는 길
- **소모임이 기능을 추가하는 것**: 딥링크에 게시글용 `type`을 추가해 달라고 소모임 고객센터에 요청하는 방법입니다. 앱은 이미 게시글 id로 글을 여는 코드를 갖고 있어서, 딥링크 처리 부분에 분기를 하나 추가하면 되는 규모입니다.
- **소모임이 진짜 알림을 보내게 하기**: 예를 들어 글에 댓글을 달면 글쓴이나 관련된 사람에게 알림이 갑니다. 하지만 원하는 사람에게 원하는 때에 링크처럼 보낼 수는 없습니다.

지금 적용한 "모임 화면 바로 열기"가 현재 앱에서 할 수 있는 최선입니다. 새 앱 버전이 나오면 `FCAppActivity.X(Uri)`에 게시글용 번호가 생겼는지만 다시 확인하면 됩니다.

---

## #50

**Prompt**: 딥링크리스트는 매니패스트에 정의한것만 사용가능?

**Answer**: 반은 맞습니다. 매니페스트는 **밖에서 앱으로 들어올 수 있는 입구**를 정하고, 그 입구로 들어온 뒤 **실제로 무엇을 할지는 앱 코드**가 정합니다. 두 조건을 모두 통과해야 딥링크가 동작합니다.

## 1단계: 매니페스트가 입구를 정함
- 외부 공개로 표시된 Activity(`android:exported="true"`)만 다른 앱이나 브라우저가 열 수 있습니다. 소모임은 targetSdk 36이라 이 표시가 반드시 있어야 합니다.
- 그 Activity의 `intent-filter`(scheme, host, path)에 맞는 주소만 링크를 눌렀을 때 앱으로 들어옵니다.
- 공개 Activity라면 filter와 상관없이 **패키지명과 클래스명을 직접 지정해서 여는 것**도 가능합니다. 예를 들면 `adb shell am start -n 패키지/클래스` 같은 방식입니다. 이때 이름을 붙인 값(extras)도 함께 보낼 수 있습니다.

## 2단계: 앱 코드가 무엇을 할지 정함
- filter는 모양만 확인합니다. `somoim://com.friendscube.Somoim?아무값`은 전부 입구를 통과합니다.
- 통과한 뒤 어떤 화면으로 보낼지는 코드가 정합니다. 소모임은 `FCAppActivity.X(Uri)`의 `type` 분기가 그 역할을 합니다. 그래서 딥링크 목록은 매니페스트가 아니라 코드를 봐야 알 수 있고, 앞에서 찾은 40~43·50~52·60~63이 그렇게 코드에서 나온 목록입니다.

## 소모임 5.8.3의 실제 입구
매니페스트 전체를 확인해 보니, 외부에서 열 수 있는 화면은 **`FCAppActivity` 하나뿐**입니다. 이 화면이 받는 것은 다음과 같습니다.
- `somoim://com.friendscube.Somoim?...`
- 카카오 링크 스킴 (위와 같은 `type` 처리 코드로 들어감)
- `iamport` (결제에서 돌아올 때 사용)
- `https://somoim.friendscube.com/g/...` (모임 id로 바꿔 `type=63`으로 처리)
- 다른 앱에서 텍스트 공유 (`text/plain`)
- 앱 아이콘으로 실행

게시글을 여는 탭 화면(`FCTabBarFragmentActivity`)에는 외부 공개 표시가 없습니다. 그래서 이름을 직접 지정해서 여는 방법도 막혀 있습니다. 결국 게시글로 가려면 `FCAppActivity`의 코드를 통과해야 하는데, 그 코드에는 게시글로 보내는 분기가 없습니다. 이것이 앞에서 "방법이 없다"고 한 근거입니다.

---

## #51

**Prompt**: 모임게시판으로 이동하는 딥링크는 있댔지? 그거라도 적용해줘

**Answer**: 모임 게시판으로 바로 가는 딥링크는 없습니다. 제가 앞에서 확인한 것은 모임 화면(`type=63`)까지였는데, 모임 게시판도 된다는 뜻으로 들리게 말했습니다. 제 설명이 잘못됐습니다. 그래서 코드는 바꾸지 않았습니다.

## 모임 화면의 첫 탭이 정해지는 방식 (`FCEventActivity`)
모임 화면은 열릴 때 두 가지 값을 보고 첫 탭을 고릅니다. 하나는 푸시 알림 번호이고, 하나는 어디서 왔는지를 나타내는 진입 코드(`fromType`)입니다.
- **게시판 탭(`T0(1)`)**: 푸시 알림 422·440 등으로 열렸을 때만 이 탭이 열리고, 해당 글도 함께 열립니다.
- **다른 탭(`T0(3)`)**: 진입 코드가 14·54·150~152일 때 열립니다. 모두 앱 안에서 이동할 때 쓰는 값입니다.
- **나머지 경우**: 모임 정보 탭(`U0(0)`)이 열립니다.

딥링크 `type=63`은 URL에서 `gid`만 읽고 진입 코드를 **35로 고정**합니다. 그래서 항상 모임 정보 탭이 열리고, URL로 탭을 바꿀 방법이 없습니다. 다른 딥링크 `type`이 넘기는 값(20, 235, 236)도 게시판 탭으로 이어지지 않습니다.

## 결론
지금 적용한 "앱의 모임 화면 바로 열기"가 현재 앱에서 할 수 있는 한계입니다. 사용자는 모임 화면에서 게시판 탭을 한 번 더 눌러야 합니다.

원하시면 캘린더의 버튼 이름이나 안내 문구를 "모임 화면이 열리면 게시판 탭에서 글을 찾아 주세요"처럼 바꾸는 정도는 할 수 있습니다.

---

## #52

**Prompt**: 지금 구현된 버전은 이상하게 이동해. 위에 말한 딥링크로 그냥 첫화면도 좋으니 이동시켜줘

**Answer**: 이제 버튼이 앱의 모임 첫 화면 딥링크 하나로만 이동합니다. 중간에 다른 곳으로 한 번 더 이동하는 부분은 모두 뺐습니다. 타입 검사, 테스트 198개, eslint는 통과했지만 실제 폰에서는 아직 눌러 보지 못했습니다.

**이상하게 이동했던 이유로 보이는 것**
- **iOS**: 앱을 연 뒤 1.5초 타이머가 소모임 안내 페이지로 한 번 더 이동시켰고, 그 페이지가 다시 앱을 열려고 했습니다.
- **Android**: 앱이 없을 때 쓰는 대체 주소로 같은 안내 페이지를 넣어 두었는데, 이것도 비슷하게 꼬일 수 있었습니다.

**바꾼 것**
- 버튼은 이제 링크만 걸려 있고, 누를 때 도는 스크립트는 없습니다.
  - iOS: `somoim://com.friendscube.Somoim?type=63&gid={gid}`
  - Android: `intent://com.friendscube.Somoim?type=63&gid={gid}#Intent;scheme=somoim;…;package=com.friendscube.somoim;end`
- Android 주소는 소모임 웹이 쓰는 것과 똑같은 형식입니다.
- 앱이 없으면 Android는 Chrome이 Play 스토어를 열고, iOS는 아무 일도 일어나지 않습니다. 이 동작은 README와 테스트에 반영했습니다.

바뀐 파일은 staging만 했습니다. 폰에서 눌러 봤는데도 이동이 이상하면 어떻게 움직였는지 알려 주세요. 예를 들어 앱이 열리고 바로 다른 화면으로 넘어갔는지, 홈 화면이 열렸는지 같은 것입니다. 앱은 첫 설정(관심사 선택 등)을 마치지 않은 상태면 모임 화면을 바로 열지 않고 링크를 저장만 해 두는데, 그 경우일 수도 있습니다.

---

## #53

**Prompt**: 커밋하고푸쉬해

**Answer**: _(응답 대기 중…)_

---
