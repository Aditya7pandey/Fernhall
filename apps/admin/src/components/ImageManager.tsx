import { ArrowLeft, ArrowRight, ImagePlus, Link2, Loader2, Star, Trash2 } from 'lucide-react'
import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { cn, errorMessage, imageUrl } from '../lib/utils'
import { Button } from './ui/button'
import { Input } from './ui/input'

/**
 * Edits an ordered list of image paths: drag & drop / file-picker uploads, add by URL,
 * reorder (first = cover) and remove.
 */
export function ImageManager({ images, onChange, max = 10 }: { images: string[]; onChange: (images: string[]) => void; max?: number }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState<string | null>(null)

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (list.length === 0) return toast.error('Choose image files (JPEG, PNG, WebP, GIF, AVIF)')
    const room = max - images.length
    if (room <= 0) return toast.error(`Up to ${max} images per product`)
    setUploading(true)
    try {
      const { urls } = await api.admin.upload(list.slice(0, room))
      onChange([...images, ...urls])
      toast.success(`Uploaded ${urls.length} image${urls.length === 1 ? '' : 's'}`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  const addUrl = () => {
    const v = url.trim()
    if (!v) return
    if (!/^https?:\/\//.test(v) && !v.startsWith('/uploads/')) return toast.error('Enter a full image URL (https://…)')
    if (images.length >= max) return toast.error(`Up to ${max} images per product`)
    onChange([...images, v])
    setUrl('')
  }

  const move = (i: number, dir: -1 | 1) => {
    const next = [...images]
    const j = i + dir
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    onChange(next)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files)
  }

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((src, i) => (
            <li
              key={`${src}-${i}`}
              className={cn(
                'group relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-3',
                i === 0 && 'col-span-2 row-span-2',
              )}
            >
              <button type="button" className="size-full cursor-zoom-in" onClick={() => setPreview(src)} aria-label="Preview image">
                <img src={imageUrl(src, i === 0 ? 600 : 300)} alt="" className="size-full object-cover" />
              </button>
              {i === 0 && (
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                  <Star className="size-3 fill-current" /> Cover
                </span>
              )}
              <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <div className="flex gap-1">
                  {i > 0 && <IconBtn label="Move left" onClick={() => move(i, -1)} icon={<ArrowLeft />} />}
                  {i < images.length - 1 && <IconBtn label="Move right" onClick={() => move(i, 1)} icon={<ArrowRight />} />}
                </div>
                <IconBtn label="Remove image" onClick={() => onChange(images.filter((_, j) => j !== i))} icon={<Trash2 />} danger />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragOver ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong hover:bg-surface-2',
        )}
      >
        {uploading ? <Loader2 className="size-6 animate-spin text-accent" /> : <ImagePlus className="size-6 text-subtle" />}
        <p className="mt-2 text-[13px] font-medium">{uploading ? 'Uploading…' : 'Drop images here or click to upload'}</p>
        <p className="mt-0.5 text-xs text-muted">JPEG, PNG, WebP, GIF or AVIF · up to 5 MB each · first image is the cover</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) upload(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addUrl()
              }
            }}
            placeholder="…or paste an image URL"
            leading={<Link2 className="size-3.5" />}
          />
        </div>
        <Button variant="secondary" onClick={addUrl} disabled={!url.trim()}>
          Add
        </Button>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[60] flex animate-fade-in items-center justify-center bg-black/80 p-6" onClick={() => setPreview(null)}>
          <img src={imageUrl(preview, 1600)} alt="" className="max-h-full max-w-full animate-pop-in rounded-xl object-contain shadow-pop" />
        </div>
      )}
    </div>
  )
}

function IconBtn({ label, onClick, icon, danger }: { label: string; onClick: () => void; icon: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        'flex size-7 cursor-pointer items-center justify-center rounded-md bg-white/90 text-zinc-800 shadow-sm backdrop-blur transition-colors [&_svg]:size-3.5',
        danger ? 'hover:bg-red-500 hover:text-white' : 'hover:bg-white',
      )}
    >
      {icon}
    </button>
  )
}
