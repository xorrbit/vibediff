import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TabBar } from '@renderer/components/layout/TabBar'
import { Session } from '@shared/types'

const mockSessions: Session[] = [
  { id: '1', cwd: '/home/user/project1', name: 'project1' },
  { id: '2', cwd: '/home/user/project2', name: 'project2' },
  { id: '3', cwd: '/home/user/project3', name: 'project3' },
]

describe('TabBar', () => {
  it('renders correct number of tabs', () => {
    render(
      <TabBar
        sessions={mockSessions}
        activeSessionId="1"
        waitingSessionIds={new Set()}
        onTabSelect={vi.fn()}
        onTabClose={vi.fn()}
        onNewTab={vi.fn()}
      />
    )

    expect(screen.getByText('project1')).toBeInTheDocument()
    expect(screen.getByText('project2')).toBeInTheDocument()
    expect(screen.getByText('project3')).toBeInTheDocument()
  })

  it('calls onTabSelect when tab clicked', () => {
    const onTabSelect = vi.fn()

    render(
      <TabBar
        sessions={mockSessions}
        activeSessionId="1"
        waitingSessionIds={new Set()}
        onTabSelect={onTabSelect}
        onTabClose={vi.fn()}
        onNewTab={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('project2'))
    expect(onTabSelect).toHaveBeenCalledWith('2')
  })

  it('calls onTabClose when close button clicked', () => {
    const onTabClose = vi.fn()

    render(
      <TabBar
        sessions={mockSessions}
        activeSessionId="1"
        waitingSessionIds={new Set()}
        onTabSelect={vi.fn()}
        onTabClose={onTabClose}
        onNewTab={vi.fn()}
      />
    )

    // Hover over the first tab to show the close button
    const tab = screen.getByText('project1').closest('button')!
    fireEvent.mouseEnter(tab)

    // Find and click the close button (X icon)
    const closeButtons = tab.querySelectorAll('[role="none"], span')
    const closeButton = Array.from(closeButtons).find((el) =>
      el.querySelector('svg')
    )!
    fireEvent.click(closeButton)

    expect(onTabClose).toHaveBeenCalledWith('1')
  })

  it('calls onNewTab when empty space double-clicked', () => {
    const onNewTab = vi.fn()

    render(
      <TabBar
        sessions={mockSessions}
        activeSessionId="1"
        waitingSessionIds={new Set()}
        onTabSelect={vi.fn()}
        onTabClose={vi.fn()}
        onNewTab={onNewTab}
      />
    )

    const emptySpace = screen.getByTestId('tabbar-empty-space')
    fireEvent.doubleClick(emptySpace)

    expect(onNewTab).toHaveBeenCalled()
  })

  it('moves window when empty area is click-dragged', async () => {
    render(
      <TabBar
        sessions={mockSessions}
        activeSessionId="1"
        waitingSessionIds={new Set()}
        onTabSelect={vi.fn()}
        onTabClose={vi.fn()}
        onNewTab={vi.fn()}
      />
    )

    const emptySpace = screen.getByTestId('tabbar-empty-space')

    fireEvent.mouseDown(emptySpace, { button: 0, screenX: 200, screenY: 300 })
    await waitFor(() => {
      expect(window.electronAPI.window.getPosition).toHaveBeenCalled()
    })

    fireEvent.mouseMove(window, { screenX: 225, screenY: 340 })

    await waitFor(() => {
      expect(window.electronAPI.window.setPosition).toHaveBeenCalledWith(125, 140)
    })
  })

  it('shows active tab styling', () => {
    const { rerender } = render(
      <TabBar
        sessions={mockSessions}
        activeSessionId="2"
        waitingSessionIds={new Set()}
        onTabSelect={vi.fn()}
        onTabClose={vi.fn()}
        onNewTab={vi.fn()}
      />
    )

    const activeTab = screen.getByText('project2').closest('button')!
    expect(activeTab.className).toContain('bg-obsidian-bg')
    expect(activeTab.className).toContain('text-obsidian-text')

    const inactiveTab = screen.getByText('project1').closest('button')!
    expect(inactiveTab.className).toContain('text-obsidian-text-muted')
  })

  it('renders empty state with no tabs', () => {
    const { container } = render(
      <TabBar
        sessions={[]}
        activeSessionId={null}
        waitingSessionIds={new Set()}
        onTabSelect={vi.fn()}
        onTabClose={vi.fn()}
        onNewTab={vi.fn()}
      />
    )

    // Should still have the empty space for double-click to create new tab
    const emptySpace = container.querySelector('.flex-1.min-w-\\[40px\\]')
    expect(emptySpace).toBeInTheDocument()
  })

  it('shows full path in tab tooltip', () => {
    render(
      <TabBar
        sessions={mockSessions}
        activeSessionId="1"
        waitingSessionIds={new Set()}
        onTabSelect={vi.fn()}
        onTabClose={vi.fn()}
        onNewTab={vi.fn()}
      />
    )

    const tab = screen.getByText('project1').closest('button')!
    expect(tab).toHaveAttribute('title', '/home/user/project1')
  })

  it('converts vertical mouse wheel to horizontal scroll on tabs container', () => {
    render(
      <TabBar
        sessions={mockSessions}
        activeSessionId="1"
        waitingSessionIds={new Set()}
        onTabSelect={vi.fn()}
        onTabClose={vi.fn()}
        onNewTab={vi.fn()}
      />
    )

    const tabsContainer = screen.getByTestId('tabbar-empty-space').parentElement!
    tabsContainer.scrollLeft = 0

    fireEvent.wheel(tabsContainer, { deltaY: 50 })

    expect(tabsContainer.scrollLeft).toBe(50)
  })

  it('handles many tabs without breaking', () => {
    const manySessions: Session[] = Array.from({ length: 20 }, (_, i) => ({
      id: `session-${i}`,
      cwd: `/home/user/project${i}`,
      name: `project${i}`,
    }))

    render(
      <TabBar
        sessions={manySessions}
        activeSessionId="session-0"
        waitingSessionIds={new Set()}
        onTabSelect={vi.fn()}
        onTabClose={vi.fn()}
        onNewTab={vi.fn()}
      />
    )

    // All tabs should be rendered
    expect(screen.getByText('project0')).toBeInTheDocument()
    expect(screen.getByText('project19')).toBeInTheDocument()
  })

  it('shows waiting indicator for non-active tabs in waitingSessionIds', () => {
    const { container } = render(
      <TabBar
        sessions={mockSessions}
        activeSessionId="1"
        waitingSessionIds={new Set(['2'])}
        onTabSelect={vi.fn()}
        onTabClose={vi.fn()}
        onNewTab={vi.fn()}
      />
    )

    const waitingDot = container.querySelector('.animate-tab-waiting')
    expect(waitingDot).toBeInTheDocument()
  })
})
