import { describe, it, expect, beforeAll } from 'vitest';
import { fetchAllThemes, fetchTimeSlotsByTheme } from './api';
import { toTheme, toTimeSlot } from './mapper';

const TARGET_DATE = '2026-04-12';

// ── 1. fetchAllThemes (works.php 파싱) ──

describe('keyescape 실데이터 검증', () => {
  describe('fetchAllThemes', () => {
    let themes: Awaited<ReturnType<typeof fetchAllThemes>>;

    beforeAll(async () => {
      themes = await fetchAllThemes();
    }, 15_000);

    it('테마가 1개 이상 있다', () => {
      expect(themes.length).toBeGreaterThan(0);
    });

    it('각 테마에 필수 필드가 존재한다', () => {
      for (const t of themes) {
        expect(t.name).toBeTypeOf('string');
        expect(t.name.length).toBeGreaterThan(0);
        expect(t.infoNum).toBeTypeOf('number');
        expect(t.zizumNum).toBeTypeOf('number');
        expect(t.themeNum).toBeTypeOf('number');
        expect(t.imageUrl).toBeTypeOf('string');
        expect(t.branchName).toBeTypeOf('string');
      }
    });

    it('이미지 URL이 CloudFront CDN을 가리킨다', () => {
      for (const t of themes) {
        expect(t.imageUrl).toContain('cloudfront.net');
      }
    });

    it('여러 지점의 테마가 포함되어 있다', () => {
      const branches = new Set(themes.map((t) => t.branchName));
      expect(branches.size).toBeGreaterThan(3);
      console.log(`\n=== ${themes.length}개 테마, ${branches.size}개 지점 ===`);
      for (const b of branches) {
        const count = themes.filter((t) => t.branchName === b).length;
        console.log(`  ${b}: ${count}개`);
      }
    });
  });

  // ── 2. fetchTimeSlotsByTheme ──

  describe('fetchTimeSlotsByTheme', () => {
    let response: Awaited<ReturnType<typeof fetchTimeSlotsByTheme>>;

    beforeAll(async () => {
      response = await fetchTimeSlotsByTheme(TARGET_DATE, 3, 7);
    }, 15_000);

    it('status가 true이다', () => {
      expect(response.status).toBe(true);
    });

    it('data 배열에 시간 슬롯이 있다', () => {
      expect(response.data).toBeInstanceOf(Array);
    });

    it('각 슬롯에 hh, mm, enable 필드가 존재한다', () => {
      for (const slot of response.data) {
        expect(slot.hh).toBeTypeOf('string');
        expect(slot.mm).toBeTypeOf('string');
        expect(['Y', 'N']).toContain(slot.enable);
      }
    });

    it('시간 슬롯 현황을 출력한다', () => {
      console.log(`\n=== 강남점 테마 7 / ${TARGET_DATE} 시간 슬롯 ===`);
      for (const slot of response.data) {
        const status = slot.enable === 'Y' ? '예약가능' : '마감';
        console.log(`  ${slot.hh}:${slot.mm} → ${status}`);
      }
      const available = response.data.filter((s) => s.enable === 'Y');
      console.log(`빈자리: ${available.length}개 / 총 ${response.data.length}개`);
    });
  });
});

// ── 3. toTheme 변환 테스트 ──

describe('toTheme', () => {
  const raw = {
    infoNum: 100,
    zizumNum: 3,
    themeNum: 7,
    name: '테스트 테마',
    imageUrl: 'https://example.com/test.png',
    branchName: '강남점',
  };

  it('id가 keyescape:{zizum}:{theme}:{info} 형식이다', () => {
    expect(toTheme(raw).id).toBe('keyescape:3:7:100');
  });

  it('providerId가 keyescape이다', () => {
    expect(toTheme(raw).providerId).toBe('keyescape');
  });

  it('branchName과 imageUrl이 전달된다', () => {
    const theme = toTheme(raw);
    expect(theme.branchName).toBe('강남점');
    expect(theme.imageUrl).toBe('https://example.com/test.png');
  });
});

// ── 4. toTimeSlot 변환 테스트 ──

describe('toTimeSlot', () => {
  const makeSlot = (hh: string, mm: string, enable: 'Y' | 'N') => ({
    num: 1, gubun: '', theme_num: 7, hh, mm, enable,
    sale_ck: '', sale_price: 0, sale_txt: '',
  });

  it('datetime이 ISO 형식이다', () => {
    expect(toTimeSlot('keyescape:3:7:100', '2026-04-12', makeSlot('14', '30', 'Y')).datetime)
      .toBe('2026-04-12T14:30:00');
  });

  it('한 자리 시/분이 0-padding된다', () => {
    expect(toTimeSlot('keyescape:3:7:100', '2026-04-12', makeSlot('9', '5', 'Y')).datetime)
      .toBe('2026-04-12T09:05:00');
  });

  it('enable Y/N → available boolean', () => {
    expect(toTimeSlot('t', '2026-04-12', makeSlot('14', '00', 'Y')).available).toBe(true);
    expect(toTimeSlot('t', '2026-04-12', makeSlot('14', '00', 'N')).available).toBe(false);
  });
});
