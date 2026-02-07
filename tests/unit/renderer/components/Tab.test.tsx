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
})
