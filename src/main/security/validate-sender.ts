import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import { isTrustedRendererUrl } from './trusted-renderer'

/**
 * Validate that an IPC message comes from a trusted origin.
 *
 * Accepts:
 *   - The packaged renderer entrypoint file URL
 *   - The Vite dev server origin when running in dev mode
 *
 * Rejects everything else to prevent untrusted content (e.g. from a
 * navigation bypass or renderer compromise) from invoking privileged
 * IPC handlers.
 */
export function validateIpcSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  try {
    if (!event.senderFrame) return false

    // Only allow calls from the top-level renderer frame.
    if (event.senderFrame !== event.sender.mainFrame) return false

    const url = event.senderFrame.url
    return isTrustedRendererUrl(url)
  } catch {
    // senderFrame destroyed, URL parsing failed, etc. — reject
    return false
  }
}
