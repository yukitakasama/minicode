import { isDesktopRuntime } from './desktopRuntime'
import { getDesktopHost } from './desktopHost'

export type ComposerAttachment = {
  id: string
  name: string
  type: 'image' | 'file'
  path?: string
  mimeType?: string
  previewUrl?: string
  data?: string
  isDirectory?: boolean
  lineStart?: number
  lineEnd?: number
  diffSide?: 'old' | 'new'
  hunkId?: string
  note?: string
  quote?: string
}

/**
 * Hard cap for base64-inlining any attachment into the renderer.
 * 100MB Word docs (~133MB as data URLs) have crashed Electron 42 renderers
 * (EXC_BREAKPOINT / dyld_pager) on Intel Macs — see cc-haha#1087.
 */
export const MAX_INLINE_ATTACHMENT_BYTES = 12 * 1024 * 1024

function nextAttachmentId() {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function getFileNameFromPath(filePath: string): string {
  const normalized = filePath.replace(/[\\/]+$/g, '')
  return normalized.split(/[\\/]/).filter(Boolean).pop() || filePath
}

export function pathToComposerAttachment(filePath: string): ComposerAttachment {
  return {
    id: nextAttachmentId(),
    name: getFileNameFromPath(filePath),
    type: 'file',
    path: filePath,
  }
}

export function pathsToComposerAttachments(filePaths: string[]): ComposerAttachment[] {
  return filePaths
    .filter((filePath) => typeof filePath === 'string' && filePath.length > 0)
    .map(pathToComposerAttachment)
}

export function dataTransferHasFiles(dataTransfer: DataTransfer): boolean {
  const types = Array.from(dataTransfer.types ?? [])
  return types.includes('Files') || dataTransfer.files.length > 0
}

export async function dataTransferToComposerAttachments(dataTransfer: DataTransfer): Promise<ComposerAttachment[]> {
  return filesToComposerAttachments(dataTransfer.files)
}

/**
 * Collect File objects from a paste/clipboard DataTransfer.
 * Prefer the Files list (Explorer copy+paste on Windows), then kind:"file" items.
 * See cc-haha#1086 / minicode: paste files into composer without drag-drop.
 */
export function collectClipboardFiles(dataTransfer: DataTransfer | null | undefined): File[] {
  if (!dataTransfer) return []

  const fromFiles = Array.from(dataTransfer.files ?? [])
  if (fromFiles.length > 0) return fromFiles

  const items = dataTransfer.items
  if (!items) return []

  const collected: File[] = []
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    if (!item || item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file) collected.push(file)
  }
  return collected
}

export function clipboardDataHasAttachableFiles(dataTransfer: DataTransfer | null | undefined): boolean {
  return collectClipboardFiles(dataTransfer).length > 0
}

export async function clipboardDataToComposerAttachments(
  dataTransfer: DataTransfer | null | undefined,
): Promise<ComposerAttachment[]> {
  const files = collectClipboardFiles(dataTransfer)
  if (files.length === 0) return []
  return filesToComposerAttachments(files)
}

export async function selectNativeFileAttachments(): Promise<ComposerAttachment[] | null> {
  const host = getDesktopHost()
  if (!host.isDesktop || !host.capabilities.dialogs) return null

  try {
    const selected = await host.dialogs.open({
      multiple: true,
      directory: false,
    })
    const paths = normalizeDialogSelection(selected)
    return pathsToComposerAttachments(paths)
  } catch (error) {
    console.warn('[attachments] Native file picker failed; falling back to browser file input', error)
    return null
  }
}

export async function filesToComposerAttachments(files: FileList | File[]): Promise<ComposerAttachment[]> {
  const entries = Array.from(files)
  const attachments = await Promise.all(entries.map(fileToComposerAttachment))
  return attachments.filter((attachment): attachment is ComposerAttachment => !!attachment)
}

/**
 * Drop heavy base64 payloads when a filesystem path is already known.
 * Keeps small image previews that have no path.
 */
export function toTransportAttachment(attachment: ComposerAttachment): {
  type: 'image' | 'file'
  name: string
  path?: string
  data?: string
  mimeType?: string
  isDirectory?: boolean
  lineStart?: number
  lineEnd?: number
  diffSide?: 'old' | 'new'
  hunkId?: string
  note?: string
  quote?: string
} {
  const hasPath = typeof attachment.path === 'string' && attachment.path.length > 0
  const keepData =
    !hasPath &&
    typeof attachment.data === 'string' &&
    attachment.data.length > 0 &&
    // Never ship multi‑MB base64 over WS/UI once a path exists; without a path
    // only allow modest payloads that already passed MAX_INLINE_ATTACHMENT_BYTES.
    (attachment.type === 'image' || attachment.data.length < MAX_INLINE_ATTACHMENT_BYTES * 1.4)

  return {
    type: attachment.type,
    name: attachment.name,
    path: attachment.path,
    data: keepData ? attachment.data : undefined,
    mimeType: attachment.mimeType,
    isDirectory: attachment.isDirectory,
    lineStart: attachment.lineStart,
    lineEnd: attachment.lineEnd,
    diffSide: attachment.diffSide,
    hunkId: attachment.hunkId,
    note: attachment.note,
    quote: attachment.quote,
  }
}

function normalizeDialogSelection(selected: string | string[] | null): string[] {
  if (!selected) return []
  const paths = Array.isArray(selected) ? selected : [selected]
  return paths.filter((filePath) => typeof filePath === 'string' && filePath.length > 0)
}

function getLegacyNativeFilePath(file: File): string | undefined {
  const path = (file as File & { path?: unknown }).path
  return typeof path === 'string' && path.length > 0 ? path : undefined
}

function resolveNativeFilePath(file: File): string | undefined {
  const legacy = getLegacyNativeFilePath(file)
  if (legacy) return legacy

  if (!isDesktopRuntime()) return undefined

  try {
    const host = getDesktopHost()
    const path = host.files?.getPathForFile?.(file)
    return typeof path === 'string' && path.length > 0 ? path : undefined
  } catch {
    return undefined
  }
}

async function fileToComposerAttachment(file: File): Promise<ComposerAttachment | null> {
  const nativePath = resolveNativeFilePath(file)
  if (nativePath) {
    return pathToComposerAttachment(nativePath)
  }

  const isImage = file.type.startsWith('image/')

  // Desktop must attach non-image files by path only. Without a resolvable path,
  // refuse rather than base64-inlining (100MB Word docs crash the renderer).
  if (isDesktopRuntime() && !isImage) {
    console.warn(
      `[attachments] Refusing to inline "${file.name}" (${file.size} bytes) without a filesystem path. ` +
        'Use the native file picker or drag-and-drop so the desktop shell can pass a path.',
    )
    return null
  }

  if (file.size > MAX_INLINE_ATTACHMENT_BYTES) {
    console.warn(
      `[attachments] Refusing to inline "${file.name}" (${file.size} bytes > ${MAX_INLINE_ATTACHMENT_BYTES}). ` +
        'Large files must be attached as filesystem paths.',
    )
    return null
  }

  const data = await readFileAsDataUrl(file)
  return {
    id: nextAttachmentId(),
    name: file.name,
    type: isImage ? 'image' : 'file',
    mimeType: file.type || undefined,
    previewUrl: isImage ? data : undefined,
    data,
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`))
    reader.readAsDataURL(file)
  })
}