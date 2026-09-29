import { describe, expect, it } from 'vitest'
import { seededRandom, shortTitle } from './event'

describe('shortTitle', () => {
  it('앞의 날짜와 요일을 뗀다', () => {
    expect(shortTitle('9/20 강남 시계탑 도둑')).toBe('강남 시계탑 도둑')
    expect(shortTitle('10/3(토) 강남 벙')).toBe('강남 벙')
    expect(shortTitle('10월 17일 잠실')).toBe('잠실')
    expect(shortTitle('10.3 건대')).toBe('건대')
  })
  it('날짜가 앞에 없거나 날짜뿐이면 그대로', () => {
    expect(shortTitle('강남 9/20 벙')).toBe('강남 9/20 벙')
    expect(shortTitle('9/20')).toBe('9/20')
  })
})

describe('seededRandom', () => {
  it('같은 키는 같은 수열', () => {
    const a = seededRandom('2026-09-29')
    const b = seededRandom('2026-09-29')
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})
