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

**Answer**: _(응답 대기 중…)_

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
