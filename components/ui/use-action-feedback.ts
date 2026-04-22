'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useActionFeedback(durationMs = 1200) {
  const [didSucceed, setDidSucceed] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const flashSuccess = useCallback(() => {
    setDidSucceed(true)
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = window.setTimeout(() => {
      setDidSucceed(false)
      timeoutRef.current = null
    }, durationMs)
  }, [durationMs])

  useEffect(
    () => () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current)
      }
    },
    [],
  )

  return { didSucceed, flashSuccess }
}
