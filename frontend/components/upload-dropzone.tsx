'use client'

import { useRef, useState } from 'react'
import {
  CheckCircle2,
  FileText,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react'

import { cn } from '@/lib/utils'


export interface UploadedFile {
  id: string
  name: string
  size: number
  progress: number
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

          file,
        }),
      )

    onAdd(
      multiple
        ? incoming
        : incoming.slice(0, 1),
    )

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
              group/dropzone
              relative
              flex
              min-h-[220px]
              w-full
              flex-col
              items-center
              justify-center
              overflow-hidden
              rounded-xl
              border
              border-dashed
              px-6
              py-9
              text-center
              outline-none
              transition-all
              duration-300
            `,

            dragging
              ? `
                  scale-[1.01]
                  border-primary
                  bg-primary/[0.06]
                  shadow-[0_8px_30px_rgba(22,31,86,0.10)]
                `
              : `
                  border-primary/20
                  bg-gradient-to-b
                  from-primary/[0.025]
                  to-slate-50/40
                  hover:-translate-y-px
                  hover:border-primary/45
                  hover:bg-primary/[0.035]
                  hover:shadow-[0_8px_26px_rgba(22,31,86,0.07)]
                `,
          )}
        >

          {/* SOFT DECORATION */}

          <div
            className="
              pointer-events-none
              absolute
              -left-16
              -top-20
              size-44
              rounded-full
              bg-primary/[0.035]
              blur-2xl
            "
          />

          <div
            className="
              pointer-events-none
              absolute
              -bottom-20
              -right-12
              size-36
              rounded-full
              bg-primary/[0.025]
              blur-2xl
            "
          />


          {/* ICON */}

          <span
            className={cn(
              `
                relative
                flex
                size-14
                items-center
                justify-center
                rounded-2xl
                border
                transition-all
                duration-300
              `,

              dragging
                ? `
                    scale-105
                    border-primary/20
                    bg-primary
                    text-white
                    shadow-[0_8px_22px_rgba(22,31,86,0.18)]
                  `
                : `
                    border-primary/10
                    bg-white
                    text-primary
                    shadow-[0_5px_16px_rgba(22,31,86,0.08)]
                    group-hover/dropzone:scale-105
                    group-hover/dropzone:bg-primary
                    group-hover/dropzone:text-white
                  `,
            )}
          >
            <UploadCloud className="size-6" />
          </span>


          {/* TITLE */}

          <p className="relative mt-4 text-sm font-semibold text-foreground">
            {dragging
              ? 'Drop files here'
              : title}
          </p>


          {/* DESCRIPTION */}

          <p className="relative mt-1.5 text-xs text-muted-foreground">
            {dragging
              ? 'Release to add the selected document'
              : description}
          </p>


          {/* DRAG INFO */}

          {!dragging && (
            <p className="relative mt-1 text-[11px] text-muted-foreground/70">
              Drag and drop or choose from your device
            </p>
          )}


          {/* BROWSE BUTTON */}

          <span
            className="
              relative
              mt-5
              inline-flex
              h-9
              items-center
              gap-2
              rounded-lg
              bg-primary
              px-4
              text-xs
              font-semibold
              text-primary-foreground
              shadow-[0_5px_14px_rgba(22,31,86,0.14)]
              transition-all
              duration-200
              group-hover/dropzone:-translate-y-px
              group-hover/dropzone:shadow-[0_7px_18px_rgba(22,31,86,0.20)]
            "
          >
            <Plus className="size-3.5" />
            Browse Files
          </span>


          {/* INPUT */}

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
              className="
                group/file
                flex
                items-center
                gap-3
                rounded-xl
                border
                border-border
                bg-white
                p-3.5
                shadow-[0_3px_12px_rgba(22,31,86,0.035)]
                transition-all
                duration-200
                hover:border-primary/15
                hover:shadow-[0_5px_16px_rgba(22,31,86,0.06)]
              "
            >

              {/* FILE ICON */}

              <span
                className="
                  flex
                  size-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  bg-red-50
                  text-red-600
                  ring-1
                  ring-inset
                  ring-red-100
                "
              >
                <FileText className="size-4.5" />
              </span>


              {/* FILE DETAILS */}

              <div className="min-w-0 flex-1">

                <p className="truncate text-sm font-medium text-foreground">
                  {file.name}
                </p>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">

                  <span className="text-xs text-muted-foreground">
                    {formatSize(
                      file.size,
                    )}
                  </span>

                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="size-3.5" />
                    Ready
                  </span>

                </div>

              </div>


              {/* REMOVE */}

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onRemove(file.id)
                }}
                className="
                  flex
                  size-8
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  text-muted-foreground
                  opacity-70
                  transition-all
                  duration-200
                  hover:bg-red-50
                  hover:text-red-600
                  group-hover/file:opacity-100
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