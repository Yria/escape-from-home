/** 앱이 직접 만든(사용자에게 그대로 보여도 되는) 오류 */
export class SnapshotError extends Error {}

/** 브라우저가 던지는 영문 오류(TypeError: Failed to fetch 등)는 화면에 그대로 내보내지 않는다 */
export function errorMessage(err: unknown): string {
  if (err instanceof SnapshotError) return err.message
  if (err instanceof TypeError) return '네트워크 연결을 확인해 주세요.'
  return '일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
}
