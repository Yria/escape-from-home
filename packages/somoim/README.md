# @escape-from-home/somoim

소모임 "방구석을 탈출하는 사람들" 게시판의 벙 글을 모아 캘린더용 일정(`ScheduleSnapshot`)으로 바꾸는 라이브러리입니다.
빌드 없이 TS 소스를 그대로 내보냅니다 (Vite / vitest / node 26 이 직접 읽음).

- `@escape-from-home/somoim` — 타입, 파서(`parseSchedule`, `parseParticipants`), 수집(`fetchArticles`, `buildSnapshot`). 브라우저에서도 import 가능하지만 소모임 API 에 CORS 가 없어 **수집은 서버(Node)나 dev 프록시에서만** 동작합니다.
- `@escape-from-home/somoim/node` — `writeSnapshot(path)` (JSON 파일 저장)

## 스냅샷 만들기

```sh
pnpm --filter @escape-from-home/somoim sync            # → playground/calendar/public/data/events.json
node packages/somoim/scripts/sync.ts /tmp/events.json  # 출력 경로 지정
```

## 규칙 요약

- 수집 범위: `buildSnapshot()` 은 기본으로 **일정 날짜가 오늘(KST) 기준 14일 전 이후**인 것만 남깁니다 (`pastDays`). 날짜 미확인 글은 게시일로 자릅니다.
  모임보다 먼저 올라오는 글을 놓치지 않도록 게시글은 14 + 30 = 44일 전까지 받습니다 (`since` 로 바꿀 수 있음).

- 게시판 API: `POST https://www.somoim.co.kr/api/articles` `{gid, wql: 20, s_t}` — 최신순 20건, 다음 쪽은 마지막 글의 `ot`. 상세 API 가 없어 본문은 ~120자만 옵니다.
- 시각: 소모임 값 + 1e9 = unix 초. 고정 공지의 `w_t`(2e9)는 가짜라 `ot` 사용.
- 분류: 관심사(I)=모집중, 자유(F)=마감, 모임후기(E)=완료. 제목·본문의 "마감"도 마감으로 봅니다. 공지·가입인사·투표는 제외.
- 공포: 제목·미리보기에 `공포`·`호러`·`공테`·`쫄`(쫄보)·`탱`(탱커)·`무섭`·`겁 많`/`겁쟁이`/`겁보`가 있으면 `horror: true`. `쫄깃`·`쫄면`·`탱탱`·`탱고`·`즐겁게`는 제외.
- 날짜: 제목 우선, 없으면 본문 첫 날짜. `M/D`, `M.D`, `M월 D일`, 연도 포함형, `1ㅇ월` 오타, 요일 힌트, 제목의 오늘/내일/이번주 X요일.
  연도는 게시일 기준이며 60일 넘게 과거면 다음 해, 요일이 ±1년과 맞으면 그 해.
- `3/3`·`(2/6)` 같은 인원 비율은 요일 없이 괄호 안이거나 본문에 있으면 날짜로 보지 않습니다.
- 참여자: 인원 표기 바로 뒤 같은 줄의 2~4자 이름 (`3/3 동건 미현 무성`, `(2/3): 이원형, 김가영`) → `members`.
- 시간: `19:50`, `19시 50분`, `7시반`, `7p50`, `오후 7시`, `1400-1500` 등. 오전/오후 표시 없는 1~9시는 오후로 봅니다.

```sh
pnpm --filter @escape-from-home/somoim test
```

## 링크

소모임에는 게시글 하나로 가는 주소가 없습니다 (웹 `/{gid}/{글id}` 는 404, `?aid=` 는 무시, 앱 링크 파일 없음).
그래서 `articleUrl` 은 웹 모임 페이지, `appUrl` 은 소모임의 `/m/deeplink/{gid}`(앱의 모임 화면을 열고 없으면 스토어로)입니다.
