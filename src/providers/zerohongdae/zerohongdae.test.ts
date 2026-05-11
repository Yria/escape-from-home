import { describe, it, expect, beforeAll } from 'vitest';
import {
  fetchSession,
  fetchThemesByDate,
  type ZerohongdaeRawTime,
  type ZerohongdaeThemeResponse,
} from './api';
import { STORE_ID } from './index';

const TARGET_DATE = '2026-04-16';

describe('zerohongdae 실데이터 검증', () => {
  let session: Awaited<ReturnType<typeof fetchSession>>;
  let response: ZerohongdaeThemeResponse;

  // 세션 + 데이터 1회만 fetch
  beforeAll(async () => {
    session = await fetchSession(STORE_ID);
    response = await fetchThemesByDate(STORE_ID, TARGET_DATE, session);
  }, 15_000);

  // ── 1. 세션 확보 ──

  it('CSRF 토큰이 비어있지 않다', () => {
    expect(session.csrfToken).toBeTruthy();
    expect(session.csrfToken.length).toBeGreaterThan(10);
  });

  it('쿠키가 비어있지 않다', () => {
    expect(session.cookies).toBeTruthy();
  });

  // ── 2. 응답 구조 ──

  it('data 배열에 테마가 1개 이상 있다', () => {
    expect(response.data.length).toBeGreaterThan(0);
  });

  it('times 객체에 키가 1개 이상 있다', () => {
    expect(Object.keys(response.times).length).toBeGreaterThan(0);
  });

  it('모든 테마에 대해 times 키가 존재한다', () => {
    for (const theme of response.data) {
      const pk = String(theme.PK);
      expect(response.times).toHaveProperty(pk);
    }
  });

  // ── 3. 테마 데이터 형태 ──

  it('각 테마에 PK, title, thumb 필드가 있다', () => {
    for (const theme of response.data) {
      expect(theme.PK).toBeTypeOf('number');
      expect(theme.title).toBeTypeOf('string');
      expect(theme.title.length).toBeGreaterThan(0);
      expect(theme.thumb).toBeTypeOf('string');
    }
  });

  // ── 4. 시간 슬롯 데이터 형태 ──

  it('각 시간 슬롯에 time, reservation, timeKO 필드가 있다', () => {
    for (const [, slots] of Object.entries(response.times)) {
      for (const slot of slots) {
        expect(slot.time).toMatch(/^\d{2}:\d{2}:\d{2}$/); // "HH:MM:SS"
        expect(slot.reservation).toBeTypeOf('boolean');
        expect(slot.timeKO).toBeTypeOf('string');
      }
    }
  });

  // ── 5. 빈자리 탐지 (핵심) ──

  it(`${TARGET_DATE} 전체 슬롯 중 빈자리가 있는지 확인 (raw dump)`, () => {
    const allSlots: { theme: string; time: string; timeKO: string; reservation: boolean }[] = [];

    for (const theme of response.data) {
      const pk = String(theme.PK);
      const slots = response.times[pk] ?? [];
      for (const slot of slots) {
        allSlots.push({
          theme: theme.title,
          time: slot.time,
          timeKO: slot.timeKO,
          reservation: slot.reservation,
        });
      }
    }

    const available = allSlots.filter((s) => !s.reservation);
    const booked = allSlots.filter((s) => s.reservation);

    console.log(`\n=== ${TARGET_DATE} 전체 슬롯 현황 ===`);
    console.log(`총 슬롯: ${allSlots.length}개`);
    console.log(`예약됨: ${booked.length}개`);
    console.log(`빈자리: ${available.length}개`);

    if (available.length > 0) {
      console.log('\n--- 빈자리 목록 ---');
      for (const s of available) {
        console.log(`  ${s.theme} | ${s.timeKO} (${s.time}) | reservation=${s.reservation}`);
      }
    }

    if (available.length === 0) {
      console.log('\n--- 만석: 모든 슬롯 상세 ---');
      for (const s of allSlots) {
        console.log(`  ${s.theme} | ${s.timeKO} (${s.time}) | reservation=${s.reservation}`);
      }
    }

    // 실패해도 전체 데이터를 볼 수 있도록 마지막에 assert
    expect(allSlots.length).toBeGreaterThan(0);
  });

  // ── 6. ALIVE 테마 특정 확인 ──

  it('ALIVE 테마가 목록에 존재한다', () => {
    const alive = response.data.find((t) =>
      t.title.toUpperCase().includes('ALIVE'),
    );
    expect(alive).toBeDefined();
  });

  it(`ALIVE 테마의 ${TARGET_DATE} 시간 슬롯을 출력한다`, () => {
    const alive = response.data.find((t) =>
      t.title.toUpperCase().includes('ALIVE'),
    );
    if (!alive) return;

    const pk = String(alive.PK);
    const slots: ZerohongdaeRawTime[] = response.times[pk] ?? [];

    console.log(`\n=== ALIVE (PK=${pk}) ${TARGET_DATE} 슬롯 ===`);
    for (const s of slots) {
      const status = s.reservation ? '예약됨' : '★ 빈자리';
      console.log(`  ${s.timeKO} (${s.time}) → ${status}`);
    }

    const available = slots.filter((s) => !s.reservation);
    console.log(`빈자리: ${available.length}개 / 총 ${slots.length}개`);

    // reservation 필드 값의 실제 타입 확인
    if (slots.length > 0) {
      console.log(`\n--- reservation 필드 raw 값 확인 ---`);
      for (const s of slots.slice(0, 3)) {
        console.log(`  time=${s.time}, reservation=${JSON.stringify(s.reservation)} (type: ${typeof s.reservation})`);
      }
    }
  });

  // ── 7. reservation 필드 타입 검증 ──

  it('reservation 필드가 정확히 boolean인지 확인 (truthy/falsy 아닌 진짜 boolean)', () => {
    const issues: string[] = [];

    for (const theme of response.data) {
      const pk = String(theme.PK);
      const slots = response.times[pk] ?? [];
      for (const slot of slots) {
        if (typeof slot.reservation !== 'boolean') {
          issues.push(
            `${theme.title} ${slot.time}: reservation=${JSON.stringify(slot.reservation)} (type: ${typeof slot.reservation})`,
          );
        }
      }
    }

    if (issues.length > 0) {
      console.log('\n!!! reservation 필드가 boolean이 아닌 슬롯 발견:');
      issues.forEach((i) => console.log(`  ${i}`));
    }

    // 이 테스트가 실패하면 reservation 필드 파싱 로직에 문제가 있는 것
    expect(issues).toHaveLength(0);
  });

  // ── 8. 시간 범위 필터링 검증 ──

  it('11:00~12:00 범위 필터가 정상 동작한다', () => {
    const startTime = '11:00';
    const endTime = '12:00';

    const inRange: { theme: string; time: string; reservation: boolean }[] = [];

    for (const theme of response.data) {
      const pk = String(theme.PK);
      const slots = response.times[pk] ?? [];
      for (const slot of slots) {
        const t = slot.time.slice(0, 5);
        if (t >= startTime && t <= endTime) {
          inRange.push({
            theme: theme.title,
            time: slot.time,
            reservation: slot.reservation,
          });
        }
      }
    }

    console.log(`\n=== ${startTime}~${endTime} 범위 슬롯 ===`);
    for (const s of inRange) {
      const status = s.reservation ? '예약됨' : '★ 빈자리';
      console.log(`  ${s.theme} | ${s.time} → ${status}`);
    }

    // 해당 시간대에 슬롯이 존재하는지
    expect(inRange.length).toBeGreaterThan(0);
  });
});
