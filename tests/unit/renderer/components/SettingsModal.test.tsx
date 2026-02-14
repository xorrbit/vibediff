import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SettingsModal } from '@renderer/components/common/SettingsModal'

describe('SettingsModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    uiScale: 1.0,
    onUiScaleChange: vi.fn(),
    diffViewMode: 'unified' as const,
    onDiffViewModeChange: vi.fn(),
    wordWrap: false,
    onWordWrapChange: vi.fn(),
    tabPosition: 'top' as const,
    onTabPositionChange: vi.fn(),
    automationEnabled: false,
    onAutomationToggle: vi.fn().mockResolvedValue(undefined),
  }

  describe('Rendering', () => {
    it('returns null when isOpen is false', () => {
      const { container } = render(<SettingsModal {...defaultProps} isOpen={false} />)
      expect(container.innerHTML).toBe('')
    })

    it('renders modal content when isOpen is true', () => {
      render(<SettingsModal {...defaultProps} />)
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('displays "Settings" heading', () => {
      render(<SettingsModal {...defaultProps} />)
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('displays current scale as percentage', () => {
      render(<SettingsModal {...defaultProps} uiScale={1.0} />)
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('displays current scale as percentage for non-default value', () => {
      render(<SettingsModal {...defaultProps} uiScale={0.85} />)
      expect(screen.getByText('85%')).toBeInTheDocument()
    })

    it('shows "Reset to 100%" button when scale is not 1.0', () => {
      render(<SettingsModal {...defaultProps} uiScale={0.9} />)
      expect(screen.getByText('Reset to 100%')).toBeInTheDocument()
    })

    it('hides "Reset to 100%" button when scale is exactly 1.0', () => {
      render(<SettingsModal {...defaultProps} uiScale={1.0} />)
      expect(screen.queryByText('Reset to 100%')).not.toBeInTheDocument()
    })

    it('displays "Automation API" label', () => {
      render(<SettingsModal {...defaultProps} />)
      expect(screen.getByText('Automation API')).toBeInTheDocument()
    })
  })

  describe('UI Scale controls', () => {
    it('clicking decrease button calls onUiScaleChange with scale - 0.05', () => {
      const onUiScaleChange = vi.fn()
      render(<SettingsModal {...defaultProps} uiScale={1.0} onUiScaleChange={onUiScaleChange} />)

      fireEvent.click(screen.getByTitle('Decrease font size'))

      expect(onUiScaleChange).toHaveBeenCalledWith(0.95)
    })

    it('clicking increase button calls onUiScaleChange with scale + 0.05', () => {
      const onUiScaleChange = vi.fn()
      render(<SettingsModal {...defaultProps} uiScale={1.0} onUiScaleChange={onUiScaleChange} />)

      fireEvent.click(screen.getByTitle('Increase font size'))

      expect(onUiScaleChange).toHaveBeenCalledWith(1.05)
    })

    it('decrease button is disabled at minimum scale (0.75)', () => {
      render(<SettingsModal {...defaultProps} uiScale={0.75} />)
      expect(screen.getByTitle('Decrease font size')).toBeDisabled()
    })

    it('increase button is disabled at maximum scale (1.5)', () => {
      render(<SettingsModal {...defaultProps} uiScale={1.5} />)
      expect(screen.getByTitle('Increase font size')).toBeDisabled()
    })

    it('decrease clamps to SCALE_MIN', () => {
      const onUiScaleChange = vi.fn()
      render(<SettingsModal {...defaultProps} uiScale={0.77} onUiScaleChange={onUiScaleChange} />)

      fireEvent.click(screen.getByTitle('Decrease font size'))

      expect(onUiScaleChange).toHaveBeenCalledWith(0.75)
    })

    it('increase clamps to SCALE_MAX', () => {
      const onUiScaleChange = vi.fn()
      render(<SettingsModal {...defaultProps} uiScale={1.48} onUiScaleChange={onUiScaleChange} />)

      fireEvent.click(screen.getByTitle('Increase font size'))

      expect(onUiScaleChange).toHaveBeenCalledWith(1.5)
    })

    it('clicking "Reset to 100%" calls onUiScaleChange(1.0)', () => {
      const onUiScaleChange = vi.fn()
      render(<SettingsModal {...defaultProps} uiScale={0.85} onUiScaleChange={onUiScaleChange} />)

      fireEvent.click(screen.getByText('Reset to 100%'))

      expect(onUiScaleChange).toHaveBeenCalledWith(1.0)
    })
  })

  describe('Diff view mode selector', () => {
    it('displays "Default Diff View" label', () => {
      render(<SettingsModal {...defaultProps} />)
      expect(screen.getByText('Default Diff View')).toBeInTheDocument()
    })

    it('highlights the current mode (unified)', () => {
      render(<SettingsModal {...defaultProps} diffViewMode="unified" />)
      const unifiedButton = screen.getByTitle('Set diff view to Unified')
      expect(unifiedButton.className).toContain('bg-obsidian-accent')
    })

    it('highlights the current mode (split)', () => {
      render(<SettingsModal {...defaultProps} diffViewMode="split" />)
      const splitButton = screen.getByTitle('Set diff view to Split')
      expect(splitButton.className).toContain('bg-obsidian-accent')
    })

    it('highlights the current mode (auto)', () => {
      render(<SettingsModal {...defaultProps} diffViewMode="auto" />)
      const autoButton = screen.getByTitle('Set diff view to Auto')
      expect(autoButton.className).toContain('bg-obsidian-accent')
    })

    it('clicking Unified calls onDiffViewModeChange("unified")', () => {
      const onDiffViewModeChange = vi.fn()
      render(<SettingsModal {...defaultProps} diffViewMode="split" onDiffViewModeChange={onDiffViewModeChange} />)

      fireEvent.click(screen.getByTitle('Set diff view to Unified'))

      expect(onDiffViewModeChange).toHaveBeenCalledWith('unified')
    })

    it('clicking Split calls onDiffViewModeChange("split")', () => {
      const onDiffViewModeChange = vi.fn()
      render(<SettingsModal {...defaultProps} diffViewMode="unified" onDiffViewModeChange={onDiffViewModeChange} />)

      fireEvent.click(screen.getByTitle('Set diff view to Split'))

      expect(onDiffViewModeChange).toHaveBeenCalledWith('split')
    })

    it('clicking Auto calls onDiffViewModeChange("auto")', () => {
      const onDiffViewModeChange = vi.fn()
      render(<SettingsModal {...defaultProps} diffViewMode="unified" onDiffViewModeChange={onDiffViewModeChange} />)

      fireEvent.click(screen.getByTitle('Set diff view to Auto'))

      expect(onDiffViewModeChange).toHaveBeenCalledWith('auto')
    })
  })

  describe('Tab position selector', () => {
    it('displays "Tab Position" label', () => {
      render(<SettingsModal {...defaultProps} />)
      expect(screen.getByText('Tab Position')).toBeInTheDocument()
    })

    it('highlights the current position (top)', () => {
      render(<SettingsModal {...defaultProps} tabPosition="top" />)
      const topButton = screen.getByTitle('Place tabs at the top')
      expect(topButton.className).toContain('bg-obsidian-accent')
    })

    it('highlights the current position (left)', () => {
      render(<SettingsModal {...defaultProps} tabPosition="left" />)
      const leftButton = screen.getByTitle('Place tabs at the left')
      expect(leftButton.className).toContain('bg-obsidian-accent')
    })

    it('clicking Left calls onTabPositionChange("left")', () => {
      const onTabPositionChange = vi.fn()
      render(<SettingsModal {...defaultProps} tabPosition="top" onTabPositionChange={onTabPositionChange} />)

      fireEvent.click(screen.getByTitle('Place tabs at the left'))

      expect(onTabPositionChange).toHaveBeenCalledWith('left')
    })

    it('clicking Top calls onTabPositionChange("top")', () => {
      const onTabPositionChange = vi.fn()
      render(<SettingsModal {...defaultProps} tabPosition="left" onTabPositionChange={onTabPositionChange} />)

      fireEvent.click(screen.getByTitle('Place tabs at the top'))

      expect(onTabPositionChange).toHaveBeenCalledWith('top')
    })
  })

  describe('Word wrap selector', () => {
    it('displays "Word Wrap" label', () => {
      render(<SettingsModal {...defaultProps} />)
      expect(screen.getByText('Word Wrap')).toBeInTheDocument()
    })

    it('highlights Off when wordWrap is false', () => {
      render(<SettingsModal {...defaultProps} wordWrap={false} />)
      const offButton = screen.getByTitle('Disable word wrap')
      expect(offButton.className).toContain('bg-obsidian-accent')
    })

    it('highlights On when wordWrap is true', () => {
      render(<SettingsModal {...defaultProps} wordWrap={true} />)
      const onButton = screen.getByTitle('Enable word wrap')
      expect(onButton.className).toContain('bg-obsidian-accent')
    })

    it('clicking On calls onWordWrapChange(true)', () => {
      const onWordWrapChange = vi.fn()
      render(<SettingsModal {...defaultProps} wordWrap={false} onWordWrapChange={onWordWrapChange} />)

      fireEvent.click(screen.getByTitle('Enable word wrap'))

      expect(onWordWrapChange).toHaveBeenCalledWith(true)
    })

    it('clicking Off calls onWordWrapChange(false)', () => {
      const onWordWrapChange = vi.fn()
      render(<SettingsModal {...defaultProps} wordWrap={true} onWordWrapChange={onWordWrapChange} />)

      fireEvent.click(screen.getByTitle('Disable word wrap'))

      expect(onWordWrapChange).toHaveBeenCalledWith(false)
    })
  })

  describe('Close behavior', () => {
    it('clicking the close (X) button calls onClose', () => {
      const onClose = vi.fn()
      render(<SettingsModal {...defaultProps} onClose={onClose} />)

      // The close button is the last button in the header area
      const closeButtons = screen.getAllByRole('button')
      // Find the close button by its position near the Settings heading
      const header = screen.getByText('Settings').closest('div[class*="flex items-center justify-between"]')!
      const closeButton = header.querySelector('button')!
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('clicking the backdrop calls onClose', () => {
      const onClose = vi.fn()
      render(<SettingsModal {...defaultProps} onClose={onClose} />)

      const backdrop = screen.getByText('Settings').closest('.fixed')!
      fireEvent.click(backdrop)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('clicking inside the modal body does NOT call onClose', () => {
      const onClose = vi.fn()
      render(<SettingsModal {...defaultProps} onClose={onClose} />)

      fireEvent.click(screen.getByText('Settings'))

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('Automation API toggle — disabling (no confirmation)', () => {
    it('when enabled, clicking toggle immediately calls onAutomationToggle(false)', () => {
      const onAutomationToggle = vi.fn().mockResolvedValue(undefined)
      render(<SettingsModal {...defaultProps} automationEnabled={true} onAutomationToggle={onAutomationToggle} />)

      fireEvent.click(screen.getByTitle('Disable automation API'))

      expect(onAutomationToggle).toHaveBeenCalledWith(false)
    })

    it('no confirmation warning is shown when disabling', () => {
      render(<SettingsModal {...defaultProps} automationEnabled={true} />)

      fireEvent.click(screen.getByTitle('Disable automation API'))

      expect(screen.queryByText('Enable')).not.toBeInTheDocument()
    })

    it('toggle button is disabled while onAutomationToggle promise is pending', async () => {
      let resolveToggle: () => void
      const onAutomationToggle = vi.fn().mockReturnValue(new Promise<void>((r) => { resolveToggle = r }))
      render(<SettingsModal {...defaultProps} automationEnabled={true} onAutomationToggle={onAutomationToggle} />)

      fireEvent.click(screen.getByTitle('Disable automation API'))

      expect(screen.getByTitle('Disable automation API')).toBeDisabled()

      await act(async () => { resolveToggle!() })
    })
  })

  describe('Automation API toggle — enabling (with confirmation)', () => {
    it('when disabled, clicking toggle shows the confirmation warning', () => {
      render(<SettingsModal {...defaultProps} automationEnabled={false} />)

      fireEvent.click(screen.getByTitle('Enable automation API'))

      expect(screen.getByText('Enable')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('clicking "Cancel" hides the confirmation without calling onAutomationToggle', () => {
      const onAutomationToggle = vi.fn().mockResolvedValue(undefined)
      render(<SettingsModal {...defaultProps} automationEnabled={false} onAutomationToggle={onAutomationToggle} />)

      fireEvent.click(screen.getByTitle('Enable automation API'))
      fireEvent.click(screen.getByText('Cancel'))

      expect(onAutomationToggle).not.toHaveBeenCalled()
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
    })

    it('clicking "Enable" calls onAutomationToggle(true) and hides the warning', async () => {
      const onAutomationToggle = vi.fn().mockResolvedValue(undefined)
      render(<SettingsModal {...defaultProps} automationEnabled={false} onAutomationToggle={onAutomationToggle} />)

      fireEvent.click(screen.getByTitle('Enable automation API'))
      await act(async () => {
        fireEvent.click(screen.getByText('Enable'))
      })

      expect(onAutomationToggle).toHaveBeenCalledWith(true)
    })

    it('toggle button is disabled while onAutomationToggle promise is pending after confirming', async () => {
      let resolveToggle: () => void
      const onAutomationToggle = vi.fn().mockReturnValue(new Promise<void>((r) => { resolveToggle = r }))
      render(<SettingsModal {...defaultProps} automationEnabled={false} onAutomationToggle={onAutomationToggle} />)

      fireEvent.click(screen.getByTitle('Enable automation API'))
      await act(async () => {
        fireEvent.click(screen.getByText('Enable'))
      })

      expect(screen.getByTitle('Enable automation API')).toBeDisabled()

      await act(async () => { resolveToggle!() })
    })
  })

  describe('Automation API toggle — title attribute', () => {
    it('shows title "Disable automation API" when enabled', () => {
      render(<SettingsModal {...defaultProps} automationEnabled={true} />)
      expect(screen.getByTitle('Disable automation API')).toBeInTheDocument()
    })

    it('shows title "Enable automation API" when disabled', () => {
      render(<SettingsModal {...defaultProps} automationEnabled={false} />)
      expect(screen.getByTitle('Enable automation API')).toBeInTheDocument()
    })
  })
})
