import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildSnapshot } from './snapshot.ts'
import type { ScheduleSnapshot } from './types.ts'

export type WriteSnapshotOptions = NonNullable<Parameters<typeof buildSnapshot>[0]>

/** 스냅샷을 수집해 JSON 파일로 저장한다 (디렉터리 자동 생성) */
export async function writeSnapshot(filePath: string, opts?: WriteSnapshotOptions): Promise<ScheduleSnapshot> {
  const snapshot = await buildSnapshot(opts)
  await mkdir(path.dirname(path.resolve(filePath)), { recursive: true })
  await writeFile(filePath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8')
  return snapshot
}
