import { memo } from 'react'
import { ChangedFile } from '@shared/types'
import { FileListItem } from './FileListItem'
import catjamGif from '../../../../assets/catjam.gif'

interface FileListProps {
  files: ChangedFile[]
  selectedFile: string | null
  onSelectFile: (path: string) => void
  isLoading: boolean
  isCollapsed?: boolean
}

export const FileList = memo(function FileList({
  files,
  selectedFile,
  onSelectFile,
  isLoading,
  isCollapsed,
}: FileListProps) {
  if (isLoading && files.length === 0) {
    return (
      <div className="p-4 flex flex-col gap-2">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse flex items-center gap-3"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="w-5 h-5 rounded bg-obsidian-float" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-obsidian-float rounded w-3/4" />
              <div className="h-2 bg-obsidian-float/50 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="p-6 text-center">
        <img
          src={catjamGif}
          alt="Catjam"
          className="w-12 h-12 mx-auto mb-3"
        />
        <p className="text-xs text-obsidian-text-muted">No changes detected</p>
        <p className="text-2xs text-obsidian-text-ghost mt-1">Working tree is clean</p>
      </div>
    )
  }

  return (
    <div className="py-1">
      {files.map((file, index) => (
        <FileListItem
          key={file.path}
          file={file}
          isSelected={file.path === selectedFile}
          onSelect={onSelectFile}
          index={index}
          isCollapsed={isCollapsed}
        />
      ))}
    </div>
  )
})
