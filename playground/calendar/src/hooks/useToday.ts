import { useEffect, useState } from 'react'
import { kstDateKey } from '../lib/calendar'

/** KST 오늘 날짜 키. 자정을 넘기면 갱신된다. */
export function useToday(): string {
  const [today, setToday] = useState(() => kstDateKey(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => setToday(kstDateKey(new Date())), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return today
}
