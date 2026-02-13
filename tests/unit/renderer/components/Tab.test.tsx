import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Tab } from '@renderer/components/layout/Tab'

describe('Tab', () => {
  const defaultProps = {
    id: 'session-1',
    name: 'project1',
    fullPath: '/home/user/project1',
    isActive: false,
    isWaiting: false,
    onSelect: vi.fn(),
    onClose: vi.fn(),
    index: 0,
  }

  it('renders tab name', () => {
    render(<Tab {...defaultProps} />)

    expect(screen.getByText('project1')).toBeInTheDocument()
  })

  it('shows full path as tooltip', () => {
    render(<Tab {...defaultProps} />)

    const button = screen.getByText('project1').closest('button')!
    expect(button).toHaveAttribute('title', '/home/user/project1')
  })

  it('calls onSelect when tab is clicked', () => {
    const onSelect = vi.fn()
    render(<Tab {...defaultProps} onSelect={onSelect} />)

    fireEvent.click(screen.getByText('project1'))

    expect(onSelect).toHaveBeenCalled()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    const onSelect = vi.fn()
    render(<Tab {...defaultProps} onClose={onClose} onSelect={onSelect} isActive={true} />)

    // The close button is a span with an SVG
    const tab = screen.getByText('project1').closest('button')!
    const closeButton = tab.querySelector('span[class*="hover:bg-obsidian-deleted"]')!
    fireEvent.click(closeButton)

    expect(onClose).toHaveBeenCalled()
    // onSelect should NOT be called (stopPropagation)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('applies active tab styling when active', () => {
    render(<Tab {...defaultProps} isActive={true} />)

    const button = screen.getByText('project1').closest('button')!
    expect(button.className).toContain('bg-obsidian-bg')
    expect(button.className).toContain('text-obsidian-text')
  })

  it('applies inactive tab styling when not active', () => {
    render(<Tab {...defaultProps} isActive={false} />)

    const button = screen.getByText('project1').closest('button')!
    expect(button.className).toContain('text-obsidian-text-muted')
  })

  it('shows accent line when active', () => {
    const { container } = render(<Tab {...defaultProps} isActive={true} />)

    // Active tab has a gradient accent line
    const accentLine = container.querySelector('.bg-gradient-to-r')
    expect(accentLine).toBeInTheDocument()
  })

  it('shows waiting indicator when waiting in a background tab', () => {
    const { container } = render(<Tab {...defaultProps} isWaiting={true} isActive={false} />)

    const waitingDot = container.querySelector('.animate-tab-waiting')
    expect(waitingDot).toBeInTheDocument()
  })

  it('applies animation delay based on index', () => {
    const { container } = render(<Tab {...defaultProps} index={2} />)

    const button = container.querySelector('button')!
    expect(button.style.animationDelay).toBe('100ms') // 2 * 50ms
  })

  describe('drag and drop', () => {
    const mockDataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => '0'),
      effectAllowed: '' as string,
      dropEffect: '' as string,
    }

    it('sets draggable attribute on the button', () => {
      const { container } = render(<Tab {...defaultProps} />)
      const button = container.querySelector('button')!
      expect(button).toHaveAttribute('draggable', 'true')
    })

    it('reduces opacity when dragging', () => {
      const { container } = render(<Tab {...defaultProps} />)
      const button = container.querySelector('button')!

      fireEvent.dragStart(button, { dataTransfer: mockDataTransfer })

      expect(button.className).toContain('opacity-50')
    })

    it('restores opacity on drag end', () => {
      const { container } = render(<Tab {...defaultProps} />)
      const button = container.querySelector('button')!

      fireEvent.dragStart(button, { dataTransfer: mockDataTransfer })
      expect(button.className).toContain('opacity-50')

      fireEvent.dragEnd(button)
      expect(button.className).not.toContain('opacity-50')
    })

    it('stores index in dataTransfer on drag start', () => {
      const setData = vi.fn()
      const { container } = render(<Tab {...defaultProps} index={2} />)
      const button = container.querySelector('button')!

      fireEvent.dragStart(button, {
        dataTransfer: { ...mockDataTransfer, setData },
      })

      expect(setData).toHaveBeenCalledWith('text/plain', '2')
    })

    it('shows drop indicator on drag over', () => {
      const { container } = render(<Tab {...defaultProps} />)
      const button = container.querySelector('button')!

      fireEvent.dragOver(button, { dataTransfer: mockDataTransfer })

      const indicator = container.querySelector('.bg-obsidian-accent')
      expect(indicator).toBeInTheDocument()
    })

    it('clears drop indicator on drag leave', () => {
      const { container } = render(<Tab {...defaultProps} />)
      const button = container.querySelector('button')!

      fireEvent.dragOver(button, { dataTransfer: mockDataTransfer })
      expect(container.querySelector('.bg-obsidian-accent')).toBeInTheDocument()

      fireEvent.dragLeave(button)
      expect(container.querySelector('.bg-obsidian-accent')).not.toBeInTheDocument()
    })

    it('calls onReorder on drop — dragging forward', () => {
      const onReorder = vi.fn()
      const { container } = render(<Tab {...defaultProps} index={2} onReorder={onReorder} />)
      const button = container.querySelector('button')!

      // Drop from index 0 onto index 2
      fireEvent.drop(button, {
        dataTransfer: { ...mockDataTransfer, getData: () => '0' },
      })

      expect(onReorder).toHaveBeenCalledWith(0, 2)
    })

    it('calls onReorder on drop — dragging backward', () => {
      const onReorder = vi.fn()
      const { container } = render(<Tab {...defaultProps} index={0} onReorder={onReorder} />)
      const button = container.querySelector('button')!

      // Drop from index 2 onto index 0
      fireEvent.drop(button, {
        dataTransfer: { ...mockDataTransfer, getData: () => '2' },
      })

      // jsdom returns zero-sized rects so position resolves to "after" → index + 1
      expect(onReorder).toHaveBeenCalledWith(2, 1)
    })

    it('does not call onReorder when dropping on self', () => {
      const onReorder = vi.fn()
      const { container } = render(<Tab {...defaultProps} index={1} onReorder={onReorder} />)
      const button = container.querySelector('button')!

      fireEvent.drop(button, {
        dataTransfer: { ...mockDataTransfer, getData: () => '1' },
      })

      expect(onReorder).not.toHaveBeenCalled()
    })

    it('does not call onReorder when onReorder prop is not provided', () => {
      const { container } = render(<Tab {...defaultProps} index={0} />)
      const button = container.querySelector('button')!

      // Should not throw
      fireEvent.drop(button, {
        dataTransfer: { ...mockDataTransfer, getData: () => '2' },
      })
    })

    it('shows drop indicator in vertical mode', () => {
      const { container } = render(<Tab {...defaultProps} vertical />)
      const button = container.querySelector('button')!

      fireEvent.dragOver(button, { dataTransfer: mockDataTransfer })

      const indicator = container.querySelector('.bg-obsidian-accent')
      expect(indicator).toBeInTheDocument()
    })
  })

  describe('vertical mode', () => {
    it('uses full width and rounded-l-lg styling', () => {
      const { container } = render(<Tab {...defaultProps} vertical />)

      const button = container.querySelector('button')!
      expect(button.className).toContain('w-full')
      expect(button.className).toContain('rounded-l-lg')
      expect(button.className).not.toContain('rounded-t-lg')
    })

    it('does not apply animation delay', () => {
      const { container } = render(<Tab {...defaultProps} vertical index={2} />)

      const button = container.querySelector('button')!
      expect(button.style.animationDelay).toBe('')
    })

    it('shows left accent line when active', () => {
      const { container } = render(<Tab {...defaultProps} vertical isActive />)

      const accentLine = container.querySelector('.bg-gradient-to-b')
      expect(accentLine).toBeInTheDocument()
    })
  })
})
