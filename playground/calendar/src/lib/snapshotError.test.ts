import { describe, expect, it } from 'vitest'
import { SnapshotError, errorMessage } from './snapshotError'

describe('errorMessage', () => {
  it('앱이 만든 오류는 그대로', () => {
    expect(errorMessage(new SnapshotError('일정 데이터를 받지 못했습니다 (HTTP 502).'))).toBe('일정 데이터를 받지 못했습니다 (HTTP 502).')
  })
  it('브라우저 네트워크 오류(영문)는 한국어로 바꾼다', () => {
    expect(errorMessage(new TypeError('Failed to fetch'))).toBe('네트워크 연결을 확인해 주세요.')
    expect(errorMessage(new TypeError('NetworkError when attempting to fetch resource.'))).toBe('네트워크 연결을 확인해 주세요.')
  })
  it('그 밖의 오류도 원문을 보이지 않는다', () => {
    expect(errorMessage(new SyntaxError('Unexpected token < in JSON'))).toBe('일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    expect(errorMessage('x')).toBe('일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
  })
})
