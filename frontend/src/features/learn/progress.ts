import { useCallback, useState } from 'react'

const KEY = 'derivlab.learn.done'

function read(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

/** Which chapters this browser has marked as done (a convenience; nothing depends on it). */
export function useProgress() {
  const [done, setDone] = useState(read)
  const toggle = useCallback((id: string) => {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        window.localStorage.setItem(KEY, JSON.stringify([...next]))
      } catch {
        // Storage can be unavailable (private mode); progress then lasts for the session.
      }
      return next
    })
  }, [])
  return { done, toggle }
}
