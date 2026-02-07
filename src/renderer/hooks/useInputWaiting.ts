import { useEffect, useMemo, useRef, useState } from 'react'
import { Session } from '@shared/types'
import { subscribePtyData } from '../lib/eventDispatchers'

const PROMPT_IDLE_THRESHOLD_MS = 700
const FALLBACK_IDLE_THRESHOLD_MS = 8000
const PROMPT_HINT_MAX_AGE_MS = 20000
const FOREGROUND_POLL_INTERVAL_MS = 1500
const WAITING_CLEAR_CONFIRMATION_POLLS = 2
const RECENT_OUTPUT_MAX_CHARS = 4000
const RECENT_OUTPUT_MAX_LINES = 8
const PROMPT_SCORE_THRESHOLD = 3

interface ScoredSignal {
  weight: number
  matches: (text: string) => boolean
}

function normalizeForPhraseMatching(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function matchesAnyPhrase(text: string, phrases: string[]): boolean {
  for (const phrase of phrases) {
    if (text.includes(phrase)) return true
  }
  return false
}

const INPUT_PROMPT_SIGNALS: ScoredSignal[] = [
  {
    weight: 4,
    matches: (text) => matchesAnyPhrase(normalizeForPhraseMatching(text), [
      'waiting for input',
      'waiting for your input',
      'waiting for response',
      'waiting for your response',
      'waiting for reply',
      'waiting for your reply',
      'awaiting input',
      'awaiting your input',
      'awaiting response',
      'awaiting your response',
      'awaiting reply',
      'awaiting your reply',
    ]),
  },
  {
    weight: 4,
    matches: (text) => matchesAnyPhrase(normalizeForPhraseMatching(text), [
      'needs input',
      'needs your input',
      'needs response',
      'needs your response',
      'needs confirmation',
      'needs your confirmation',
      'require input',
      'require your input',
      'requires input',
      'requires your input',
      'required input',
      'required your input',
      'require response',
      'requires response',
      'required response',
      'require confirmation',
      'requires confirmation',
      'required confirmation',
    ]),
  },
  {
    weight: 4,
    matches: (text) => /\bidle\s+prompt\b/i.test(text),
  },
  {
    weight: 3,
    matches: (text) => /\b(?:press|hit|type|enter|provide)\b.{0,40}\b(?:input|response|reply|continue|confirm|send|submit)\b/i.test(text),
  },
  {
    weight: 3,
    matches: (text) => /\bwhat\s+would\s+you\s+like\s+to\s+do\??\b/i.test(text),
  },
  {
    weight: 3,
    matches: (text) => matchesAnyPhrase(normalizeForPhraseMatching(text), [
      'choose option',
      'choose an option',
      'select option',
      'select an option',
    ]),
  },
  {
    weight: 2,
    matches: (text) => /\b(?:yes\/no|y\/n|y\/n\/q)\b/i.test(text),
  },
  {
    weight: 2,
    matches: (text) => /\bcontinue\?\s*$/im.test(text),
  },
  {
    weight: 2,
    matches: (text) => /\b(?:confirm|proceed)\?\s*$/im.test(text),
  },
]

const NON_PROMPT_SIGNALS: ScoredSignal[] = [
  {
    weight: 2,
    matches: (text) => /\b(?:thinking|analyz(?:ing|e)|working|searching|processing|generating|loading|running|executing|planning|applying|compiling)\b/i.test(text),
  },
  {
    weight: 2,
    matches: (text) => /\bplease\s+wait\b/i.test(text),
  },
  {
    weight: 1,
    matches: (text) => /\b\d{1,3}%\b/.test(text),
  },
]

// Strip ANSI control sequences to make text matching robust across colorized output.
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex -- terminal control sequences intentionally use control chars
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
}

function hasVisibleText(text: string): boolean {
  return text.trim().length > 0
}

function normalizeOutputForMatching(data: string): string {
  return stripAnsi(data).replace(/\r/g, '\n')
}

function getLineTail(text: string): string {
  const lines = text.split('\n')
  return lines.slice(-RECENT_OUTPUT_MAX_LINES).join('\n')
}

function appendRecentOutputTail(previousTail: string, nextChunk: string): string {
  const combined = `${previousTail}${nextChunk}`.slice(-RECENT_OUTPUT_MAX_CHARS)
  return getLineTail(combined)
}

function scorePromptLikelihood(recentTail: string): number {
  let score = 0

  for (const { matches, weight } of INPUT_PROMPT_SIGNALS) {
    if (matches(recentTail)) {
      score += weight
    }
  }

  for (const { matches, weight } of NON_PROMPT_SIGNALS) {
    if (matches(recentTail)) {
      score -= weight
    }
  }

  const lastLine = recentTail.trim().split('\n').at(-1) ?? ''
  if (lastLine.endsWith('?')) {
    score += 1
  }

  return score
}

function hasInputPromptHint(recentTail: string): boolean {
  return scorePromptLikelihood(recentTail) >= PROMPT_SCORE_THRESHOLD
}

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
  const lastPromptHintTime = useRef<Map<string, number>>(new Map())
  const recentOutputTail = useRef<Map<string, string>>(new Map())
  const waitingClearStreak = useRef<Map<string, number>>(new Map())
  const waitingIdsRef = useRef<Set<string>>(new Set())
  const activeSessionIdRef = useRef<string | null>(activeSessionId)
  const sessionIdsKey = sessions.map((session) => session.id).join('\0')
  const sessionIds = useMemo(
    () => (sessionIdsKey ? sessionIdsKey.split('\0') : []),
    [sessionIdsKey]
  )

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId
  }, [activeSessionId])

  useEffect(() => {
    waitingIdsRef.current = waitingIds
  }, [waitingIds])

  useEffect(() => {
    const now = Date.now()
    const activeIds = new Set(sessionIds)

    for (const sessionId of sessionIds) {
      if (!lastOutputTime.current.has(sessionId)) {
        lastOutputTime.current.set(sessionId, now)
      }
    }

    for (const sessionId of Array.from(lastOutputTime.current.keys())) {
      if (!activeIds.has(sessionId)) {
        lastOutputTime.current.delete(sessionId)
        lastPromptHintTime.current.delete(sessionId)
        recentOutputTail.current.delete(sessionId)
        waitingClearStreak.current.delete(sessionId)
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
  }, [sessionIds])

  useEffect(() => {
    const unsubscribers = sessionIds.map((sessionId) =>
      subscribePtyData(sessionId, (data) => {
        const now = Date.now()
        lastOutputTime.current.set(sessionId, now)

        if (sessionId === activeSessionIdRef.current) {
          // Active tab isn't eligible for waiting highlight; skip heavier prompt parsing work.
          lastPromptHintTime.current.delete(sessionId)
          return
        }

        const normalizedData = normalizeOutputForMatching(data)
        const previousTail = recentOutputTail.current.get(sessionId) ?? ''
        const nextTail = appendRecentOutputTail(previousTail, normalizedData)
        recentOutputTail.current.set(sessionId, nextTail)

        if (hasInputPromptHint(nextTail)) {
          lastPromptHintTime.current.set(sessionId, now)
          return
        }

        if (hasVisibleText(normalizedData)) {
          // Any non-prompt output means the previous prompt hint is stale.
          lastPromptHintTime.current.delete(sessionId)
        }
      })
    )

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe()
      }
    }
  }, [sessionIds])

  useEffect(() => {
    let cancelled = false
    let pollInFlight = false

    const pollWaitingSessions = async () => {
      if (pollInFlight) return
      pollInFlight = true

      try {
        const backgroundSessionIds = sessionIds.filter((sessionId) => sessionId !== activeSessionId)
        if (backgroundSessionIds.length === 0) {
          setWaitingIds((previous) => (previous.size === 0 ? previous : new Set()))
          return
        }

        const now = Date.now()
        const previousWaitingIds = waitingIdsRef.current
        const candidateSessionIds: string[] = []
        for (const sessionId of backgroundSessionIds) {
          if (previousWaitingIds.has(sessionId)) {
            candidateSessionIds.push(sessionId)
            continue
          }

          const lastOutput = lastOutputTime.current.get(sessionId) ?? now
          const lastPromptHint = lastPromptHintTime.current.get(sessionId)
          const hasFreshPromptHint = (
            typeof lastPromptHint === 'number' &&
            now - lastPromptHint <= PROMPT_HINT_MAX_AGE_MS
          )
          const idleThreshold = hasFreshPromptHint
            ? PROMPT_IDLE_THRESHOLD_MS
            : FALLBACK_IDLE_THRESHOLD_MS

          if (now - lastOutput >= idleThreshold) {
            candidateSessionIds.push(sessionId)
          }
        }

        if (candidateSessionIds.length === 0) {
          if (previousWaitingIds.size === 0) {
            return
          }

          setWaitingIds((previous) => {
            if (previous.size === 0) return previous
            const stabilized = new Set<string>()
            for (const sessionId of previous) {
              const clearStreak = (waitingClearStreak.current.get(sessionId) ?? 0) + 1
              if (clearStreak >= WAITING_CLEAR_CONFIRMATION_POLLS) {
                waitingClearStreak.current.delete(sessionId)
                continue
              }
              waitingClearStreak.current.set(sessionId, clearStreak)
              stabilized.add(sessionId)
            }
            return setsAreEqual(previous, stabilized) ? previous : stabilized
          })
          return
        }

        const foregroundProcesses = await Promise.all(
          candidateSessionIds.map(async (sessionId) => {
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
          if (!isAiForeground) {
            lastPromptHintTime.current.delete(sessionId)
            continue
          }

          const lastOutput = lastOutputTime.current.get(sessionId) ?? now
          const lastPromptHint = lastPromptHintTime.current.get(sessionId)
          const hasFreshPromptHint = (
            typeof lastPromptHint === 'number' &&
            now - lastPromptHint <= PROMPT_HINT_MAX_AGE_MS
          )
          const idleThreshold = hasFreshPromptHint
            ? PROMPT_IDLE_THRESHOLD_MS
            : FALLBACK_IDLE_THRESHOLD_MS

          if (now - lastOutput >= idleThreshold) {
            nextWaitingIds.add(sessionId)
          }
        }

        setWaitingIds((previous) => {
          const sessionUniverse = new Set<string>([
            ...Array.from(previous),
            ...Array.from(nextWaitingIds),
          ])
          const stabilized = new Set<string>()

          for (const sessionId of sessionUniverse) {
            if (nextWaitingIds.has(sessionId)) {
              waitingClearStreak.current.delete(sessionId)
              stabilized.add(sessionId)
              continue
            }

            if (!previous.has(sessionId)) {
              waitingClearStreak.current.delete(sessionId)
              continue
            }

            const clearStreak = (waitingClearStreak.current.get(sessionId) ?? 0) + 1
            if (clearStreak >= WAITING_CLEAR_CONFIRMATION_POLLS) {
              waitingClearStreak.current.delete(sessionId)
              continue
            }

            waitingClearStreak.current.set(sessionId, clearStreak)
            stabilized.add(sessionId)
          }

          return setsAreEqual(previous, stabilized) ? previous : stabilized
        })
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
  }, [activeSessionId, sessionIds])

  useEffect(() => {
    if (!activeSessionId) return
    setWaitingIds((previous) => {
      if (!previous.has(activeSessionId)) return previous
      const next = new Set(previous)
      next.delete(activeSessionId)
      waitingClearStreak.current.delete(activeSessionId)
      return next
    })
  }, [activeSessionId])

  return waitingIds
}
