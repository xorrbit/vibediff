import { memo, lazy, Suspense } from 'react'
import { DiffContent } from '@shared/types'
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

// Configure Monaco to use local files instead of CDN
loader.config({ monaco })

// Lazy load Monaco to avoid blocking initial render
const DiffEditor = lazy(() =>
  import('@monaco-editor/react').then((mod) => ({ default: mod.DiffEditor }))
)

interface DiffViewProps {
  filePath: string | null
  diffContent: DiffContent | null
  isLoading: boolean
}

// Get language from file extension
function getLanguage(filePath: string | null): string {
  if (!filePath) return 'plaintext'

  const ext = filePath.split('.').pop()?.toLowerCase()

  const languageMap: Record<string, string> = {
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

  return ext ? languageMap[ext] || 'plaintext' : 'plaintext'
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

export const DiffView = memo(function DiffView({ filePath, diffContent, isLoading }: DiffViewProps) {
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

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-obsidian-accent/30 border-t-obsidian-accent rounded-full animate-spin" />
          <span className="text-sm text-obsidian-text-muted">Loading diff...</span>
        </div>
      </div>
    )
  }

  if (!diffContent) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-xl bg-obsidian-deleted/10 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-obsidian-deleted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-sm text-obsidian-text-muted">Unable to load diff</p>
      </div>
    )
  }

  const language = getLanguage(filePath)

  return (
    <Suspense fallback={<LoadingFallback />}>
      <DiffEditor
        original={diffContent.original}
        modified={diffContent.modified}
        language={language}
        theme="vs-dark"
        options={{
          readOnly: true,
          renderSideBySide: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          lineHeight: 20,
          fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', Consolas, monospace",
          fontLigatures: true,
          folding: true,
          lineNumbers: 'on',
          renderLineHighlight: 'none',
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
            useShadows: false,
          },
          padding: { top: 12, bottom: 12 },
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
        }}
      />
    </Suspense>
  )
})
