import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GIT_CHANNELS } from '@shared/types'

const {
  mockValidateIpcSender,
  mockGetCurrentBranch,
  mockGetMainBranch,
  mockGetChangedFiles,
  mockGetFileDiff,
  mockGetFileContent,
  mockFindGitRoot,
} = vi.hoisted(() => ({
  mockValidateIpcSender: vi.fn(() => true),
  mockGetCurrentBranch: vi.fn(),
  mockGetMainBranch: vi.fn(),
  mockGetChangedFiles: vi.fn(),
  mockGetFileDiff: vi.fn(),
  mockGetFileContent: vi.fn(),
  mockFindGitRoot: vi.fn(),
}))

vi.mock('@main/security/validate-sender', () => ({
  validateIpcSender: mockValidateIpcSender,
}))

vi.mock('@main/services/git', () => ({
  GitService: vi.fn(function MockGitService(this: any) {
    this.getCurrentBranch = mockGetCurrentBranch
    this.getMainBranch = mockGetMainBranch
    this.getChangedFiles = mockGetChangedFiles
    this.getFileDiff = mockGetFileDiff
    this.getFileContent = mockGetFileContent
    this.findGitRoot = mockFindGitRoot
  }),
}))

import { registerGitHandlers } from '@main/ipc/git'

function createIpcMainMock() {
  const handles = new Map<string, (...args: any[]) => any>()
  return {
    handles,
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
        handles.set(channel, handler)
      }),
    } as any,
  }
}

describe('registerGitHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateIpcSender.mockReturnValue(true)
  })

  it('rejects unauthorized senders on every git channel', async () => {
    const { ipcMain, handles } = createIpcMainMock()
    registerGitHandlers(ipcMain)
    mockValidateIpcSender.mockReturnValue(false)

    for (const channel of Object.values(GIT_CHANNELS)) {
      const handler = handles.get(channel)!
      if (channel === GIT_CHANNELS.FIND_GIT_ROOT) {
        expect(() => handler({ sender: {} }, '/repo')).toThrow('Unauthorized IPC sender')
      } else {
        await expect(handler({ sender: {} }, '/repo')).rejects.toThrow('Unauthorized IPC sender')
      }
    }
  })

  it('rejects malformed params and does not call service methods', async () => {
    const { ipcMain, handles } = createIpcMainMock()
    registerGitHandlers(ipcMain)

    await expect(handles.get(GIT_CHANNELS.GET_CURRENT_BRANCH)!({ sender: {} }, '')).rejects.toThrow()
    await expect(
      handles.get(GIT_CHANNELS.GET_CHANGED_FILES)!({ sender: {} }, '/repo', 123)
    ).rejects.toThrow()
    await expect(
      handles.get(GIT_CHANNELS.GET_FILE_DIFF)!({ sender: {} }, '/repo', '')
    ).rejects.toThrow()

    expect(mockGetCurrentBranch).not.toHaveBeenCalled()
    expect(mockGetChangedFiles).not.toHaveBeenCalled()
    expect(mockGetFileDiff).not.toHaveBeenCalled()
  })

  it('routes valid requests to the matching GitService methods', async () => {
    const { ipcMain, handles } = createIpcMainMock()
    registerGitHandlers(ipcMain)

    mockGetCurrentBranch.mockResolvedValue('main')
    mockGetMainBranch.mockResolvedValue('main')
    mockGetChangedFiles.mockResolvedValue([{ path: 'a.ts', status: 'M' }])
    mockGetFileDiff.mockResolvedValue({ original: 'a', modified: 'b' })
    mockGetFileContent.mockResolvedValue('file-content')
    mockFindGitRoot.mockResolvedValue('/repo')

    await handles.get(GIT_CHANNELS.GET_CURRENT_BRANCH)!({ sender: {} }, '/repo')
    await handles.get(GIT_CHANNELS.GET_MAIN_BRANCH)!({ sender: {} }, '/repo')
    await handles.get(GIT_CHANNELS.GET_CHANGED_FILES)!({ sender: {} }, '/repo', 'main')
    await handles.get(GIT_CHANNELS.GET_FILE_DIFF)!({ sender: {} }, '/repo', 'a.ts', 'main')
    await handles.get(GIT_CHANNELS.GET_FILE_CONTENT)!({ sender: {} }, '/repo', 'a.ts', 'HEAD~1')
    await handles.get(GIT_CHANNELS.FIND_GIT_ROOT)!({ sender: {} }, '/repo/subdir')

    expect(mockGetCurrentBranch).toHaveBeenCalledWith('/repo')
    expect(mockGetMainBranch).toHaveBeenCalledWith('/repo')
    expect(mockGetChangedFiles).toHaveBeenCalledWith('/repo', 'main')
    expect(mockGetFileDiff).toHaveBeenCalledWith('/repo', 'a.ts', 'main')
    expect(mockGetFileContent).toHaveBeenCalledWith('/repo', 'a.ts', 'HEAD~1')
    expect(mockFindGitRoot).toHaveBeenCalledWith('/repo/subdir')
  })
})
