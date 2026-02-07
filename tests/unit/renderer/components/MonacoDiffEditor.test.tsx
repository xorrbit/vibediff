import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

describe('MonacoDiffEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('configures loader/theme only once across repeated renders', async () => {
    const { MonacoDiffEditor } = await import('@renderer/components/diff/MonacoDiffEditor')
    const { loader } = await import('@monaco-editor/react')
    const monaco = await import('monaco-editor')

    const { rerender } = render(
      <MonacoDiffEditor
        original="old"
        modified="new"
        language="typescript"
        options={{ readOnly: true }}
      />
    )

    rerender(
      <MonacoDiffEditor
        original="old-2"
        modified="new-2"
        language="typescript"
        options={{ readOnly: true }}
      />
    )

    expect(loader.config).toHaveBeenCalledTimes(1)
    expect(monaco.editor.defineTheme).toHaveBeenCalledTimes(1)
  })

  it('passes language/theme/options through to DiffEditor', async () => {
    const { MonacoDiffEditor } = await import('@renderer/components/diff/MonacoDiffEditor')
    const monacoReact = await import('@monaco-editor/react')

    render(
      <MonacoDiffEditor
        original="before"
        modified="after"
        language="go"
        options={{ renderSideBySide: false, minimap: { enabled: false } }}
      />
    )

    const diffEditorMock = vi.mocked(monacoReact.DiffEditor)
    const props = diffEditorMock.mock.calls[0][0] as Record<string, any>

    expect(props.original).toBe('before')
    expect(props.modified).toBe('after')
    expect(props.language).toBe('go')
    expect(props.theme).toBe('obsidian-diff')
    expect(props.options).toEqual({ renderSideBySide: false, minimap: { enabled: false } })
  })
})
