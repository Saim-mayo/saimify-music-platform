import { useCallback, useState } from 'react'

const readValue = (key, initialValue) => {
  if (typeof window === 'undefined') return initialValue

  try {
    const stored = window.localStorage.getItem(key)
    return stored === null ? initialValue : JSON.parse(stored)
  } catch {
    return initialValue
  }
}

export default function useLocalStorageState(key, initialValue) {
  const [value, setValue] = useState(() => readValue(key, initialValue))

  const updateValue = useCallback((nextValue) => {
    setValue((currentValue) => {
      const resolvedValue = typeof nextValue === 'function' ? nextValue(currentValue) : nextValue
      try {
        window.localStorage.setItem(key, JSON.stringify(resolvedValue))
      } catch {
        // Storage can be unavailable in private browsing or restricted contexts.
      }
      return resolvedValue
    })
  }, [key])

  return [value, updateValue]
}
