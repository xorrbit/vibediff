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
    <div className="h-full flex items-center justify-center text-terminal-text-muted">
      <p className="text-sm">Loading editor...</p>
    </div>
  )
}

export const DiffView = memo(function DiffView({ filePath, diffContent, isLoading }: DiffViewProps) {
  if (!filePath) {
    return (
      <div className="h-full flex items-center justify-center text-terminal-text-muted">
        <p className="text-sm">Select a file to view diff</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-terminal-text-muted">
        <p className="text-sm">Loading diff...</p>
      </div>
    )
  }

  if (!diffContent) {
    return (
      <div className="h-full flex items-center justify-center text-terminal-text-muted">
        <p className="text-sm">Unable to load diff</p>
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
          fontSize: 12,
          lineHeight: 18,
          folding: true,
          lineNumbers: 'on',
          renderLineHighlight: 'none',
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          padding: { top: 8, bottom: 8 },
        }}
      />
    </Suspense>
  )
})
