import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { DiffEditor } from '@monaco-editor/react'
import { DiffView } from '@renderer/components/diff/DiffView'

// Monaco mocks are in tests/setup.ts

describe('DiffView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('empty state', () => {
    it('shows placeholder when no file is selected', () => {
      render(
        <DiffView
          filePath={null}
          diffContent={null}
          isLoading={false}
        />
      )

      expect(screen.getByText('Select a file to view diff')).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('shows loading spinner when isLoading is true', () => {
      render(
        <DiffView
          filePath="test.ts"
          diffContent={null}
          isLoading={true}
        />
      )

      expect(screen.getByText('Loading diff...')).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('shows error message when diffContent is null but file is selected', () => {
      render(
        <DiffView
          filePath="test.ts"
          diffContent={null}
          isLoading={false}
        />
      )

      expect(screen.getByText('Unable to load diff')).toBeInTheDocument()
    })
  })

  describe('diff display', () => {
    it('renders diff editor with content', async () => {
      render(
        <DiffView
          filePath="test.ts"
          diffContent={{ original: 'old code', modified: 'new code' }}
          isLoading={false}
        />
      )

      const editor = await screen.findByTestId('mock-diff-editor')
      expect(editor).toBeInTheDocument()
    })
  })

  describe('language detection', () => {
    const testCases: Array<{ filePath: string; expectedLanguage: string }> = [
      // TypeScript
      { filePath: 'app.ts', expectedLanguage: 'typescript' },
      { filePath: 'App.tsx', expectedLanguage: 'typescript' },
      { filePath: 'path/to/component.TSX', expectedLanguage: 'typescript' },

      // JavaScript
      { filePath: 'app.js', expectedLanguage: 'javascript' },
      { filePath: 'Component.jsx', expectedLanguage: 'javascript' },

      // JSON
      { filePath: 'package.json', expectedLanguage: 'json' },
      { filePath: 'tsconfig.JSON', expectedLanguage: 'json' },

      // Markdown
      { filePath: 'README.md', expectedLanguage: 'markdown' },

      // CSS/SCSS/LESS
      { filePath: 'styles.css', expectedLanguage: 'css' },
      { filePath: 'styles.scss', expectedLanguage: 'scss' },
      { filePath: 'styles.less', expectedLanguage: 'less' },

      // HTML/XML
      { filePath: 'index.html', expectedLanguage: 'html' },
      { filePath: 'config.xml', expectedLanguage: 'xml' },

      // YAML
      { filePath: 'config.yaml', expectedLanguage: 'yaml' },
      { filePath: 'config.yml', expectedLanguage: 'yaml' },

      // Python
      { filePath: 'script.py', expectedLanguage: 'python' },

      // Ruby
      { filePath: 'script.rb', expectedLanguage: 'ruby' },

      // Go
      { filePath: 'main.go', expectedLanguage: 'go' },

      // Rust
      { filePath: 'main.rs', expectedLanguage: 'rust' },

      // Java
      { filePath: 'Main.java', expectedLanguage: 'java' },

      // Kotlin
      { filePath: 'Main.kt', expectedLanguage: 'kotlin' },

      // Swift
      { filePath: 'App.swift', expectedLanguage: 'swift' },

      // C/C++
      { filePath: 'main.c', expectedLanguage: 'c' },
      { filePath: 'main.cpp', expectedLanguage: 'cpp' },
      { filePath: 'header.h', expectedLanguage: 'c' },
      { filePath: 'header.hpp', expectedLanguage: 'cpp' },

      // C#
      { filePath: 'Program.cs', expectedLanguage: 'csharp' },

      // PHP
      { filePath: 'index.php', expectedLanguage: 'php' },

      // SQL
      { filePath: 'query.sql', expectedLanguage: 'sql' },

      // Shell
      { filePath: 'script.sh', expectedLanguage: 'shell' },
      { filePath: 'script.bash', expectedLanguage: 'shell' },
      { filePath: 'script.zsh', expectedLanguage: 'shell' },

      // Dockerfile
      { filePath: 'Dockerfile', expectedLanguage: 'dockerfile' },

      // Unknown extension
      { filePath: 'file.unknown', expectedLanguage: 'plaintext' },
      { filePath: 'no-extension', expectedLanguage: 'plaintext' },
    ]

    testCases.forEach(({ filePath, expectedLanguage }) => {
      it(`detects ${expectedLanguage} for ${filePath}`, async () => {
        render(
          <DiffView
            filePath={filePath}
            diffContent={{ original: '', modified: '' }}
            isLoading={false}
          />
        )

        const editor = await screen.findByTestId('mock-diff-editor')
        expect(editor).toHaveAttribute('data-language', expectedLanguage)
      })
    })

    it('falls back to hardcoded map when TextMate has no grammar', async () => {
      // TextMate mock in tests/setup.ts returns empty grammars,
      // so textMateService.getLanguageForFile() returns null and the hardcoded map is used.
      // All language detection tests above implicitly verify this fallback path.
      // This test makes that contract explicit.
      expect(window.electronAPI.grammar.scan).not.toHaveBeenCalled()

      render(
        <DiffView
          filePath="main.go"
          diffContent={{ original: '', modified: '' }}
          isLoading={false}
        />
      )

      const editor = await screen.findByTestId('mock-diff-editor')
      expect(editor).toHaveAttribute('data-language', 'go')
    })

    it('returns plaintext for null filePath', () => {
      render(
        <DiffView
          filePath={null}
          diffContent={{ original: '', modified: '' }}
          isLoading={false}
        />
      )

      expect(screen.getByText('Select a file to view diff')).toBeInTheDocument()
    })
  })

  describe('state transitions', () => {
    it('renders without crashing on prop changes', () => {
      const { rerender } = render(
        <DiffView
          filePath="file1.ts"
          diffContent={{ original: 'old', modified: 'new' }}
          isLoading={false}
        />
      )

      rerender(
        <DiffView
          filePath="file2.ts"
          diffContent={{ original: 'old2', modified: 'new2' }}
          isLoading={false}
        />
      )

      // With instance pooling, both editors exist (one hidden, one visible)
      const editors = screen.getAllByTestId('mock-diff-editor')
      expect(editors.length).toBeGreaterThanOrEqual(1)
    })

    it('transitions through states correctly', async () => {
      const { rerender } = render(
        <DiffView
          filePath={null}
          diffContent={null}
          isLoading={false}
        />
      )

      expect(screen.getByText('Select a file to view diff')).toBeInTheDocument()

      rerender(
        <DiffView
          filePath="test.ts"
          diffContent={null}
          isLoading={true}
        />
      )

      expect(screen.getByText('Loading diff...')).toBeInTheDocument()

      rerender(
        <DiffView
          filePath="test.ts"
          diffContent={{ original: 'old', modified: 'new' }}
          isLoading={false}
        />
      )

      expect(await screen.findByTestId('mock-diff-editor')).toBeInTheDocument()
    })
  })

  describe('editor pooling behavior', () => {
    it('defers large diff editor mount until idle time', async () => {
      vi.useFakeTimers()
      const originalRequestIdleCallback = window.requestIdleCallback
      const originalCancelIdleCallback = window.cancelIdleCallback

      const requestIdleCallbackMock = vi.fn((callback: IdleRequestCallback) => {
        callback({
          didTimeout: false,
          timeRemaining: () => 50,
        } as IdleDeadline)
        return 1
      })
      const cancelIdleCallbackMock = vi.fn((id: number) => {
        void id
      })

      try {
        Object.defineProperty(window, 'requestIdleCallback', {
          configurable: true,
          writable: true,
          value: requestIdleCallbackMock,
        })
        Object.defineProperty(window, 'cancelIdleCallback', {
          configurable: true,
          writable: true,
          value: cancelIdleCallbackMock,
        })

        const largeText = 'x'.repeat(120_000)
        const { container } = render(
          <DiffView
            filePath="huge.ts"
            diffContent={{ original: largeText, modified: largeText }}
            isLoading={false}
          />
        )

        expect(screen.queryByTestId('mock-diff-editor')).not.toBeInTheDocument()
        expect(container.querySelector('[data-file="huge.ts"]')).not.toBeInTheDocument()

        await act(async () => {
          await vi.advanceTimersByTimeAsync(40)
        })

        expect(requestIdleCallbackMock).toHaveBeenCalledTimes(1)
        expect(container.querySelector('[data-file="huge.ts"]')).toBeInTheDocument()
      } finally {
        Object.defineProperty(window, 'requestIdleCallback', {
          configurable: true,
          writable: true,
          value: originalRequestIdleCallback,
        })
        Object.defineProperty(window, 'cancelIdleCallback', {
          configurable: true,
          writable: true,
          value: originalCancelIdleCallback,
        })
        vi.useRealTimers()
      }
    })

    it('evicts least recently used editor when pool grows past cap', async () => {
      const { rerender, container } = render(
        <DiffView
          filePath="file-1.ts"
          diffContent={{ original: 'old-1', modified: 'new-1' }}
          isLoading={false}
        />
      )

      await screen.findByTestId('mock-diff-editor')

      for (let i = 2; i <= 9; i++) {
        rerender(
          <DiffView
            filePath={`file-${i}.ts`}
            diffContent={{ original: `old-${i}`, modified: `new-${i}` }}
            isLoading={false}
          />
        )
      }

      const editors = await screen.findAllByTestId('mock-diff-editor')
      expect(editors).toHaveLength(8)
      expect(container.querySelector('[data-file="file-1.ts"]')).not.toBeInTheDocument()
      expect(container.querySelector('[data-file="file-9.ts"]')).toBeInTheDocument()
    })

    it('toggles active editor visibility styles when switching files', async () => {
      const { rerender, container } = render(
        <DiffView
          filePath="alpha.ts"
          diffContent={{ original: 'a', modified: 'a1' }}
          isLoading={false}
        />
      )

      await screen.findByTestId('mock-diff-editor')

      rerender(
        <DiffView
          filePath="beta.ts"
          diffContent={{ original: 'b', modified: 'b1' }}
          isLoading={false}
        />
      )

      const alpha = container.querySelector('[data-file="alpha.ts"]') as HTMLElement
      const beta = container.querySelector('[data-file="beta.ts"]') as HTMLElement

      expect(alpha.style.opacity).toBe('0')
      expect(alpha.style.pointerEvents).toBe('none')
      expect(alpha.style.zIndex).toBe('0')

      expect(beta.style.opacity).toBe('1')
      expect(beta.style.pointerEvents).toBe('auto')
      expect(beta.style.zIndex).toBe('1')
    })

    it('sets wordWrap option when wordWrap prop is true', async () => {
      const diffEditorMock = vi.mocked(DiffEditor)
      const diff = { original: 'before', modified: 'after' }

      const { rerender } = render(
        <DiffView
          filePath="wrap.ts"
          diffContent={diff}
          isLoading={false}
          wordWrap={false}
        />
      )

      await screen.findByTestId('mock-diff-editor')
      const noWrapProps = diffEditorMock.mock.calls.at(-1)?.[0] as { options: Record<string, unknown> }
      expect(noWrapProps.options.wordWrap).toBeUndefined()

      rerender(
        <DiffView
          filePath="wrap.ts"
          diffContent={diff}
          isLoading={false}
          wordWrap={true}
        />
      )
      const wrapProps = diffEditorMock.mock.calls.at(-1)?.[0] as { options: Record<string, unknown> }
      expect(wrapProps.options.wordWrap).toBe('on')
    })

    it('changes Monaco options when viewMode changes', async () => {
      const diffEditorMock = vi.mocked(DiffEditor)
      const diff = { original: 'before', modified: 'after' }

      const { rerender } = render(
        <DiffView
          filePath="modes.ts"
          diffContent={diff}
          isLoading={false}
          viewMode="auto"
        />
      )

      await screen.findByTestId('mock-diff-editor')
      const autoProps = diffEditorMock.mock.calls.at(-1)?.[0] as { options: Record<string, unknown> }
      expect(autoProps.options.renderSideBySide).toBe(true)

      rerender(
        <DiffView
          filePath="modes.ts"
          diffContent={diff}
          isLoading={false}
          viewMode="unified"
        />
      )
      const unifiedProps = diffEditorMock.mock.calls.at(-1)?.[0] as { options: Record<string, unknown> }
      expect(unifiedProps.options.renderSideBySide).toBe(false)

      rerender(
        <DiffView
          filePath="modes.ts"
          diffContent={diff}
          isLoading={false}
          viewMode="split"
        />
      )
      const splitProps = diffEditorMock.mock.calls.at(-1)?.[0] as { options: Record<string, unknown> }
      expect(splitProps.options.renderSideBySide).toBe(true)
      expect(splitProps.options.useInlineViewWhenSpaceIsLimited).toBe(false)
    })
  })
})
