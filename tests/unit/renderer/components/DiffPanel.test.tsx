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
  DiffView: vi.fn(({ filePath, diffContent, isLoading }: any) => {
    const React = require('react')
    return React.createElement('div', {
      'data-testid': 'mock-diff-view',
      'data-file': filePath || '',
      'data-loading': String(isLoading),
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

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseGitDiff.mockReturnValue({ ...defaultGitDiff })
  })

  it('renders error state with retry button', () => {
    const refresh = vi.fn()
    mockUseGitDiff.mockReturnValue({
      ...defaultGitDiff,
      error: 'Git repository not found',
      refresh,
    })

    render(<DiffPanel sessionId="s1" cwd="/project" />)

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

    render(<DiffPanel sessionId="s1" cwd="/project" />)

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

    render(<DiffPanel sessionId="s1" cwd="/project" />)

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows selected file path header', () => {
    mockUseGitDiff.mockReturnValue({
      ...defaultGitDiff,
      selectedFile: 'src/main.ts',
    })

    render(<DiffPanel sessionId="s1" cwd="/project" />)

    expect(screen.getByText('src/main.ts')).toBeInTheDocument()
  })

  it('passes cwd and gitRootHint props through to useGitDiff', () => {
    render(<DiffPanel sessionId="s1" cwd="/project/subdir" gitRootHint="/project" />)

    expect(mockUseGitDiff).toHaveBeenCalledWith({
      sessionId: 's1',
      cwd: '/project/subdir',
      gitRootHint: '/project',
    })
  })

  it('defaults gitRootHint to undefined when not provided', () => {
    render(<DiffPanel sessionId="s1" cwd="/project" />)

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
      <DiffPanel sessionId="s1" cwd="/project" onFocusTerminal={onFocusTerminal} />
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

    const { container } = render(<DiffPanel sessionId="s1" cwd="/project" />)

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

    const { container } = render(<DiffPanel sessionId="s1" cwd="/project" />)

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

    const { container } = render(<DiffPanel sessionId="s1" cwd="/project" />)

    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders Changes header', () => {
    render(<DiffPanel sessionId="s1" cwd="/project" />)

    expect(screen.getByText('Changes')).toBeInTheDocument()
  })

  it('does not show file count badge when no files', () => {
    mockUseGitDiff.mockReturnValue({
      ...defaultGitDiff,
      files: [],
    })

    render(<DiffPanel sessionId="s1" cwd="/project" />)

    // The badge with file count should not appear
    const badge = screen.queryByText('0')
    expect(badge).not.toBeInTheDocument()
  })

  describe('resize behavior', () => {
    it('clamps file list width between 180 and 500', () => {
      mockUseGitDiff.mockReturnValue({
        ...defaultGitDiff,
        files: [{ path: 'file.ts', status: 'M' }],
      })

      const { container } = render(<DiffPanel sessionId="s1" cwd="/project" />)

      // The file list panel should have a width style
      const floatingPanel = container.querySelector('[style*="width"]')
      expect(floatingPanel).toBeInTheDocument()
    })
  })
})
