import { useState, useCallback, useRef, useEffect } from 'react'

interface UseResizableRatioOptions {
  mode?: 'ratio'
  initialRatio?: number
  minRatio?: number
  maxRatio?: number
}

interface UseResizablePixelOptions {
  mode: 'pixel'
  initialWidth?: number
  minWidth?: number
  maxWidth?: number
}

type UseResizableOptions = UseResizableRatioOptions | UseResizablePixelOptions

interface UseResizableReturn {
  ratio: number
  width: number
  isDragging: boolean
  handleMouseDown: (e: React.MouseEvent) => void
}

export function useResizable(options: UseResizableOptions = {}): UseResizableReturn {
  const isPixel = options.mode === 'pixel'

  // Extract min/max values once — these don't change during a drag,
  // so we store them in a ref to avoid the effect depending on `options`.
  const boundsRef = useRef({
    minRatio: (options as UseResizableRatioOptions).minRatio ?? 0.2,
    maxRatio: (options as UseResizableRatioOptions).maxRatio ?? 0.8,
    minWidth: (options as UseResizablePixelOptions).minWidth ?? 120,
    maxWidth: (options as UseResizablePixelOptions).maxWidth ?? 500,
  })
  boundsRef.current = {
    minRatio: (options as UseResizableRatioOptions).minRatio ?? 0.2,
    maxRatio: (options as UseResizableRatioOptions).maxRatio ?? 0.8,
    minWidth: (options as UseResizablePixelOptions).minWidth ?? 120,
    maxWidth: (options as UseResizablePixelOptions).maxWidth ?? 500,
  }

  const [ratio, setRatio] = useState(
    isPixel ? 0 : ((options as UseResizableRatioOptions).initialRatio ?? 0.6)
  )
  const [width, setWidth] = useState(
    isPixel ? ((options as UseResizablePixelOptions).initialWidth ?? 250) : 0
  )
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLElement | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    containerRef.current = e.currentTarget.parentElement
    document.body.classList.add('resizing')
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()

      if (isPixel) {
        const { minWidth, maxWidth } = boundsRef.current
        const newWidth = e.clientX - rect.left
        setWidth(Math.min(maxWidth, Math.max(minWidth, newWidth)))
      } else {
        const { minRatio, maxRatio } = boundsRef.current
        const newRatio = (e.clientX - rect.left) / rect.width
        setRatio(Math.min(maxRatio, Math.max(minRatio, newRatio)))
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.body.classList.remove('resizing')
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.classList.remove('resizing')
    }
  }, [isDragging, isPixel])

  return { ratio, width, isDragging, handleMouseDown }
}
