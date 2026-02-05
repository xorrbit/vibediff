import { memo } from 'react'
import { ChangedFile } from '@shared/types'
import { FileListItem } from './FileListItem'

interface FileListProps {
  files: ChangedFile[]
  selectedFile: string | null
  onSelectFile: (path: string) => void
  isLoading: boolean
}

export const FileList = memo(function FileList({
  files,
  selectedFile,
  onSelectFile,
  isLoading,
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
        <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-obsidian-float/50 flex items-center justify-center">
          <svg className="w-5 h-5 text-obsidian-text-ghost" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
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
        />
      ))}
    </div>
  )
})
