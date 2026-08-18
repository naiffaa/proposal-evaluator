'use client'

import { useRef, useState } from 'react'
import {
  CheckCircle2,
  FileText,
  Trash2,
  UploadCloud,
} from 'lucide-react'

import { cn } from '@/lib/utils'


export interface UploadedFile {
  id: string
  name: string
  size: number
  progress: number

  // Real browser File object.
  // This is what we will send to FastAPI.
  file: File
}


function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`
}


interface UploadDropzoneProps {
  title: string
  description: string
  multiple?: boolean
  files: UploadedFile[]
  onAdd: (files: UploadedFile[]) => void
  onRemove: (id: string) => void
}


export function UploadDropzone({
  title,
  description,
  multiple,
  files,
  onAdd,
  onRemove,
}: UploadDropzoneProps) {
  const inputRef =
    useRef<HTMLInputElement>(null)

  const [dragging, setDragging] =
    useState(false)


  function handleFiles(
    fileList: FileList | null,
  ) {
    if (
      !fileList ||
      fileList.length === 0
    ) {
      return
    }

    const incoming =
      Array.from(fileList).map(
        (file) => ({
          id: `${file.name}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 7)}`,

          name: file.name,

          size: file.size,

          progress: 100,

          // Keep the actual File object
          file,
        }),
      )

    onAdd(
      multiple
        ? incoming
        : incoming.slice(0, 1),
    )

    // Reset input so the same file
    // can be selected again after removal.
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }


  const showDropzone =
    multiple || files.length === 0


  return (
    <div className="flex h-full flex-col">

      {/* ===================================== */}
      {/* DROPZONE */}
      {/* ===================================== */}

      {showDropzone && (
        <button
          type="button"
          onClick={() =>
            inputRef.current?.click()
          }
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() =>
            setDragging(false)
          }
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)

            handleFiles(
              event.dataTransfer.files,
            )
          }}
          className={cn(
            `
              flex
              w-full
              flex-col
              items-center
              justify-center
              rounded-xl
              border-2
              border-dashed
              px-6
              py-10
              text-center
              transition-colors
            `,

            dragging
              ? 'border-primary bg-primary/5'
              : 'border-border bg-muted/40 hover:border-primary/40 hover:bg-muted/70',
          )}
        >

          {/* ICON */}

          <span className="flex size-11 items-center justify-center rounded-full bg-primary/5 text-primary">
            <UploadCloud className="size-5.5" />
          </span>

          {/* TITLE */}

          <p className="mt-3 text-sm font-semibold text-foreground">
            {title}
          </p>

          {/* DESCRIPTION */}

          <p className="mt-1 text-xs text-muted-foreground">
            {description}
          </p>

          {/* BROWSE */}

          <span className="mt-4 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground">
            Browse Files
          </span>

          {/* FILE INPUT */}

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple={multiple}
            className="hidden"
            onChange={(event) =>
              handleFiles(
                event.target.files,
              )
            }
          />

        </button>
      )}

      {/* ===================================== */}
      {/* FILE LIST */}
      {/* ===================================== */}

      {files.length > 0 && (
        <ul
          className={cn(
            'flex flex-col gap-2.5',
            showDropzone && 'mt-4',
          )}
        >

          {files.map((file) => (

            <li
              key={file.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >

              {/* FILE ICON */}

              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-danger-muted text-danger">
                <FileText className="size-4.5" />
              </span>

              {/* FILE DETAILS */}

              <div className="min-w-0 flex-1">

                <p className="truncate text-sm font-medium text-foreground">
                  {file.name}
                </p>

                <div className="mt-1 flex items-center gap-2">

                  <span className="text-xs text-muted-foreground">
                    {formatSize(
                      file.size,
                    )}
                  </span>

                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                    <CheckCircle2 className="size-3.5" />
                    Uploaded
                  </span>

                </div>

              </div>

              {/* REMOVE */}

              <button
                type="button"
                onClick={() =>
                  onRemove(file.id)
                }
                className="
                  flex
                  size-8
                  items-center
                  justify-center
                  rounded-lg
                  text-muted-foreground
                  transition-colors
                  hover:bg-danger-muted
                  hover:text-danger
                "
                aria-label={`Remove ${file.name}`}
              >
                <Trash2 className="size-4" />
              </button>

            </li>
          ))}

        </ul>
      )}

    </div>
  )
}