# Branch: main

## #1

**Prompt**: Access to fetch at 'https://next-edition.co.kr/api/v2/rooms' from origin 'chrome-extension://cbgiddjkeimnldnbjgbgaconaebihhoj' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource. 에러발생함

**Answer**: manifest.json의 host_permissions에 zerohongdae.com만 등록되어 있어 다른 도메인으로의 요청이 CORS로 차단되었습니다. 모든 provider의 API 도메인(next-edition.co.kr, keyescape.co.kr, beatphobia.co.kr)을 host_permissions에 추가하여 해결했습니다.

---

## #2

**Prompt**: 지금 익스텐션 사이드에 고정하려면 manifest 수정해야한대매

**Answer**: Chrome Side Panel API를 활용하도록 manifest.json을 수정했습니다. `sidePanel` 권한과 `side_panel.default_path` 설정을 추가하여 익스텐션을 사이드 패널에 고정할 수 있게 했습니다. 기존 팝업 기능은 그대로 유지됩니다.

---

## #3

**Prompt**: 지금 보면 UI 에서 시간대를 하게 했는데 그 시간대안에 빈자리있는거 찾아야하는거 아냐?

**Answer**: availability-watcher의 findAvailableSlots가 시간 범위 필터링 없이 모든 빈 슬롯을 반환하고 있었습니다. isTimeInRange 헬퍼를 추가하고, startWatching에 startTime/endTime 파라미터를 전달하여 UI에서 설정한 시간대 범위 내의 빈 슬롯만 감지하도록 수정했습니다. messaging 타입과 background index도 함께 수정.

---

## #4

**Prompt**: zerohongdae 의 submitBooking 구현을 curl 'https://zerohongdae.com/reservation' ... 이 api 를 호출하는걸로 구현해줘.

**Answer**: curl 명령 분석 결과 POST /reservation 엔드포인트에 themePK, reservationTime, reservationDate, name, phone, people, paymentType, policy 파라미터를 form-urlencoded로 전송하는 구조임을 확인. ZerohongdaeBookingPayload에 people 필드를 추가하고, submitBooking 함수에 세션(CSRF+쿠키) 기반 POST 요청을 구현. index.ts의 book 메서드에서 BookingRequest를 payload로 변환하여 연결 완료.

---

## #5

**Prompt**: 현재 예약시작과 끝이 익스텐션이 재실행될때 어떤 형식으로 반영되는지 확인해봐.

**Answer**: 예약 시간은 slotDatetime(ISO 8601 문자열)과 slotEndTime(HH:MM 문자열)으로 처리되며 Date 객체는 사용하지 않아 직렬화 문제는 없습니다. 그러나 BookingTask가 chrome.storage에 저장되지 않고 백그라운드 Service Worker 메모리에만 존재하므로, 익스텐션 재시작 시 진행 중인 모든 예약 작업이 손실됩니다. 사용자 정보와 업체 선택만 chrome.storage.local에 영속화되어 있는 상태.

---

## #6

**Prompt**: 현재 submitBooking 이 구현되지 않았을때 액션을 수행하게 하는데 이게 지금 너무 복잡하게 구현되어 있는거 같아. 각 프로바이더들마다 상황이 다를텐데 복잡한 구조가 될수록 이를 뒷받침하기위해 베이스가 더욱 복잡해지는것 같은데 인스턴트하게 스크립트로 돌릴 수있는 구조로 가능할까?

**Answer**: ProviderAdapter의 선택적 메서드(book?, buildActions?, cancel?)를 단일 execute(ctx: ExecutionContext) 메서드로 통합하여 프로바이더가 내부적으로 API 예약이든 폼 자동화든 결정하도록 변경. 주요 변경:
- ExecutionContext/ExecutionResult 타입 추가, BookingTaskStatus에서 found 제거
- BookingEngine을 단순 스케줄러로 축소 (attemptDirectBooking + attemptAvailabilityCheck → 단일 attemptBooking)
- found는 프로바이더→엔진 내부 계약으로만 존재, UI에는 success로 매핑
- AvailabilityWatcher 전체 삭제, 메시지 타입 4개 제거
- zerohongdae의 execute에서 API 직접 예약 시도 → 실패 시 빈자리 확인 + 폼 자동화 fallback

---

## #7

**Prompt**: 예약 시작/끝 시간의 익스텐션 재시작 시 복원 문제 해결. 사이드 패널 열림 시 setInterval(10초), 닫힘 시 chrome.alarms(30초)로 전환하는 듀얼 전략 구현.

**Answer**: Service Worker의 setInterval은 SW 종료 시 함께 사라지는 문제를 해결하기 위해 듀얼 타이머 전략을 구현. 주요 변경:
- storage에 BookingTask 영속화(saveBookingTasks/loadBookingTasks) 추가
- booking-engine에 restore/persist/setPanelConnected/tickOnce 메서드 추가
- background/index.ts에 chrome.runtime.onConnect로 패널 연결 감지, SW 시작 시 restore() 호출
- main.tsx에서 chrome.runtime.connect({ name: 'panel' })로 연결 등록
- availability-watcher는 이미 #6에서 삭제되어 적용 대상 아님

---

## #8

**Prompt**: 예약화면에 썸네일 안나와

**Answer**: MonitoringPage에서 monitor-card의 썸네일이 항상 빈 `<div>`로 렌더링되고 있었습니다. BookingTask 타입에 imageUrl이 없어 이미지 데이터가 전달되지 않았습니다. 주요 변경:
- BookingTask 타입에 imageUrl? 필드 추가
- MainPage에서 태스크 생성 시 theme.imageUrl을 함께 전달
- MonitoringPage에서 imageUrl이 있으면 `<img>` 태그로 렌더링

---

## #9

**Prompt**: 익스텐션이 사이드바로 열릴때 크기가 조금 잘려보이는데 너비가 맞는 반응형 디자인이 되도록 해줘.

**Answer**: body의 width가 360px로 고정되어 사이드바 패널 너비보다 넓을 때 잘리는 문제였습니다. width: 100%, min-width: 280px, max-width: 400px로 변경하고, 불필요한 max-height: 600px도 제거하여 사이드바 크기에 맞게 반응형으로 조절되도록 수정했습니다.

---

## #10

**Prompt**: 설정누르고 저장눌렀을때 복귀하는 화면은 예약시도중이지 않을땐 예약화면, 시도중일땐 예약화면 이어야해

**Answer**: App.tsx에서 SettingsPage의 onBack 콜백이 항상 'main'으로 이동하던 것을 수정. tasks 배열에서 pending/attempting 상태의 태스크가 있는지 확인하여, 활성 태스크가 있으면 monitoring 페이지로, 없으면 main 페이지로 이동하도록 변경. handleSave에서 onBack()을 호출하므로 저장 버튼과 뒤로가기 버튼 모두 동일하게 적용됨.

---

## #11

**Prompt**: 한참 잘 작동하다가 다시 돌아오면 로그가 멈춰있어

**Answer**: SW 재시작 후 로그가 멈추는 원인은 restore()와 setPanelConnected() 사이의 레이스 컨디션이었습니다. restore()가 async라 완료 전에 패널이 연결되면 running이 아직 false여서 타이머가 시작되지 않고, restore() 완료 후에는 startTimer()를 호출하지 않았습니다. 3가지 수정:
- booking-engine.ts의 restore()에서 running = true 후 startTimer() 호출 추가
- background/index.ts의 onConnect에서 initPromise.then()으로 감싸 레이스 컨디션 방지
- main.tsx에서 port 끊김 시 자동 재연결 로직 추가 (SW 재시작 대응)

---

## #12

**Prompt**: background, foreground 상황, 컴퓨터가 슬립했다가 다시 깨어났을때 등등상황에서 재시작할 방법이 있나

**Answer**: 현재 커버되는 시나리오(패널 열림/닫힘, SW 재시작)를 정리하고 누락된 부분을 보완. 즉시 복귀까진 불필요하고 재시작 수준이면 충분하다는 피드백에 따라 두 가지 추가:
- chrome.runtime.onStartup 리스너 추가 — 브라우저 재시작 시 alarm 재생성
- ensureAlarm() 메서드 추가 — running 상태인데 alarm이 사라진 경우 재생성하는 안전장치

---

## #13

**Prompt**: 사용자가 취소하기전까지 무한재시도. 근데 이거 슬립모드 들어가면 재시도 안하는거지?

**Answer**: OS 슬립 시 Chrome 프로세스 자체가 멈추므로 alarm/setInterval 모두 안 돌아가고, 깨어나면 이어서 재개됩니다. maxRetries 제한을 제거하여 사용자가 직접 취소할 때까지 무한 재시도하도록 변경:
- retryOrFail에서 maxRetries 비교 제거, 항상 pending으로 복귀
- BookingEngineConfig에서 maxRetries 필드 제거
- background/index.ts에서 maxRetries 설정 제거

---

## #14

**Prompt**: zerohongdae reservation api 호출 시점과 전화번호 형식 확인

**Answer**: Playwright로 실제 예약 페이지를 검증한 결과, mask-phone 클래스가 숫자를 010-1234-5678 형식으로 자동변환하며, 서버에도 하이픈 포함 형식으로 전송됨을 확인. 두 가지 수정:
- execute 순서를 빈자리 확인 → 있을 때만 예약 시도로 변경 (불필요한 POST /reservation 호출 제거)
- submitBooking 시 phone을 formatPhone()으로 하이픈 포함 형식으로 변환

---

## #15

**Prompt**: https://www.keyescape.com/reservation2.php 여기도 새로운 프로바이더로 추가하고싶은데, 코드를 보고 예약페이지까지 구현가능한지 확인해봐

**Answer**: KeyEscape 예약 시스템의 API 구조를 분석하여 구현 가능성을 확인했습니다. 주요 발견:
- 단일 API 엔드포인트(POST /controller/run_proc.php)에 `t` 파라미터로 액션 구분
- `get_theme_info_list`(테마 조회), `get_theme_time`(시간대 조회) API가 세션/CSRF 없이 동작 확인
- 13개 지점(에버랜드, 강남, 홍대, 부산 등) 지원
- fetchThemes, fetchTimeSlots, execute(found) 모두 구현 가능
- **단, reservation2.php에 Google reCAPTCHA가 있어 API 직접 예약(booked)은 불가능** — 빈자리 발견 시 폼 자동입력까지만 수행하고 reCAPTCHA+최종제출은 사용자가 직접 해야 함

---

## #16

**Prompt**: recaptcha 를 우회할방법이 있을까?

**Answer**: 서버 측 reCAPTCHA 검증을 확인하기 위해 실제 API 호출 테스트를 수행했습니다. g-recaptcha-response 없이 전송하면 "잘못된 접근입니다", 가짜 토큰으로 전송하면 "올바르지 않은 접근입니다"로 에러 메시지가 다르게 나와 서버가 Google API로 토큰을 검증하고 있음을 확인. 프로그래밍적 우회는 불가능하지만, 현재 아키텍처의 found+actions 패턴으로 충분히 대응 가능 — 읽기 API(테마/시간 조회)는 reCAPTCHA 불필요하므로 빈자리 감시는 자동화하고, 폼 자동입력 후 사용자가 reCAPTCHA 체크+예약 버튼만 클릭하면 됨.

---

## #17

**Prompt**: 진행해

**Answer**: /hardwork 스킬로 3인 팀(기획자+OOP개발자+프론트엔드개발자)을 구성하여 KeyEscape 프로바이더를 구현했습니다. 주요 결정사항:
- 단일 keyescape 프로바이더가 12개 지점을 Promise.allSettled로 병렬 호출
- Theme.id: `keyescape:{zizum_num}:{theme_num}:{info_num}` 4-part 형식
- Core 인프라 확장: PageActionStep 타입, openAndExecuteSteps 함수, booking-engine steps 분기 추가
- reservation1→2 다단계 네비게이션을 step 체이닝으로 처리
- 36개 테스트 전체 통과, 크로스 리뷰 OK

구현 파일:
- src/providers/keyescape/ (api.ts, mapper.ts, actions.ts, index.ts, test)
- src/core/autofill.ts, src/providers/types.ts, src/background/booking-engine.ts
- src/providers/registry.ts, manifest.json

---

## #18

**Prompt**: 자동예약시작 버튼을 항상 하단에 고정시킬 수 있을까

**Answer**: MainPage의 bottom-bar(자동 예약 시작 버튼 영역)가 스크롤에 따라 움직이던 문제를 수정. CSS에서 `.bottom-bar`에 `position: sticky; bottom: 0`, 배경색, `border-top`, `margin-top: auto`, `z-index: 10`을 추가하여 테마 목록이 길어져도 항상 하단에 고정되도록 변경. 불필요한 divider도 제거.

---

## #19

**Prompt**: 누르면 이동할 수 있다는 의미의 ExternalLink 이미지 들어간건 알겠는데 위치가 너무 뜬금없어. 그 위치가 자연스럽게 보이게끔 해줘

**Answer**: MonitoringPage의 ExternalLink 아이콘이 카드 우측 상단에 독립적으로 떠 있어 뜬금없어 보이는 문제를 수정. 아이콘을 테마명 바로 옆으로 이동시켜 "클릭하면 외부 이동" 의미가 자연스럽게 전달되도록 변경. monitor-card-right 래퍼를 제거하고 status 뱃지는 카드의 직접 flex 자식으로 배치. monitor-card-name에 inline-flex + gap 스타일 추가.

---

## #20

**Prompt**: KeyEscape 예약 페이지(https://www.keyescape.com/reservation1.php)의 datepicker DOM 구조를 파악해야 합니다. 현재 코드에서 사용하는 셀렉터 `td.available a:not(.ui-state-disabled)`가 실제 페이지에서 null을 반환합니다. Playwright MCP 브라우저를 사용해서 datepicker 영역의 실제 DOM 구조를 확인해주세요.

**Answer**: Playwright MCP 브라우저가 닫혀 있어 curl로 페이지 소스를 직접 가져와 분석. KeyEscape는 jQuery UI datepicker가 아닌 자체 커스텀 datepicker(generateDatepickerHtml 함수)를 사용함을 확인. 주요 발견:
- 날짜 셀은 `<td class="selDate available" data-date="2026-04-06">` 형태이며 내부에 `<a>` 태그 없음 — 이것이 null 반환 원인
- 선택 가능: `td.selDate.available`, 불가: `td.selDate.disabled`
- data-date에 전체 날짜("2026-04-06")가 저장됨 (day만이 아님)
- 시간 라디오: `input.selThemeTimeNum` — 현재 코드 정확함
- 다음 버튼: `#btnNext`가 아닌 `.btn_next_step`이 실제 셀렉터

---

## #21

**Prompt**: 예약할때 보면 지금 날짜만 잡는데 날짜시간~날짜시간으로 폭넓게 탐색하게 해줘

**Answer**: 단일 날짜+시간대 방식에서 시작 날짜시간~종료 날짜시간 범위로 탐색하도록 전면 변경. 주요 변경:
- BookingTask의 slotDatetime+slotEndTime을 startDateTime+endDateTime(둘 다 ISO 8601)으로 교체
- MainPage UI를 "시작" (날짜+시간), "종료" (날짜+시간) 두 줄 구조로 변경, 시작일 변경 시 종료일 자동 보정
- MonitoringPage 예약 조건 표시를 날짜시간 범위로 변경
- keyescape/zerohongdae provider의 execute()에서 startDate~endDate 범위의 모든 날짜를 순회하며 빈자리 탐색, 각 날짜별 시간 필터 경계 자동 조정
- CSS에 datetime-row 스타일 추가

---

## #22

**Prompt**: 서비스 처음 켰을때, 기본정보 입력안되어있으면 설정화면부터 보이게 해.

**Answer**: App.tsx에서 초기 페이지 상태를 null로 시작하고, useUserSettings의 loading 완료 후 userInfo가 없거나 name/phone이 비어있으면 settings 페이지로, 그렇지 않으면 main 페이지로 이동하도록 변경. loading 중에는 null을 반환하여 빈 화면 표시.

---

## #23

**Prompt**: 빈자리를 탐지했을때, 현재는 상황에 따라 누르면 이동하거나 아니면 자동신청되는데, 기획을 수정할게. 1. 탐지는 한번으로 끝나는게 아니고 계속 탐색. 2. 아이템에 탐지된 방탈이름과 날짜시간 같이표시, 3. 눌렀을때 예약 api 가 있으면 바로 예약시도, 없으면 링크이동해서 autofill (이때 링크이동하는 테마는 외부링크아이콘 표시) 그리고 지금 또 autofill 작동안하는데 버그수정도 같이해

**Answer**: "감지"와 "예약"을 완전히 분리하는 패러다임 전환 수행. 3인 팀(기획자+OOP개발자+프론트엔드개발자) 병렬 작업. 주요 변경:
- FoundSlot 타입 신규 추가 (id, date, time, hasApi, bookingUrl), BookingTask에 foundSlots[] 필드 추가
- Provider execute()를 감지 전용으로 분리, zerohongdae에 book() 메서드 추가 (사용자 클릭 시 API 예약)
- booking-engine handleResult: found 시 status를 pending 유지 + foundSlots 축적 (dedup), 최초 발견 시만 notification
- ATTEMPT_SLOT_BOOKING 메시지 타입 추가: 슬롯 클릭 → provider.book() 또는 autofill fallback
- MonitoringPage: 카드 하단에 발견 슬롯 목록(날짜/시간) 표시, hasApi=false 슬롯에 ExternalLink 아이콘
- autofill 버그 수정: openAndExecute/openAndExecuteSteps의 race condition — 리스너를 탭 생성 전에 선등록하여 complete 이벤트 누락 방지
- 크로스 리뷰에서 notification 클릭 PendingNotif 키 불일치 발견 → taskId 키로도 첫 번째 슬롯 데이터 저장하여 해결

---

## #24

**Prompt**: build 에러 수정

**Answer**: tsc 빌드 시 5개 에러를 수정했습니다. 주요 수정:
- booking-engine.ts: 미사용 import FoundSlot, removePendingNotif 제거
- keyescape/actions.ts: 미사용 파라미터 zizumNum → _zizumNum으로 변경
- zerohongdae/mapper.ts: ZerohongdaeBookingPayload 타입에 맞게 time → reservationTime(HH:MM:SS), people 필드 추가
- zerohongdae.test.ts: vitest의 beforeAll import 누락 추가

---

## #25

**Prompt**: 설정화면에 현재 등록된 업체(프로바이더) 목록 노출되게 해줘.

**Answer**: SettingsPage에 등록된 업체 목록 섹션을 추가했습니다. 주요 변경:
- getAllProviders()로 프로바이더 목록을 가져와 섹션으로 표시
- 각 업체 아이템 클릭 시 websiteUrl로 외부 링크 이동 (ExternalLink 아이콘 포함)
- 알림 설정과 저장 버튼 사이에 "등록된 업체" 섹션 배치
- provider-list, provider-item CSS 스타일 추가

---

## #26

**Prompt**: 방탈출 예약 시스템 디자인을 구현할거야. 근데 내게 아니고 다른 업체의 것을 가져와 목록화해서 뿌릴거야. 여기서 할 수 있는 서비스는 1. 예약하고 싶은 날짜와 시간을 선택하고 2. 원하는 방탈출 서비스를 "여러개" 선택하면 3. 자동으로 예약시도를 하다가 성공하면 나에게 팝업으로 알리는 크롬 익스텐션이야. (이후 디자인 작업 연속)

**Answer**: Pencil 디자인 도구를 활용하여 크롬 익스텐션의 전체 UI 디자인을 구현. Deep Space Neon 다크 테마 기반으로 4개 화면(메인/설정/모니터링/성공) + 7개 재사용 컴포넌트를 제작. 이후 추가 요청 반영:
- 시간 선택을 개별 칩에서 범위(시작~종료) 드롭다운으로 변경
- 인원수를 설정→메인 예약 조건 섹션으로 이동
- 헤더 아래 활성 예약 상태 배너(보라색, 클릭 시 모니터링 이동) 추가
- 디자인 변경사항을 코드에 반영: MainPage에 playerCount state/UI와 activeTasks 배너, SettingsPage에서 playerCount 제거, App.tsx에서 tasks 전달, CSS 추가

---

## #27

**Prompt**: https://www.xn--2e0b040a4xj.com/reservation?branch=2&theme=&date=2026-07-09#list 여기 사이트 예약할건데 구조파악하고 기존처럼 방탈 등록해줘

**Answer**: 지구별방탈출(지구별.com, punycode 도메인) 예약 사이트 구조를 파악하고 새 provider로 등록했습니다.

- **구조 분석**: Laravel 서버 렌더링. `GET /reservation?branch=&theme=&date=`로 지점별 테마+시간대 HTML 렌더링(테마 지정 시 단일 섹션). 지점 3개(대구점1/홍대어드벤처점2/홍대라스트시티점4). 예약가능 슬롯은 `button.eveReservationButton` + `.eveHiddenData` JSON 보유. 예약 흐름은 슬롯 클릭 → `POST /reservation/create` → 정보입력 폼(name/phone/people/payment_method=21 가상계좌/policy) → `#eveReservationBtn` 최종 제출 2단계.
- **구현**: keyescape 패턴(HTML 스크래핑 + 멀티스텝 autofill, JSON 예약 API 없음)을 따라 api/mapper/actions/index/test 5개 파일 생성. Theme id는 `jigubyeol:{branch}:{theme}`, 슬롯 선택은 렌더 순서 기반 nth-child 셀렉터 사용. registry 등록 + manifest host_permission 추가. UI는 getAllProviders()로 동적 노출되어 추가 작업 불필요.
- **적대적 리뷰 워크플로우**(4개 차원 병렬 리뷰+검증)로 버그 검출 후 수정: (HIGH) 인원 구분자가 `-`/`~` 혼용인데 정규식이 하이픈만 매칭해 다수 테마 min/max 오파싱 → 물결/대시 변형 포함하도록 수정. (LOW) todayStr가 UTC 기준이라 execute의 로컬시간과 불일치 → 로컬 날짜로 통일. playerCount 미검증 select는 기존 provider와 동일 동작이라 유지.
- **검증**: tsc -b 통과, 전체 46개 테스트 통과, 실데이터 파싱 확인(잔향 10:15/23:05 예약가능 탐지, 대구점 물결 테마 min/max 정상).

---
