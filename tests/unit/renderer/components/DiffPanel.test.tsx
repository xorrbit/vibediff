import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { ChangedFile, DiffContent } from '@shared/types'

// Mock child hooks and components
const mockUseGitDiff = vi.fn()

vi.mock('@renderer/hooks/useGitDiff', () => ({
  useGitDiff: (...args: any[]) => mockUseGitDiff(...args),
}))

vi.mock('@renderer/components/diff/FileList', () => ({
  FileList: vi.fn(({ files, onSelectFile }: any) => {
    const React = require('react')
    return React.createElement('div', { 'data-testid': 'mock-file-list' },
      files.map((f: any) =>
        React.createElement('button', {
          key: f.path,
          'data-testid': `file-${f.path}`,
          onClick: () => onSelectFile(f.path),
        }, f.path)
      )
    )
  }),
}))

vi.mock('@renderer/components/diff/DiffView', () => ({
  DiffView: vi.fn(({ filePath, diffContent, isLoading, viewMode }: any) => {
    const React = require('react')
    return React.createElement('div', {
      'data-testid': 'mock-diff-view',
      'data-file': filePath || '',
      'data-loading': String(isLoading),
      'data-view-mode': viewMode || 'auto',
    }, diffContent ? 'Has diff' : 'No diff')
  }),
}))

import { DiffPanel } from '@renderer/components/diff/DiffPanel'

describe('DiffPanel', () => {
  const defaultGitDiff = {
    files: [] as ChangedFile[],
    selectedFile: null as string | null,
    diffContent: null as DiffContent | null,
    isLoading: false,
    isDiffLoading: false,
    error: null as string | null,
    selectFile: vi.fn(),
    refresh: vi.fn(),
  }

  const defaultDiffViewMode = 'unified' as const
  const defaultOnDiffViewModeChange = vi.fn()
  const defaultWordWrap = false
  const defaultOnWordWrapChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockUseGitDiff.mockReturnValue({ ...defaultGitDiff })
  })

  it('renders error state with retry button', () => {
    const refresh = vi.fn()
    mockUseGitDiff.mockReturnValue({
      ...defaultGitDiff,
      error: 'Git repository not found',
      refresh,
    })

    render(<DiffPanel sessionId="s1" cwd="/project" diffViewMode={defaultDiffViewMode} onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />)

    expect(screen.getByText('Git repository not found')).toBeInTheDocument()
    expect(screen.getByText('Try again')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Try again'))
    expect(refresh).toHaveBeenCalled()
  })

  it('renders file list and diff view when no error', () => {
    mockUseGitDiff.mockReturnValue({
      ...defaultGitDiff,
      files: [{ path: 'file.ts', status: 'M' }],
    })

    render(<DiffPanel sessionId="s1" cwd="/project" diffViewMode={defaultDiffViewMode} onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />)

    expect(screen.getByTestId('mock-file-list')).toBeInTheDocument()
    expect(screen.getByTestId('mock-diff-view')).toBeInTheDocument()
  })

  it('shows file count badge', () => {
    mockUseGitDiff.mockReturnValue({
      ...defaultGitDiff,
      files: [
        { path: 'file1.ts', status: 'M' },
        { path: 'file2.ts', status: 'A' },
      ],
    })

    render(<DiffPanel sessionId="s1" cwd="/project" diffViewMode={defaultDiffViewMode} onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />)

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows selected file path header', () => {
    mockUseGitDiff.mockReturnValue({
      ...defaultGitDiff,
      selectedFile: 'src/main.ts',
    })

    render(<DiffPanel sessionId="s1" cwd="/project" diffViewMode={defaultDiffViewMode} onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />)

    expect(screen.getByText('src/main.ts')).toBeInTheDocument()
  })

  it('passes cwd and gitRootHint props through to useGitDiff', () => {
    render(<DiffPanel sessionId="s1" cwd="/project/subdir" gitRootHint="/project" diffViewMode={defaultDiffViewMode} onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />)

    expect(mockUseGitDiff).toHaveBeenCalledWith({
      sessionId: 's1',
      cwd: '/project/subdir',
      gitRootHint: '/project',
    })
  })

  it('defaults gitRootHint to undefined when not provided', () => {
    render(<DiffPanel sessionId="s1" cwd="/project" diffViewMode={defaultDiffViewMode} onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />)

    expect(mockUseGitDiff).toHaveBeenCalledWith({
      sessionId: 's1',
      cwd: '/project',
      gitRootHint: undefined,
    })
  })

  it('calls selectFile and onFocusTerminal when file is selected', () => {
    const selectFile = vi.fn()
    const onFocusTerminal = vi.fn()
    mockUseGitDiff.mockReturnValue({
      ...defaultGitDiff,
      files: [{ path: 'file.ts', status: 'M' }],
      selectFile,
    })

    render(
      <DiffPanel sessionId="s1" cwd="/project" onFocusTerminal={onFocusTerminal} diffViewMode={defaultDiffViewMode} onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />
    )

    fireEvent.click(screen.getByTestId('file-file.ts'))

    expect(selectFile).toHaveBeenCalledWith('file.ts')
    expect(onFocusTerminal).toHaveBeenCalled()
  })

  it('toggles collapse state', () => {
    mockUseGitDiff.mockReturnValue({
      ...defaultGitDiff,
      files: [{ path: 'file.ts', status: 'M' }],
    })

    const { container } = render(<DiffPanel sessionId="s1" cwd="/project" diffViewMode={defaultDiffViewMode} onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />)

    // Find the collapse toggle button
    const toggleButton = container.querySelector('button[title*="Collapse"]') ||
      container.querySelector('button[title*="Expand"]')

    expect(toggleButton).toBeInTheDocument()
  })

  it('shows refresh button', () => {
    const refresh = vi.fn()
    mockUseGitDiff.mockReturnValue({
      ...defaultGitDiff,
      refresh,
    })

    const { container } = render(<DiffPanel sessionId="s1" cwd="/project" diffViewMode={defaultDiffViewMode} onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />)

    const refreshButton = container.querySelector('button[title="Refresh"]')
    expect(refreshButton).toBeInTheDocument()

    if (refreshButton) {
      fireEvent.click(refreshButton)
      expect(refresh).toHaveBeenCalled()
    }
  })

  it('shows loading spinner on refresh button when loading', () => {
    mockUseGitDiff.mockReturnValue({
      ...defaultGitDiff,
      isLoading: true,
    })

    const { container } = render(<DiffPanel sessionId="s1" cwd="/project" diffViewMode={defaultDiffViewMode} onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />)

    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders Changes header', () => {
    render(<DiffPanel sessionId="s1" cwd="/project" diffViewMode={defaultDiffViewMode} onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />)

    expect(screen.getByText('Changes')).toBeInTheDocument()
  })

  it('does not show file count badge when no files', () => {
    mockUseGitDiff.mockReturnValue({
      ...defaultGitDiff,
      files: [],
    })

    render(<DiffPanel sessionId="s1" cwd="/project" diffViewMode={defaultDiffViewMode} onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />)

    // The badge with file count should not appear
    const badge = screen.queryByText('0')
    expect(badge).not.toBeInTheDocument()
  })

  describe('resize behavior', () => {
    it('cycles diff mode unified -> split -> auto and calls onDiffViewModeChange', () => {
      const onFocusTerminal = vi.fn()
      const onDiffViewModeChange = vi.fn()
      mockUseGitDiff.mockReturnValue({
        ...defaultGitDiff,
        selectedFile: 'src/main.ts',
        diffContent: { original: 'old', modified: 'new' },
      })

      const { rerender } = render(
        <DiffPanel sessionId="s1" cwd="/project" onFocusTerminal={onFocusTerminal} diffViewMode="unified" onDiffViewModeChange={onDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />
      )

      expect(screen.getByTestId('mock-diff-view')).toHaveAttribute('data-view-mode', 'unified')

      fireEvent.click(screen.getByTitle('View: Unified'))
      expect(onDiffViewModeChange).toHaveBeenCalledWith('split')

      rerender(
        <DiffPanel sessionId="s1" cwd="/project" onFocusTerminal={onFocusTerminal} diffViewMode="split" onDiffViewModeChange={onDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />
      )
      expect(screen.getByTestId('mock-diff-view')).toHaveAttribute('data-view-mode', 'split')

      fireEvent.click(screen.getByTitle('View: Split'))
      expect(onDiffViewModeChange).toHaveBeenCalledWith('auto')

      rerender(
        <DiffPanel sessionId="s1" cwd="/project" onFocusTerminal={onFocusTerminal} diffViewMode="auto" onDiffViewModeChange={onDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />
      )

      fireEvent.click(screen.getByTitle('View: Automatic'))
      expect(onDiffViewModeChange).toHaveBeenCalledWith('unified')
      expect(onFocusTerminal).toHaveBeenCalledTimes(3)
    })

    it('renders with the diffViewMode prop', () => {
      mockUseGitDiff.mockReturnValue({
        ...defaultGitDiff,
        selectedFile: 'src/main.ts',
        diffContent: { original: 'old', modified: 'new' },
      })

      render(<DiffPanel sessionId="s1" cwd="/project" diffViewMode="split" onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />)

      expect(screen.getByTestId('mock-diff-view')).toHaveAttribute('data-view-mode', 'split')
    })

    it('calls onDiffViewModeChange with next mode on cycle click', () => {
      const onDiffViewModeChange = vi.fn()
      mockUseGitDiff.mockReturnValue({
        ...defaultGitDiff,
        selectedFile: 'src/main.ts',
        diffContent: { original: 'old', modified: 'new' },
      })

      render(<DiffPanel sessionId="s1" cwd="/project" diffViewMode="unified" onDiffViewModeChange={onDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />)

      fireEvent.click(screen.getByTitle('View: Unified'))

      expect(onDiffViewModeChange).toHaveBeenCalledWith('split')
    })

    it('toggles word wrap and calls onWordWrapChange', () => {
      const onWordWrapChange = vi.fn()
      const onFocusTerminal = vi.fn()
      mockUseGitDiff.mockReturnValue({
        ...defaultGitDiff,
        selectedFile: 'src/main.ts',
        diffContent: { original: 'old', modified: 'new' },
      })

      render(
        <DiffPanel sessionId="s1" cwd="/project" onFocusTerminal={onFocusTerminal} diffViewMode={defaultDiffViewMode} onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={false} onWordWrapChange={onWordWrapChange} />
      )

      fireEvent.click(screen.getByTitle('Word wrap: Off'))
      expect(onWordWrapChange).toHaveBeenCalledWith(true)
      expect(onFocusTerminal).toHaveBeenCalled()
    })

    it('shows word wrap button as active when wordWrap is true', () => {
      mockUseGitDiff.mockReturnValue({
        ...defaultGitDiff,
        selectedFile: 'src/main.ts',
        diffContent: { original: 'old', modified: 'new' },
      })

      render(
        <DiffPanel sessionId="s1" cwd="/project" diffViewMode={defaultDiffViewMode} onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={true} onWordWrapChange={defaultOnWordWrapChange} />
      )

      const wrapButton = screen.getByTitle('Word wrap: On')
      expect(wrapButton.className).toContain('text-obsidian-accent')
    })

    it('copies selected file path and filename to clipboard', () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      })

      mockUseGitDiff.mockReturnValue({
        ...defaultGitDiff,
        selectedFile: 'src/components/App.tsx',
      })

      render(<DiffPanel sessionId="s1" cwd="/project" diffViewMode={defaultDiffViewMode} onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />)

      fireEvent.click(screen.getByTitle('Copy relative path'))
      fireEvent.click(screen.getByTitle('Copy filename'))

      expect(writeText).toHaveBeenNthCalledWith(1, 'src/components/App.tsx')
      expect(writeText).toHaveBeenNthCalledWith(2, 'App.tsx')
    })

    it('clamps file list width between 180 and 500', () => {
      mockUseGitDiff.mockReturnValue({
        ...defaultGitDiff,
        files: [{ path: 'file.ts', status: 'M' }],
      })

      const { container } = render(<DiffPanel sessionId="s1" cwd="/project" diffViewMode={defaultDiffViewMode} onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />)
      const immediateRaf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0)
        return 1
      })

      const panelContainer = container.firstElementChild as HTMLDivElement
      Object.defineProperty(panelContainer, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 420, top: 0, width: 900, height: 600, right: 1320, bottom: 600 }),
      })

      const widthHandle = container.querySelector('.cursor-col-resize') as HTMLDivElement
      const floatingPanel = container.querySelector('[style*="width"]') as HTMLDivElement

      fireEvent.mouseDown(widthHandle, { clientX: 100 })
      fireEvent.mouseMove(document, { clientX: -400 })
      fireEvent.mouseUp(document)
      expect(floatingPanel.style.width).toBe('500px')

      fireEvent.mouseDown(widthHandle, { clientX: 100 })
      fireEvent.mouseMove(document, { clientX: 410 })
      fireEvent.mouseUp(document)
      expect(floatingPanel.style.width).toBe('180px')

      expect(floatingPanel).toBeInTheDocument()
      immediateRaf.mockRestore()
    })

    it('clamps file list height between 100 and 90% of container height', () => {
      mockUseGitDiff.mockReturnValue({
        ...defaultGitDiff,
        files: [{ path: 'file.ts', status: 'M' }],
      })

      const { container } = render(<DiffPanel sessionId="s1" cwd="/project" diffViewMode={defaultDiffViewMode} onDiffViewModeChange={defaultOnDiffViewModeChange} wordWrap={defaultWordWrap} onWordWrapChange={defaultOnWordWrapChange} />)
      const immediateRaf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0)
        return 1
      })

      const panelContainer = container.firstElementChild as HTMLDivElement
      const floatingPanel = container.querySelector('[style*="width"]') as HTMLDivElement
      const heightHandle = container.querySelector('.cursor-row-resize') as HTMLDivElement

      Object.defineProperty(panelContainer, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 420, top: 0, width: 900, height: 500, right: 1320, bottom: 500 }),
      })
      Object.defineProperty(floatingPanel, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, top: 100, width: 256, height: 240, right: 256, bottom: 340 }),
      })

      fireEvent.mouseDown(heightHandle, { clientY: 120 })
      fireEvent.mouseMove(document, { clientY: 800 })
      fireEvent.mouseUp(document)
      expect(floatingPanel.style.maxHeight).toBe('450px')

      fireEvent.mouseDown(heightHandle, { clientY: 120 })
      fireEvent.mouseMove(document, { clientY: 110 })
      fireEvent.mouseUp(document)
      expect(floatingPanel.style.maxHeight).toBe('100px')

      immediateRaf.mockRestore()
    })
  })
})
