import { app } from 'electron'
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'

/**
 * Validate that an IPC message comes from a trusted origin.
 *
 * Accepts:
 *   - file:// URLs (packaged app loads renderer from local files)
 *   - The Vite dev server origin when running in dev mode
 *
 * Rejects everything else to prevent untrusted content (e.g. from a
 * navigation bypass or renderer compromise) from invoking privileged
 * IPC handlers.
 */
export function validateIpcSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  try {
    const url = event.senderFrame.url

    // Packaged and dev builds both serve renderer content from file://
    if (url.startsWith('file://')) return true

    // In dev mode, also allow the Vite dev server origin
    if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
      const devOrigin = new URL(process.env.VITE_DEV_SERVER_URL).origin
      const senderOrigin = new URL(url).origin
      return senderOrigin === devOrigin
    }

    return false
  } catch {
    // senderFrame destroyed, URL parsing failed, etc. — reject
    return false
  }
}
