import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserHost } from './desktopHost/browserHost'
import {
  MAX_INLINE_ATTACHMENT_BYTES,
  filesToComposerAttachments,
  pathToComposerAttachment,
  selectNativeFileAttachments,
  toTransportAttachment,
} from './composerAttachments'

function makeFile(name: string, size: number, type = 'application/octet-stream'): File {
  // Avoid allocating the full byte length for huge sizes in tests.
  const bytes = size <= 1024 * 1024
    ? new Uint8Array(size)
    : new Uint8Array(16)
  const file = new File([bytes], name, { type })
  if (size > bytes.byteLength) {
    Object.defineProperty(file, 'size', { value: size })
  }
  return file
}

describe('composer attachment payloads', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'desktopHost')
    vi.restoreAllMocks()
  })

  it('keeps many selected desktop project files as paths instead of request-body data', () => {
    const projectRoot = '/tmp/cc-haha-issue-444-regression'
    const files = Array.from({ length: 12 }, (_, index) => (
      `${projectRoot}/assets/large-${index + 1}.bin`
    ))

    const oldInlineAttachments = files.map((filePath) => ({
      type: 'file' as const,
      name: filePath.split('/').pop(),
      data: `data:application/octet-stream;base64,${'A'.repeat(256 * 1024)}`,
      mimeType: 'application/octet-stream',
    }))
    const oldInlinePayload = JSON.stringify({
      type: 'user_message',
      content: 'analyze these files',
      attachments: oldInlineAttachments,
    })

    const pathOnlyAttachments = files.map(pathToComposerAttachment)
    const pathOnlyPayload = JSON.stringify({
      type: 'user_message',
      content: 'analyze these files',
      attachments: pathOnlyAttachments,
    })

    expect(oldInlinePayload.length).toBeGreaterThan(3 * 1024 * 1024)
    expect(pathOnlyPayload.length).toBeLessThan(3 * 1024)
    expect(pathOnlyAttachments.every((attachment) => attachment.path && !attachment.data)).toBe(true)
  })

  it('selects native file attachments through the injected desktop host', async () => {
    const open = vi.fn().mockResolvedValue(['/workspace/a.txt', '/workspace/b.log'])
    window.desktopHost = {
      ...browserHost,
      kind: 'electron',
      isDesktop: true,
      capabilities: {
        ...browserHost.capabilities,
        dialogs: true,
      },
      dialogs: {
        ...browserHost.dialogs,
        open,
      },
    }

    const attachments = await selectNativeFileAttachments()

    expect(open).toHaveBeenCalledWith({ multiple: true, directory: false })
    expect(attachments?.map((attachment) => attachment.path)).toEqual([
      '/workspace/a.txt',
      '/workspace/b.log',
    ])
  })

  it('resolves desktop File objects via host.files.getPathForFile instead of base64', async () => {
    const getPathForFile = vi.fn().mockReturnValue('/Users/nanmi/Documents/huge.docx')
    window.desktopHost = {
      ...browserHost,
      kind: 'electron',
      isDesktop: true,
      capabilities: {
        ...browserHost.capabilities,
        dialogs: true,
        filePaths: true,
      },
      files: {
        getPathForFile,
      },
    }

    const file = makeFile('huge.docx', 100 * 1024 * 1024, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const attachments = await filesToComposerAttachments([file])

    expect(getPathForFile).toHaveBeenCalledWith(file)
    expect(attachments).toHaveLength(1)
    expect(attachments[0]).toMatchObject({
      name: 'huge.docx',
      type: 'file',
      path: '/Users/nanmi/Documents/huge.docx',
    })
    expect(attachments[0]?.data).toBeUndefined()
  })

  it('refuses to base64-inline oversized files without a path (issue #1087)', async () => {
    window.desktopHost = {
      ...browserHost,
      kind: 'electron',
      isDesktop: true,
      files: {
        getPathForFile: () => null,
      },
    }

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const file = makeFile('report.docx', 100 * 1024 * 1024, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const attachments = await filesToComposerAttachments([file])

    expect(attachments).toEqual([])
    expect(warn).toHaveBeenCalled()
    expect(file.size).toBeGreaterThan(MAX_INLINE_ATTACHMENT_BYTES)
  })

  it('still allows modest browser image inlining without a path', async () => {
    Reflect.deleteProperty(window, 'desktopHost')
    const file = makeFile('tiny.png', 32, 'image/png')
    // FileReader is used; mock it
    class MockReader {
      result: string | ArrayBuffer | null = null
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null
      onerror: ((ev: ProgressEvent<FileReader>) => void) | null = null
      readAsDataURL(_blob: Blob) {
        this.result = 'data:image/png;base64,AAAA'
        this.onload?.({} as ProgressEvent<FileReader>)
      }
    }
    vi.stubGlobal('FileReader', MockReader)

    const attachments = await filesToComposerAttachments([file])
    expect(attachments).toHaveLength(1)
    expect(attachments[0]).toMatchObject({
      name: 'tiny.png',
      type: 'image',
      data: 'data:image/png;base64,AAAA',
    })
  })

  it('strips data from transport payload when path is present', () => {
    const attachment = {
      ...pathToComposerAttachment('/tmp/large.docx'),
      data: `data:application/octet-stream;base64,${'A'.repeat(1024)}`,
    }
    expect(toTransportAttachment(attachment)).toEqual(
      expect.objectContaining({
        path: '/tmp/large.docx',
        data: undefined,
      }),
    )
  })
})
