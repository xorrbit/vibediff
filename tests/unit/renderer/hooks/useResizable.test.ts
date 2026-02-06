import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResizable } from '@renderer/hooks/useResizable'

describe('useResizable', () => {
  beforeEach(() => {
    // Clean up body classes
    document.body.classList.remove('resizing')
  })

  it('returns correct initial ratio (default 0.6)', () => {
    const { result } = renderHook(() => useResizable())
    expect(result.current.ratio).toBe(0.6)
    expect(result.current.isDragging).toBe(false)
  })

  it('returns custom initial ratio when provided', () => {
    const { result } = renderHook(() => useResizable({ initialRatio: 0.5 }))
    expect(result.current.ratio).toBe(0.5)
  })

  it('starts dragging on mousedown', () => {
    const { result } = renderHook(() => useResizable())

    const mockEvent = {
      preventDefault: () => {},
      currentTarget: {
        parentElement: document.createElement('div'),
      },
    } as unknown as React.MouseEvent

    act(() => {
      result.current.handleMouseDown(mockEvent)
    })

    expect(result.current.isDragging).toBe(true)
    expect(document.body.classList.contains('resizing')).toBe(true)
  })

  it('stops dragging on mouseup', () => {
    const { result } = renderHook(() => useResizable())

    const mockEvent = {
      preventDefault: () => {},
      currentTarget: {
        parentElement: document.createElement('div'),
      },
    } as unknown as React.MouseEvent

    act(() => {
      result.current.handleMouseDown(mockEvent)
    })

    expect(result.current.isDragging).toBe(true)

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup'))
    })

    expect(result.current.isDragging).toBe(false)
    expect(document.body.classList.contains('resizing')).toBe(false)
  })

  it('updates ratio on mousemove while dragging', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 1000 }),
    })
    document.body.appendChild(container)

    const { result } = renderHook(() => useResizable({ minRatio: 0.2, maxRatio: 0.8 }))

    const mockEvent = {
      preventDefault: () => {},
      currentTarget: {
        parentElement: container,
      },
    } as unknown as React.MouseEvent

    act(() => {
      result.current.handleMouseDown(mockEvent)
    })

    // Move mouse to 500px (50% of 1000px width)
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 500 }))
    })

    expect(result.current.ratio).toBe(0.5)

    document.body.removeChild(container)
  })

  it('enforces minimum ratio constraint', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 1000 }),
    })
    document.body.appendChild(container)

    const { result } = renderHook(() => useResizable({ minRatio: 0.3, maxRatio: 0.8 }))

    const mockEvent = {
      preventDefault: () => {},
      currentTarget: {
        parentElement: container,
      },
    } as unknown as React.MouseEvent

    act(() => {
      result.current.handleMouseDown(mockEvent)
    })

    // Move mouse to 100px (10% of 1000px width, below min of 30%)
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 }))
    })

    expect(result.current.ratio).toBe(0.3) // Should clamp to minimum

    document.body.removeChild(container)
  })

  it('enforces maximum ratio constraint', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 1000 }),
    })
    document.body.appendChild(container)

    const { result } = renderHook(() => useResizable({ minRatio: 0.2, maxRatio: 0.7 }))

    const mockEvent = {
      preventDefault: () => {},
      currentTarget: {
        parentElement: container,
      },
    } as unknown as React.MouseEvent

    act(() => {
      result.current.handleMouseDown(mockEvent)
    })

    // Move mouse to 900px (90% of 1000px width, above max of 70%)
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 900 }))
    })

    expect(result.current.ratio).toBe(0.7) // Should clamp to maximum

    document.body.removeChild(container)
  })

  it('handles edge case: drag outside bounds', async () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ left: 100, width: 500 }),
    })
    document.body.appendChild(container)

    const { result } = renderHook(() => useResizable({ minRatio: 0.2, maxRatio: 0.8 }))

    const mockEvent = {
      preventDefault: () => {},
      currentTarget: {
        parentElement: container,
      },
    } as unknown as React.MouseEvent

    act(() => {
      result.current.handleMouseDown(mockEvent)
    })

    // Move mouse beyond left edge (negative ratio)
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0 }))
    })

    expect(result.current.ratio).toBe(0.2) // Should clamp to minimum

    // Move mouse beyond right edge
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 700 }))
    })

    // Second move may be frame-coalesced by rAF throttling
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    })

    expect(result.current.ratio).toBe(0.8) // Should clamp to maximum

    document.body.removeChild(container)
  })

  describe('pixel mode', () => {
    it('returns correct initial width (default 250)', () => {
      const { result } = renderHook(() => useResizable({ mode: 'pixel' }))
      expect(result.current.width).toBe(250)
      expect(result.current.isDragging).toBe(false)
    })

    it('returns custom initial width when provided', () => {
      const { result } = renderHook(() => useResizable({ mode: 'pixel', initialWidth: 300 }))
      expect(result.current.width).toBe(300)
    })

    it('updates width in pixels on mousemove while dragging', () => {
      const container = document.createElement('div')
      Object.defineProperty(container, 'getBoundingClientRect', {
        value: () => ({ left: 0, width: 1000 }),
      })
      document.body.appendChild(container)

      const { result } = renderHook(() => useResizable({ mode: 'pixel', minWidth: 120, maxWidth: 400 }))

      const mockEvent = {
        preventDefault: () => {},
        currentTarget: {
          parentElement: container,
        },
      } as unknown as React.MouseEvent

      act(() => {
        result.current.handleMouseDown(mockEvent)
      })

      // Move mouse to 200px
      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200 }))
      })

      expect(result.current.width).toBe(200)

      document.body.removeChild(container)
    })

    it('enforces minimum width constraint', () => {
      const container = document.createElement('div')
      Object.defineProperty(container, 'getBoundingClientRect', {
        value: () => ({ left: 0, width: 1000 }),
      })
      document.body.appendChild(container)

      const { result } = renderHook(() => useResizable({ mode: 'pixel', minWidth: 150, maxWidth: 400 }))

      const mockEvent = {
        preventDefault: () => {},
        currentTarget: {
          parentElement: container,
        },
      } as unknown as React.MouseEvent

      act(() => {
        result.current.handleMouseDown(mockEvent)
      })

      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 50 }))
      })

      expect(result.current.width).toBe(150)

      document.body.removeChild(container)
    })

    it('enforces maximum width constraint', () => {
      const container = document.createElement('div')
      Object.defineProperty(container, 'getBoundingClientRect', {
        value: () => ({ left: 0, width: 1000 }),
      })
      document.body.appendChild(container)

      const { result } = renderHook(() => useResizable({ mode: 'pixel', minWidth: 120, maxWidth: 350 }))

      const mockEvent = {
        preventDefault: () => {},
        currentTarget: {
          parentElement: container,
        },
      } as unknown as React.MouseEvent

      act(() => {
        result.current.handleMouseDown(mockEvent)
      })

      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 500 }))
      })

      expect(result.current.width).toBe(350)

      document.body.removeChild(container)
    })
  })

  it('cleans up event listeners on unmount', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const { result, unmount } = renderHook(() => useResizable())

    const mockEvent = {
      preventDefault: () => {},
      currentTarget: {
        parentElement: container,
      },
    } as unknown as React.MouseEvent

    act(() => {
      result.current.handleMouseDown(mockEvent)
    })

    unmount()

    expect(document.body.classList.contains('resizing')).toBe(false)

    document.body.removeChild(container)
  })
})
