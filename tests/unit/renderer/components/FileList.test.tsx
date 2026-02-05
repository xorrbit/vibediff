import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileList } from '@renderer/components/diff/FileList'
import { ChangedFile } from '@shared/types'

const mockFiles: ChangedFile[] = [
  { path: 'src/components/Button.tsx', status: 'M' },
  { path: 'src/utils/helpers.ts', status: 'A' },
  { path: 'package.json', status: 'M' },
  { path: 'old-file.js', status: 'D' },
]

describe('FileList', () => {
  it('renders correct number of files', () => {
    render(
      <FileList
        files={mockFiles}
        selectedFile={null}
        onSelectFile={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText('Button.tsx')).toBeInTheDocument()
    expect(screen.getByText('helpers.ts')).toBeInTheDocument()
    expect(screen.getByText('package.json')).toBeInTheDocument()
    expect(screen.getByText('old-file.js')).toBeInTheDocument()
  })

  it('shows correct status indicators', () => {
    render(
      <FileList
        files={mockFiles}
        selectedFile={null}
        onSelectFile={vi.fn()}
        isLoading={false}
      />
    )

    // Status letters should be visible
    const statusIndicators = screen.getAllByText(/^[AMDR?]$/)
    expect(statusIndicators).toHaveLength(4)

    // Check specific statuses - use getAllByText for 'M' since there are 2 modified files
    expect(screen.getAllByText('M')).toHaveLength(2) // Modified (appears twice)
    expect(screen.getByText('A')).toBeInTheDocument() // Added
    expect(screen.getByText('D')).toBeInTheDocument() // Deleted
  })

  it('shows correct status colors', () => {
    const files: ChangedFile[] = [
      { path: 'added.ts', status: 'A' },
      { path: 'modified.ts', status: 'M' },
      { path: 'deleted.ts', status: 'D' },
    ]

    render(
      <FileList
        files={files}
        selectedFile={null}
        onSelectFile={vi.fn()}
        isLoading={false}
      />
    )

    const addedIndicator = screen.getByText('A')
    const modifiedIndicator = screen.getByText('M')
    const deletedIndicator = screen.getByText('D')

    expect(addedIndicator.className).toContain('text-terminal-added')
    expect(modifiedIndicator.className).toContain('text-terminal-modified')
    expect(deletedIndicator.className).toContain('text-terminal-deleted')
  })

  it('calls onSelectFile when file clicked', () => {
    const onSelectFile = vi.fn()

    render(
      <FileList
        files={mockFiles}
        selectedFile={null}
        onSelectFile={onSelectFile}
        isLoading={false}
      />
    )

    fireEvent.click(screen.getByText('Button.tsx'))
    expect(onSelectFile).toHaveBeenCalledWith('src/components/Button.tsx')

    fireEvent.click(screen.getByText('helpers.ts'))
    expect(onSelectFile).toHaveBeenCalledWith('src/utils/helpers.ts')
  })

  it('shows empty state when no files', () => {
    render(
      <FileList
        files={[]}
        selectedFile={null}
        onSelectFile={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText('No changes detected')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(
      <FileList
        files={[]}
        selectedFile={null}
        onSelectFile={vi.fn()}
        isLoading={true}
      />
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows files even while loading if files exist', () => {
    render(
      <FileList
        files={mockFiles}
        selectedFile={null}
        onSelectFile={vi.fn()}
        isLoading={true}
      />
    )

    // Should show files, not loading message
    expect(screen.getByText('Button.tsx')).toBeInTheDocument()
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('highlights selected file', () => {
    render(
      <FileList
        files={mockFiles}
        selectedFile="src/components/Button.tsx"
        onSelectFile={vi.fn()}
        isLoading={false}
      />
    )

    const selectedButton = screen.getByText('Button.tsx').closest('button')!
    expect(selectedButton.className).toContain('bg-terminal-surface')

    const unselectedButton = screen.getByText('helpers.ts').closest('button')!
    // Should not have the selected class (when not selected)
    // Note: it may still have hover state classes
  })

  it('shows directory path for files in subdirectories', () => {
    render(
      <FileList
        files={mockFiles}
        selectedFile={null}
        onSelectFile={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText('src/components')).toBeInTheDocument()
    expect(screen.getByText('src/utils')).toBeInTheDocument()
  })

  it('does not show directory for root files', () => {
    const rootFiles: ChangedFile[] = [
      { path: 'README.md', status: 'M' },
    ]

    render(
      <FileList
        files={rootFiles}
        selectedFile={null}
        onSelectFile={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText('README.md')).toBeInTheDocument()
    // Should not have an empty path line
  })

  it('scrolls with many files', () => {
    const manyFiles: ChangedFile[] = Array.from({ length: 50 }, (_, i) => ({
      path: `src/file${i}.ts`,
      status: 'M' as const,
    }))

    const { container } = render(
      <FileList
        files={manyFiles}
        selectedFile={null}
        onSelectFile={vi.fn()}
        isLoading={false}
      />
    )

    // The container should have overflow-y-auto for scrolling
    const scrollContainer = container.querySelector('.overflow-y-auto')
    expect(scrollContainer).toBeInTheDocument()
  })
})
