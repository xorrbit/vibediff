import { useEffect, useRef, useState } from 'react'
import { Session } from '@shared/types'
import { subscribePtyData } from '../lib/eventDispatchers'

const OUTPUT_IDLE_THRESHOLD_MS = 2000
const FOREGROUND_POLL_INTERVAL_MS = 3000

function setsAreEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false
  for (const value of left) {
    if (!right.has(value)) return false
  }
  return true
}

export function useInputWaiting(
  sessions: Session[],
  activeSessionId: string | null
): Set<string> {
  const [waitingIds, setWaitingIds] = useState<Set<string>>(new Set())
  const lastOutputTime = useRef<Map<string, number>>(new Map())
  const sessionIdsKey = sessions.map((session) => session.id).join('\0')

  useEffect(() => {
    const now = Date.now()
    const sessionIds = sessionIdsKey ? sessionIdsKey.split('\0') : []
    const activeIds = new Set(sessionIds)

    for (const sessionId of sessionIds) {
      if (!lastOutputTime.current.has(sessionId)) {
        lastOutputTime.current.set(sessionId, now)
      }
    }

    for (const sessionId of Array.from(lastOutputTime.current.keys())) {
      if (!activeIds.has(sessionId)) {
        lastOutputTime.current.delete(sessionId)
      }
    }

    setWaitingIds((previous) => {
      const filtered = new Set<string>()
      for (const sessionId of previous) {
        if (activeIds.has(sessionId)) {
          filtered.add(sessionId)
        }
      }
      return setsAreEqual(previous, filtered) ? previous : filtered
    })
  }, [sessionIdsKey])

  useEffect(() => {
    const sessionIds = sessionIdsKey ? sessionIdsKey.split('\0') : []
    const unsubscribers = sessionIds.map((sessionId) =>
      subscribePtyData(sessionId, () => {
        lastOutputTime.current.set(sessionId, Date.now())
      })
    )

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe()
      }
    }
  }, [sessionIdsKey])

  useEffect(() => {
    let cancelled = false
    let pollInFlight = false

    const pollWaitingSessions = async () => {
      if (pollInFlight) return
      pollInFlight = true

      try {
        const sessionIds = sessionIdsKey ? sessionIdsKey.split('\0') : []
        const backgroundSessionIds = sessionIds.filter((sessionId) => sessionId !== activeSessionId)
        if (backgroundSessionIds.length === 0) {
          setWaitingIds((previous) => (previous.size === 0 ? previous : new Set()))
          return
        }

        const now = Date.now()
        const foregroundProcesses = await Promise.all(
          backgroundSessionIds.map(async (sessionId) => {
            try {
              const processName = await window.electronAPI.pty.getForegroundProcess(sessionId)
              return { sessionId, processName }
            } catch {
              return { sessionId, processName: null as string | null }
            }
          })
        )

        if (cancelled) return

        const nextWaitingIds = new Set<string>()
        for (const { sessionId, processName } of foregroundProcesses) {
          const isAiForeground = processName === 'claude' || processName === 'codex'
          if (!isAiForeground) continue

          const lastOutput = lastOutputTime.current.get(sessionId) ?? now
          if (now - lastOutput >= OUTPUT_IDLE_THRESHOLD_MS) {
            nextWaitingIds.add(sessionId)
          }
        }

        setWaitingIds((previous) => (
          setsAreEqual(previous, nextWaitingIds) ? previous : nextWaitingIds
        ))
      } finally {
        pollInFlight = false
      }
    }

    void pollWaitingSessions()
    const intervalId = window.setInterval(() => {
      void pollWaitingSessions()
    }, FOREGROUND_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [activeSessionId, sessionIdsKey])

  useEffect(() => {
    if (!activeSessionId) return
    setWaitingIds((previous) => {
      if (!previous.has(activeSessionId)) return previous
      const next = new Set(previous)
      next.delete(activeSessionId)
      return next
    })
  }, [activeSessionId])

  return waitingIds
}
