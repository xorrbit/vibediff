import { DiffEditor, loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

interface MonacoDiffEditorProps {
  original: string
  modified: string
  language: string
  options: Record<string, unknown>
}

const DIFF_THEME = 'obsidian-diff'

let monacoConfigured = false

function configureMonaco() {
  if (monacoConfigured) return
  monacoConfigured = true

  // Configure Monaco to use local files instead of CDN
  loader.config({ monaco })

  // Custom obsidian theme with stronger diff contrast
  monaco.editor.defineTheme(DIFF_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#111113',
      'editor.lineHighlightBackground': '#00000000',
      'editorLineNumber.foreground': '#52525b',
      'editorLineNumber.activeForeground': '#a1a1aa',
      'editorGutter.background': '#0a0a0b',
      'diffEditor.insertedTextBackground': '#34d39918',
      'diffEditor.insertedLineBackground': '#34d39915',
      'diffEditorGutter.insertedLineBackground': '#34d39930',
      'diffEditor.removedTextBackground': '#f8717118',
      'diffEditor.removedLineBackground': '#f8717112',
      'diffEditorGutter.removedLineBackground': '#f8717130',
      'diffEditorOverview.insertedForeground': '#34d39960',
      'diffEditorOverview.removedForeground': '#f8717160',
      'scrollbarSlider.background': '#27272c80',
      'scrollbarSlider.hoverBackground': '#3d3d45',
      'scrollbarSlider.activeBackground': '#52525b',
    },
  })
}

export function MonacoDiffEditor({
  original,
  modified,
  language,
  options,
}: MonacoDiffEditorProps) {
  configureMonaco()

  return (
    <DiffEditor
      original={original}
      modified={modified}
      language={language}
      theme={DIFF_THEME}
      options={options}
    />
  )
}
