import { useEffect, useState } from 'react'

/** Returns `value` once it has stopped changing for `delay` ms (slider drags fire many updates). */
export function useDebouncedValue<T>(value: T, delay = 150): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(id)
  }, [value, delay])
  return debounced
}
