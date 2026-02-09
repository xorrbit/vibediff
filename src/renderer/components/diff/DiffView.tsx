import { memo, lazy, Suspense, useState, useEffect, useLayoutEffect, useRef } from 'react'
import { DiffContent } from '@shared/types'
import { textMateService } from '../../lib/textmate'

// Lazy load Monaco wrapper so editor/runtime code stays out of initial chunk
const MonacoDiffEditor = lazy(() =>
  import('./MonacoDiffEditor').then((mod) => ({ default: mod.MonacoDiffEditor }))
)

export type DiffViewMode = 'auto' | 'unified' | 'split'

interface DiffViewProps {
  filePath: string | null
  diffContent: DiffContent | null
  isLoading: boolean
  viewMode?: DiffViewMode
}

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  md: 'markdown',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  dockerfile: 'dockerfile',
}

// Get language from file extension
function getLanguage(filePath: string | null): string {
  if (!filePath) return 'plaintext'

  // Check TextMate grammars first
  const tmLanguage = textMateService.getLanguageForFile(filePath)
  if (tmLanguage) return tmLanguage

  // Fall back to hardcoded map
  const ext = filePath.split('.').pop()?.toLowerCase()
  return ext ? LANGUAGE_MAP[ext] || 'plaintext' : 'plaintext'
}

function LoadingFallback() {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-obsidian-accent/30 border-t-obsidian-accent rounded-full animate-spin" />
        <span className="text-sm text-obsidian-text-muted">Loading editor...</span>
      </div>
    </div>
  )
}

// Memoized editor options to prevent unnecessary Monaco updates
const BASE_EDITOR_OPTIONS = {
  readOnly: true,
  maxComputationTime: 1000,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 13,
  lineHeight: 20,
  fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', Consolas, monospace",
  fontLigatures: true,
  folding: true,
  lineNumbers: 'on' as const,
  renderLineHighlight: 'none' as const,
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
    useShadows: false,
  },
  padding: { top: 12, bottom: 12 },
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
}

// Pre-computed per-mode options (stable references for memoization)
const OPTIONS_AUTO = { ...BASE_EDITOR_OPTIONS, renderSideBySide: true, useInlineViewWhenSpaceIsLimited: false }
const OPTIONS_UNIFIED = { ...BASE_EDITOR_OPTIONS, renderSideBySide: false }
const OPTIONS_SPLIT = { ...BASE_EDITOR_OPTIONS, renderSideBySide: true, useInlineViewWhenSpaceIsLimited: false }

// Inner component that handles the actual Monaco rendering
const DiffEditorContent = memo(function DiffEditorContent({
  original,
  modified,
  language,
  viewMode = 'auto',
}: {
  original: string
  modified: string
  language: string
  viewMode?: DiffViewMode
}) {
  const options = viewMode === 'unified' ? OPTIONS_UNIFIED
    : viewMode === 'split' ? OPTIONS_SPLIT
    : OPTIONS_AUTO

  return (
    <MonacoDiffEditor
      original={original}
      modified={modified}
      language={language}
      options={options}
    />
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.original === nextProps.original &&
    prevProps.modified === nextProps.modified &&
    prevProps.language === nextProps.language &&
    prevProps.viewMode === nextProps.viewMode
  )
})

const POOL_CAP = 8
const LARGE_DIFF_CHAR_THRESHOLD = 200_000
const DIFF_POOL_DEFER_MS = 40
const DIFF_POOL_IDLE_TIMEOUT_MS = 250

interface PoolEntry {
  path: string
  content: DiffContent
  language: string
}

// Renders pooled editor instances. Memo'd on pool/viewMode only — NOT filePath.
// For cached file switches pool doesn't change, so React skips this entire
// subtree (no virtual DOM creation, no reconciliation, zero work).
const PoolRenderer = memo(function PoolRenderer({
  pool,
  viewMode,
}: {
  pool: PoolEntry[]
  viewMode: DiffViewMode
}) {
  return (
    <>
      {pool.map((entry) => (
        <div
          key={entry.path}
          data-file={entry.path}
          className="absolute inset-0"
          style={{ opacity: 0, pointerEvents: 'none' as const, zIndex: 0 }}
        >
          <Suspense fallback={<LoadingFallback />}>
            <DiffEditorContent
              original={entry.content.original}
              modified={entry.content.modified}
              language={entry.language}
              viewMode={viewMode}
            />
          </Suspense>
        </div>
      ))}
    </>
  )
})

export const DiffView = memo(function DiffView({ filePath, diffContent, isLoading, viewMode = 'auto' }: DiffViewProps) {
  const [pool, setPool] = useState<PoolEntry[]>([])
  const prevDiffRef = useRef<DiffContent | null>(null)
  const lruRef = useRef<string[]>([])
  const poolRef = useRef<HTMLDivElement>(null)

  // Upsert into pool when we have fresh content for a file.
  // Identity check: skip when diffContent is the same object reference as
  // last render — that means filePath changed but the hook hasn't produced
  // new content yet (stale from the previous file).
  useEffect(() => {
    if (!filePath || !diffContent) {
      prevDiffRef.current = diffContent
      return
    }
    if (diffContent === prevDiffRef.current) return
    prevDiffRef.current = diffContent
    let cancelled = false
    let deferTimer: ReturnType<typeof setTimeout> | null = null
    let idleId: number | null = null

    // Track access order for eviction (ref-only, no re-render)
    lruRef.current = [...lruRef.current.filter((p) => p !== filePath), filePath]

    const lang = getLanguage(filePath)
    const upsertPool = () => {
      if (cancelled) return
      setPool((prev) => {
        const existing = prev.find((e) => e.path === filePath)
        if (existing) {
          // Already pooled — only update state if content actually changed
          if (existing.content.original === diffContent.original &&
              existing.content.modified === diffContent.modified) {
            return prev // Same reference → no re-render
          }
          return prev.map((e) =>
            e.path === filePath ? { path: filePath, content: diffContent, language: lang } : e
          )
        }
        // New entry — evict LRU if at cap
        let next = [...prev]
        if (next.length >= POOL_CAP) {
          const poolPaths = new Set(next.map((e) => e.path))
          const toEvict = lruRef.current.find((p) => p !== filePath && poolPaths.has(p))
          next = toEvict ? next.filter((e) => e.path !== toEvict) : next.slice(1)
        }
        next.push({ path: filePath, content: diffContent, language: lang })
        return next
      })
    }

    const combinedSize = diffContent.original.length + diffContent.modified.length
    if (combinedSize >= LARGE_DIFF_CHAR_THRESHOLD) {
      deferTimer = setTimeout(() => {
        if (cancelled) return
        if (typeof window.requestIdleCallback === 'function') {
          idleId = window.requestIdleCallback(
            () => upsertPool(),
            { timeout: DIFF_POOL_IDLE_TIMEOUT_MS }
          )
          return
        }
        upsertPool()
      }, DIFF_POOL_DEFER_MS)
    } else {
      upsertPool()
    }

    return () => {
      cancelled = true
      if (deferTimer) clearTimeout(deferTimer)
      if (idleId !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
    }
  }, [filePath, diffContent])

  // Toggle active editor via direct DOM manipulation — bypasses React entirely.
  // useLayoutEffect runs synchronously before paint, so no flash.
  useLayoutEffect(() => {
    if (!poolRef.current) return
    for (const child of poolRef.current.children) {
      const el = child as HTMLElement
      const isActive = el.dataset.file === filePath
      el.style.opacity = isActive ? '1' : '0'
      el.style.pointerEvents = isActive ? 'auto' : 'none'
      el.style.zIndex = isActive ? '1' : '0'
    }
  }, [filePath, pool])

  const isInPool = filePath ? pool.some((e) => e.path === filePath) : false

  if (!filePath) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-xl bg-obsidian-float/50 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-obsidian-text-ghost" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm text-obsidian-text-muted">Select a file to view diff</p>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      {/* Pooled editors — PoolRenderer memo skips entirely for cached switches */}
      <div ref={poolRef}>
        <PoolRenderer pool={pool} viewMode={viewMode} />
      </div>

      {/* Loading overlay — shown whenever active file isn't pooled yet */}
      {!isInPool && (isLoading || diffContent !== null) && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-obsidian-bg">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-obsidian-accent/30 border-t-obsidian-accent rounded-full animate-spin" />
            <span className="text-sm text-obsidian-text-muted">Loading diff...</span>
          </div>
        </div>
      )}

      {/* Error overlay — only when loading finished with no content */}
      {!isInPool && !isLoading && !diffContent && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-obsidian-bg">
          <div className="w-12 h-12 rounded-xl bg-obsidian-deleted/10 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-obsidian-deleted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm text-obsidian-text-muted">Unable to load diff</p>
        </div>
      )}
    </div>
  )
})
