---
name: escape
description: 방탈출 예약 시스템에 새로운 업체(Provider)를 추가합니다. 업체 이름과 API 정보를 제공하면 어댑터, 매퍼, 테스트 코드를 자동 생성합니다.
argument-hint: "[provider-id] [업체 한글 이름] [웹사이트 URL]"
allowed-tools: Read Write Edit Grep Glob Bash(npx vitest run) Bash(npx tsc -b)
---

# 새 업체 추가: $ARGUMENTS

## 사용자가 제공해야 하는 정보

아래 정보가 인자로 주어지지 않았으면 사용자에게 물어봐:

1. **provider-id**: 영문 소문자 식별자 (예: `keyescape`, `nexted`, `masterescape`)
2. **업체 한글 이름** (예: `마스터이스케이프`)
3. **웹사이트 URL** (예: `https://masterescape.co.kr`)
4. **외부 API 스펙 또는 응답 예시**: 테마 목록, 시간대 조회, 예약 API의 엔드포인트와 응답 형태. 사용자가 모르면 합리적인 추측으로 작성하되 주석으로 `// TODO: 실제 API에 맞춰 수정 필요` 표시.
5. **필수 사용자 입력 필드**: `name`, `phone`, `email` 중 해당 업체가 요구하는 것 (기본: `['name', 'phone']`)

## 생성해야 하는 파일 5개

### 1. `src/providers/{provider-id}/api.ts`

외부 API 호출 담당. 이 파일만 외부 세계와 접촉한다.

**반드시 포함할 내용:**
- `{Provider}RawTheme` — 외부 테마 응답 타입
- `{Provider}RawSlot` — 외부 시간대 응답 타입 (시간 표현 방식은 업체마다 다름)
- `{Provider}BookingPayload` — 예약 요청 페이로드 타입
- `{Provider}BookingResponse` — 예약 응답 타입
- `fetchRawThemes()` — 테마 목록 조회 함수
- `fetchRawSlots(id, date)` — 시간대 조회 함수 (id 파라미터 타입은 업체별로 다름)
- `submitBooking(payload)` — 예약 제출 함수

**참고**: 기존 업체의 api.ts를 참조하되, 외부 API 필드명/형태는 업체마다 완전히 다르므로 단순 복사는 금지.

### 2. `src/providers/{provider-id}/mapper.ts`

외부 ↔ 내부 모델 변환 담당. 양방향 매핑 함수.

**반드시 포함할 함수:**
- `toTheme(raw)` → 내부 `Theme` 변환. id는 반드시 `{provider-id}:{외부ID}` 형식
- `toTimeSlot(themeId, date, raw)` → 내부 `TimeSlot` 변환. datetime은 ISO 8601
- `to{Provider}Payload(request)` → 내부 `BookingRequest`를 외부 페이로드로 변환
- `toBookingResult(raw)` → 외부 응답을 내부 `BookingResult`로 변환

**핵심 규칙:**
- `const PROVIDER_ID = '{provider-id}'` 상수 선언
- Theme.id는 항상 `${PROVIDER_ID}:${externalId}` 패턴
- datetime은 항상 ISO 8601 (`YYYY-MM-DDTHH:mm:ss`)
- 내부 타입 import는 `../../core/types`에서
- 외부 타입 import는 같은 폴더 `./api`에서

### 3. `src/providers/{provider-id}/actions.ts`

페이지 폼 자동화 스크립트. 예약 페이지에서 자동으로 폼을 채우는 `PageAction[]`을 조립한다.

**반드시 포함할 함수:**
- `buildReservationActions(themePK, date, time, playerCount, userInfo?)` → `PageAction[]`
  - PageAction 타입: `fill`, `click`, `check`, `select`, `wait`, `delay`
  - 예약 페이지의 DOM 구조를 분석하여 selector를 정확히 지정
  - 단계별로 `wait` 액션을 넣어 DOM 로드를 보장

**참고**: `src/core/autofill.ts`의 `PageAction` 타입 정의를 확인하고, 기존 `zerohongdae/actions.ts`를 참조하되 각 업체 예약 페이지 구조에 맞게 작성.

### 4. `src/providers/{provider-id}/index.ts`

팩토리 함수. `ProviderAdapter` 계약을 만족하는 객체 반환.

**형태:**
```typescript
import type { ProviderAdapter, ExecutionContext, ExecutionResult } from '../types';
import { fetchRawThemes, fetchRawSlots, submitBooking } from './api';
import { toTheme, toTimeSlot } from './mapper';
import { buildReservationActions } from './actions';

const RESERVATION_URL = '{URL}';

export const create{Provider}Provider = (): ProviderAdapter => ({
  meta: {
    id: '{provider-id}',
    name: '{한글 이름}',
    websiteUrl: RESERVATION_URL,
    requiredFields: ['name', 'phone'],
  },
  fetchThemes: async (date) => { ... },
  fetchTimeSlots: async (themeId, date) => { ... },
  execute: async (ctx: ExecutionContext): Promise<ExecutionResult> => {
    const { task, userInfo } = ctx;
    // 1차: API 직접 예약 시도 (submitBooking이 구현된 경우)
    // 2차: 빈자리 확인 → buildReservationActions()로 폼 자동화 액션 조립
    // → { status: 'found', actions, notificationUrl } 반환
    // 빈자리 없으면 → { status: 'not_found' } 반환
  },
});
```

**execute 반환값 규칙:**
- `{ status: 'booked' }` — API로 직접 예약 완료
- `{ status: 'found', actions, notificationUrl }` — 빈자리 발견 + 폼 자동화 (엔진이 자동으로 openAndExecute 수행)
- `{ status: 'not_found' }` — 빈자리 없음 (엔진이 재시도)
- `{ status: 'failed' }` — 복구 불가 실패

### 5. `src/providers/{provider-id}/{provider-id}.test.ts`

mapper 함수와 provider meta에 대한 단위 테스트.

**반드시 포함할 테스트:**

```
describe('{provider-id} mapper', () => {
  // 외부 raw 데이터 fixtures 선언

  describe('toTheme', () => {
    - 외부 테마를 내부 Theme으로 변환한다
    - id가 '{provider-id}:{외부ID}' 형태인지 확인
  })

  describe('toTimeSlot', () => {
    - 예약 가능 슬롯 변환
    - 예약 불가 슬롯의 available=false 확인
    - datetime이 ISO 8601 형식인지 확인
  })
})

describe('{provider-id} provider', () => {
  - meta 정보 올바른지 (id, name, requiredFields)
  - ProviderAdapter 인터페이스를 만족하는지 (fetchThemes, fetchTimeSlots, execute 함수 존재 확인)
})
```

## 레지스트리 등록

파일 4개 생성 후, `src/providers/registry.ts`에 새 업체를 등록:

1. import 추가: `import { create{Provider}Provider } from './{provider-id}';`
2. `providerFactories` 객체에 항목 추가: `{provider-id}: create{Provider}Provider,`

## 검증

모든 파일 생성 + 레지스트리 등록 후 반드시 실행:

1. `npx tsc -b` — TypeScript 타입 체크 통과
2. `npx vitest run` — 기존 + 새 테스트 전부 통과

둘 다 통과해야 완료.

## 참고할 내부 타입 (절대 수정하지 말 것)

`src/core/types.ts`의 주요 타입:
- `Theme`: id, providerId, name, difficulty?, genre?, minPlayers, maxPlayers, duration, imageUrl?, branchName?
- `TimeSlot`: themeId, datetime (ISO 8601), available, remainingSlots?
- `BookingTask`: id, providerId, themeId, themeName, startDateTime, endDateTime, playerCount, status, retryCount, maxRetries, ...
- `UserInfo`: name, phone, email?

`src/providers/types.ts`의 주요 타입:
- `ProviderAdapter`: meta, fetchThemes, fetchTimeSlots, **execute(ctx: ExecutionContext) => Promise\<ExecutionResult\>**
- `ExecutionContext`: { task: BookingTask, userInfo: UserInfo | null, signal?: AbortSignal }
- `ExecutionResult`: { status: 'booked'|'found'|'not_found'|'failed', message?, confirmationId?, actions?: PageAction[], notificationUrl? }

`src/core/autofill.ts`의 `PageAction` 타입:
- `fill`: { type: 'fill', selectors: string[], value: string }
- `click`: { type: 'click', selector: string }
- `check`: { type: 'check', selector: string }
- `select`: { type: 'select', selector: string, value: string }
- `wait`: { type: 'wait', selector: string, timeout?: number }
- `delay`: { type: 'delay', ms: number }

**핵심 흐름**: BookingEngine이 주기적으로 fetchTimeSlots → 빈 슬롯 발견 → execute(ctx) 호출.
- execute가 `{ status: 'found', actions, notificationUrl }` 반환 시 → 엔진이 자동으로 `openAndExecute(url, actions)` 수행 (페이지 열고 스크립트 실행)
- execute가 `{ status: 'booked' }` 반환 시 → 예약 완료
- 부킹 API가 없는 업체는 execute에서 빈자리 확인 + buildReservationActions()로 폼 자동화만 하면 됨
