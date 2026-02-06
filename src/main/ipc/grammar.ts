import { IpcMain } from 'electron'
import { GRAMMAR_CHANNELS } from '@shared/types'
import { GrammarScanner } from '../services/grammar-scanner'
import { validateIpcSender } from '../security/validate-sender'

const grammarScanner = new GrammarScanner()

export function registerGrammarHandlers(ipcMain: IpcMain) {
  ipcMain.handle(GRAMMAR_CHANNELS.SCAN, async (event) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    return grammarScanner.scan()
  })

  ipcMain.handle(GRAMMAR_CHANNELS.GET_ONIG_WASM, async (event) => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender')
    return grammarScanner.getOnigWasm()
  })
}
