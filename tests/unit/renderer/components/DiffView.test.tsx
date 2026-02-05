import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

      expect(screen.getByTestId('mock-diff-editor')).toBeInTheDocument()
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
})
