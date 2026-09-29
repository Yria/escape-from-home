import { describe, it, expect, beforeAll } from 'vitest';
import {
  fetchReservationHtml,
  parseThemes,
  parseThemeOptions,
  parseSlots,
  BRANCHES,
} from './api';
import { toTheme, toTimeSlot } from './mapper';
import { createJigubyeolProvider } from './index';

// ── fixture: 실제 페이지 구조를 축약한 HTML ──
const FIXTURE_HTML = `
<select class="bs-bb" name="theme" value="" onChange="this.form.submit()">
  <option value="">전체</option>
  <option value="23">잔향</option>
  <option value="8">미스터리</option>
  <option value="2">만월 &lt;&lt;꿈을 훔치는 요괴&gt;&gt;</option>
</select>

<section class="res-item clear-b">
  <figure class="pax3"><img src="https://www.xn--2e0b040a4xj.com/storage/theme/janghyang.png" alt="잔향"></figure>
  <div class="eve-mopa">
    <h2 class="ff-bhs pax3">잔향</h2>
    <table class="ff-bhs pax3">
      <tr><th>장르</th><td>드라마 / 서스펜스</td></tr>
      <tr><th>인원</th><td>2-4</td></tr>
      <tr><th>시간</th><td>60분</td></tr>
      <tr><th>공포</th><td>1</td></tr>
      <tr><th>난이도</th><td>3.5</td></tr>
    </table>
    <ul class="res-times kit">
      <li class="pax3"><div class="res-times-btn">
        <button class="active1 eveReservationButton" type="button">
          <label>예약가능</label><span class="ff-bhs">10:15</span><em></em>
          <div class="d-n eveHiddenData">{&quot;branch&quot;:2,&quot;theme&quot;:23,&quot;date&quot;:&quot;2026-07-09&quot;,&quot;time&quot;:&quot;10:15&quot;}</div>
        </button>
      </div></li>
      <li class="pax3"><div class="res-times-btn">
        <button type="button"><label>예약불가</label><span class="ff-bhs">11:40</span><em></em></button>
      </div></li>
      <li class="pax3"><div class="res-times-btn">
        <button class="active1 eveReservationButton" type="button">
          <label>예약가능</label><span class="ff-bhs">23:05</span><em></em>
          <div class="d-n eveHiddenData">{&quot;branch&quot;:2,&quot;theme&quot;:23,&quot;date&quot;:&quot;2026-07-09&quot;,&quot;time&quot;:&quot;23:05&quot;}</div>
        </button>
      </div></li>
    </ul>
  </div>
</section>

<section class="res-item clear-b">
  <figure class="pax3"><img src="https://www.xn--2e0b040a4xj.com/storage/theme/mystery.png" alt="미스터리"></figure>
  <div class="eve-mopa">
    <h2 class="ff-bhs pax3">미스터리</h2>
    <table class="ff-bhs pax3">
      <tr><th>장르</th><td>추리</td></tr>
      <tr><th>인원</th><td>2~6</td></tr>
      <tr><th>시간</th><td>70분</td></tr>
      <tr><th>난이도</th><td>4</td></tr>
    </table>
    <ul class="res-times kit">
      <li class="pax3"><div class="res-times-btn">
        <button type="button"><label>예약불가</label><span class="ff-bhs">13:20</span><em></em></button>
      </div></li>
    </ul>
  </div>
</section>
`;

// ── 1. parseThemeOptions ──

describe('parseThemeOptions', () => {
  it('전체 옵션(value="")을 제외한 테마만 파싱한다', () => {
    const opts = parseThemeOptions(FIXTURE_HTML);
    expect(opts).toHaveLength(3);
    expect(opts[0]).toEqual({ id: 23, name: '잔향' });
  });

  it('HTML 엔티티가 디코드된다', () => {
    const opts = parseThemeOptions(FIXTURE_HTML);
    const manwol = opts.find((o) => o.id === 2);
    expect(manwol?.name).toBe('만월 <<꿈을 훔치는 요괴>>');
  });
});

// ── 2. parseThemes ──

describe('parseThemes', () => {
  const themes = parseThemes(FIXTURE_HTML, 2);

  it('res-item 섹션 수만큼 파싱한다', () => {
    expect(themes).toHaveLength(2);
  });

  it('이름으로 <select> 옵션 id를 매칭한다', () => {
    const janghyang = themes.find((t) => t.name === '잔향');
    expect(janghyang?.id).toBe(23);
    expect(janghyang?.branch).toBe(2);
  });

  it('인원(2-4)/시간(60분)/난이도(3.5)/장르를 추출한다', () => {
    const janghyang = themes.find((t) => t.name === '잔향')!;
    expect(janghyang.minPlayers).toBe(2);
    expect(janghyang.maxPlayers).toBe(4);
    expect(janghyang.duration).toBe(60);
    expect(janghyang.difficulty).toBe(3.5);
    expect(janghyang.genre).toBe('드라마 / 서스펜스');
  });

  it('이미지 URL을 추출한다', () => {
    const janghyang = themes.find((t) => t.name === '잔향')!;
    expect(janghyang.imageUrl).toContain('/storage/theme/');
  });

  it('인원 구분자가 물결(~)이어도 min/max를 올바로 파싱한다', () => {
    // 대구점 등 다수 테마가 "2~6" 형식을 사용 (하이픈 아님)
    const mystery = themes.find((t) => t.name === '미스터리')!;
    expect(mystery.minPlayers).toBe(2);
    expect(mystery.maxPlayers).toBe(6);
  });
});

// ── 3. parseSlots ──

describe('parseSlots', () => {
  const slots = parseSlots(FIXTURE_HTML);

  it('첫 번째 테마의 모든 시간 슬롯을 렌더 순서대로 파싱한다', () => {
    expect(slots.map((s) => s.time)).toEqual(['10:15', '11:40', '23:05']);
  });

  it('.eveReservationButton 유무로 예약가능 여부를 판별한다', () => {
    expect(slots[0].available).toBe(true); // 10:15 예약가능
    expect(slots[1].available).toBe(false); // 11:40 예약불가
    expect(slots[2].available).toBe(true); // 23:05 예약가능
  });
});

// ── 4. toTheme ──

describe('toTheme', () => {
  const raw = {
    id: 23,
    branch: 2,
    name: '잔향',
    imageUrl: 'https://example.com/x.png',
    genre: '드라마',
    minPlayers: 2,
    maxPlayers: 4,
    duration: 60,
    difficulty: 3.5,
  };

  it('id가 jigubyeol:{branch}:{theme} 형식이다', () => {
    expect(toTheme(raw).id).toBe('jigubyeol:2:23');
  });

  it('providerId가 jigubyeol이다', () => {
    expect(toTheme(raw).providerId).toBe('jigubyeol');
  });

  it('branch 코드가 지점명으로 변환된다', () => {
    expect(toTheme(raw).branchName).toBe('홍대어드벤처점');
    expect(toTheme({ ...raw, branch: 1 }).branchName).toBe('대구점');
    expect(toTheme({ ...raw, branch: 4 }).branchName).toBe('홍대라스트시티점');
  });
});

// ── 5. toTimeSlot ──

describe('toTimeSlot', () => {
  it('datetime이 ISO 8601 형식이다', () => {
    expect(
      toTimeSlot('jigubyeol:2:23', '2026-07-09', { time: '10:15', available: true })
        .datetime,
    ).toBe('2026-07-09T10:15:00');
  });

  it('한 자리 시가 0-padding된다', () => {
    expect(
      toTimeSlot('jigubyeol:2:23', '2026-07-09', { time: '9:05', available: true })
        .datetime,
    ).toBe('2026-07-09T09:05:00');
  });

  it('available boolean이 그대로 전달된다', () => {
    expect(
      toTimeSlot('t', '2026-07-09', { time: '10:15', available: false }).available,
    ).toBe(false);
  });
});

// ── 6. provider meta / 인터페이스 ──

describe('jigubyeol provider', () => {
  const provider = createJigubyeolProvider();

  it('meta 정보가 올바르다', () => {
    expect(provider.meta.id).toBe('jigubyeol');
    expect(provider.meta.name).toBe('지구별방탈출');
    expect(provider.meta.requiredFields).toEqual(['name', 'phone']);
  });

  it('ProviderAdapter 인터페이스를 만족한다', () => {
    expect(typeof provider.fetchThemes).toBe('function');
    expect(typeof provider.fetchTimeSlots).toBe('function');
    expect(typeof provider.execute).toBe('function');
  });
});

// ── 7. 실데이터 검증 (라이브 사이트) ──

const TARGET_DATE = '2026-07-09';

describe('jigubyeol 실데이터 검증', () => {
  let html: string;

  beforeAll(async () => {
    // 홍대어드벤처점(2), 잔향(23) 단일 테마 페이지
    html = await fetchReservationHtml(2, TARGET_DATE, 23);
  }, 15_000);

  it('지점 코드 3개가 정의되어 있다', () => {
    expect(Object.keys(BRANCHES)).toEqual(['1', '2', '4']);
  });

  it('테마 필터 페이지에서 res-item 섹션이 파싱된다', () => {
    const themes = parseThemes(html, 2);
    expect(themes.length).toBeGreaterThan(0);
    const janghyang = themes.find((t) => t.id === 23);
    expect(janghyang?.name).toBeTruthy();
    console.log(`\n=== 잔향 테마 파싱 결과 ===`);
    console.log(JSON.stringify(janghyang, null, 2));
  });

  it('시간 슬롯이 파싱되고 형태가 올바르다', () => {
    const slots = parseSlots(html);
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      expect(s.time).toMatch(/^\d{2}:\d{2}$/);
      expect(typeof s.available).toBe('boolean');
    }
    const available = slots.filter((s) => s.available);
    console.log(`\n=== 잔향 ${TARGET_DATE} 슬롯 현황 ===`);
    for (const s of slots) {
      console.log(`  ${s.time} → ${s.available ? '★ 예약가능' : '예약불가'}`);
    }
    console.log(`빈자리: ${available.length}개 / 총 ${slots.length}개`);
  });
});
