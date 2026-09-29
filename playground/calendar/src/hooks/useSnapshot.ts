import { useCallback, useEffect, useState } from 'react'
import type { ScheduleSnapshot } from '@escape-from-home/somoim'
import { SnapshotError, errorMessage } from '../lib/snapshotError'

type State =
  | { phase: 'loading'; snapshot: null; error: null }
  | { phase: 'ready'; snapshot: ScheduleSnapshot; error: null }
  | { phase: 'error'; snapshot: ScheduleSnapshot | null; error: string }

const DATA_URL = `${import.meta.env.BASE_URL}data/events.json`

/** 서버가 요청마다 게시판을 새로 수집하므로 브라우저 캐시도 쓰지 않는다 */
async function fetchSnapshot(signal?: AbortSignal): Promise<ScheduleSnapshot> {
  const res = await fetch(DATA_URL, { signal, cache: 'no-store' })
  if (!res.ok) throw new SnapshotError(`일정 데이터를 받지 못했습니다 (HTTP ${res.status}).`)
  let data: ScheduleSnapshot
  try {
    data = (await res.json()) as ScheduleSnapshot
  } catch {
    throw new SnapshotError('일정 데이터 형식이 올바르지 않습니다.')
  }
  if (!Array.isArray(data?.events)) throw new SnapshotError('일정 데이터 형식이 올바르지 않습니다.')
  return data
}

export function useSnapshot() {
  const [state, setState] = useState<State>({ phase: 'loading', snapshot: null, error: null })
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const ac = new AbortController()
    fetchSnapshot(ac.signal)
      .then((snapshot) => setState({ phase: 'ready', snapshot, error: null }))
      .catch((err: unknown) => {
        if (ac.signal.aborted) return
        setState({ phase: 'error', snapshot: null, error: errorMessage(err) })
      })
    return () => ac.abort()
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const snapshot = await fetchSnapshot()
      setState({ phase: 'ready', snapshot, error: null })
    } catch (err) {
      setState((prev) => ({ phase: 'error', snapshot: prev.snapshot, error: errorMessage(err) }))
    } finally {
      setRefreshing(false)
    }
  }, [])

  return { ...state, refreshing, refresh }
}
