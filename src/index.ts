/**
 * Simple, modern clipboard utilities
 * Focuses on actual browser compatibility issues without over-engineering
 */

export interface ClipboardOptions {
  /** Optional identifier for tracking operations */
  identifier?: string
  /** Logger function for operation tracking */
  logger?: (
    level: 'success' | 'warning' | 'error',
    message: string,
    data?: unknown,
  ) => void
  /** Custom success message */
  successMessage?: string
  /** Custom error message */
  errorMessage?: string
}

export interface ClipboardResult {
  success: boolean
  method?: string
  error?: string
  identifier?: string
}

export type ClipboardIsWriteTextOnly = {
  isWriteTextOnly: true
  isFullySupported: false
  writeText: typeof writeText
}

export type ClipboardIsFullySupported = {
  isWriteTextOnly: false
  isFullySupported: true
  read: typeof read
  readText: typeof readText
  write: typeof write
  writeText: typeof writeText
}

export type ClipboardAPI = ClipboardIsWriteTextOnly | ClipboardIsFullySupported

export function getClipboard(): ClipboardAPI | undefined {
  if (isAvailable()) {
    if (isFullySupported()) {
      return {
        isWriteTextOnly: false,
        isFullySupported: true,
        read,
        readText,
        write,
        writeText,
      }
    }
    if (isWriteSupported()) {
      return {
        isWriteTextOnly: true,
        isFullySupported: false,
        writeText,
      }
    }
  }

  return undefined
}

function isAvailable() {
  return 'clipboard' in navigator
}

// NOTE: Firefox only exposes clipboard.writeText()
function isWriteSupported() {
  return typeof navigator.clipboard.writeText === 'function'
}

function isFullySupported() {
  return (
    typeof navigator.clipboard.read === 'function' &&
    typeof navigator.clipboard.readText === 'function' &&
    typeof navigator.clipboard.write === 'function' &&
    typeof navigator.clipboard.writeText === 'function'
  )
}

function read(): Promise<ClipboardItems> {
  return readFromClipboard(() => navigator.clipboard.read())
}

function readText(): Promise<string> {
  return readFromClipboard(() => navigator.clipboard.readText())
}

async function readFromClipboard<T>(read: () => Promise<T>): Promise<T> {
  // NOTE: Firefox doesn't support `navigator.permissions.query`
  // NOTE: Safari doesn't have a permission for clipboard
  // SEE: https://developer.mozilla.org/en-US/docs/Web/API/Permissions/query

  let result: PermissionState

  try {
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({
        name: 'clipboard-read' as PermissionName,
      })

      result = status.state
    } else {
      // NOTE: if it can't be queried, then it should Just Work™
      result = 'granted'
    }
  } catch (e) {
    if (e instanceof TypeError) {
      // NOTE: a TypeError means we queried for a permission name that the
      // browser is not aware of, which means there isn't a permission check for
      // clipboard-read, so it should Just Work™
      result = 'granted'
    } else {
      // NOTE: must have been an actual error
      throw e
    }
  }

  if (result !== 'denied') {
    return read()
  }
  throw new Error('denied access to the clipboard')
}

// NOTE: https://bugs.webkit.org/show_bug.cgi?id=222262
//       https://bugs.chromium.org/p/chromium/issues/detail?id=1014310
//       https://w3c.github.io/clipboard-apis/#dom-clipboard-writetext
async function write(data: string | PromiseLike<string>): Promise<void> {
  if (typeof data === 'string') {
    await writeText(data)
  } else {
    try {
      const text = new ClipboardItem({
        'text/plain': Promise.resolve(data).then(
          (d) => new Blob([d], { type: 'text/plain' }),
        ),
      })
      await navigator.clipboard.write([text])
    } catch (e) {
      console.error('could not write to the system clipboard', e)
      throw e
    }
  }
}

async function writeText(data: string | PromiseLike<string>): Promise<void> {
  if (
    !navigator.clipboard ||
    typeof navigator.clipboard.writeText !== 'function'
  ) {
    throw new Error('Clipboard API not available')
  }

  try {
    await navigator.clipboard.writeText(await data)
  } catch (e) {
    console.error('could not write to the system clipboard', e)
    throw e
  }
}

// Simple execCommand fallback for older browsers
async function writeTextFallback(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.cssText = `
      position: fixed;
      top: -1000px;
      left: -1000px;
      width: 1px;
      height: 1px;
      padding: 0;
      border: none;
      outline: none;
      background: transparent;
    `

    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    try {
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)

      if (successful) {
        resolve()
      } else {
        reject(new Error('execCommand copy failed'))
      }
    } catch (error) {
      document.body.removeChild(textArea)
      reject(error)
    }
  })
}

/**
 * Main clipboard write function - simple and reliable
 */
export async function writeToClipboard(
  text: string,
  options: ClipboardOptions = {},
): Promise<ClipboardResult> {
  const { identifier, logger, successMessage, errorMessage } = options

  // Validate input
  if (!text || typeof text !== 'string') {
    const error = 'Invalid text provided for clipboard operation'
    logger?.('error', error, { identifier })
    return { success: false, error, identifier }
  }

  // Try modern Clipboard API first
  try {
    await writeText(text)

    const message =
      successMessage ||
      `Written to clipboard: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`
    logger?.('success', message, { identifier, method: 'navigator.clipboard' })

    return {
      success: true,
      method: 'navigator.clipboard',
      identifier,
    }
  } catch (clipboardError) {
    logger?.(
      'warning',
      `Clipboard API failed: ${clipboardError instanceof Error ? clipboardError.message : String(clipboardError)}`,
      { identifier },
    )

    // Try execCommand fallback
    try {
      await writeTextFallback(text)

      const message =
        successMessage ||
        `Written to clipboard: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`
      logger?.('success', message, { identifier, method: 'execCommand' })

      return {
        success: true,
        method: 'execCommand',
        identifier,
      }
    } catch (fallbackError) {
      logger?.(
        'warning',
        `execCommand failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
        { identifier },
      )

      const error = errorMessage || 'All clipboard methods failed'
      logger?.('error', error, { identifier })

      return {
        success: false,
        error,
        identifier,
      }
    }
  }
}

// For backwards compatibility
export class ClipboardManager {
  async writeToClipboard(
    text: string,
    options: ClipboardOptions = {},
  ): Promise<ClipboardResult> {
    return writeToClipboard(text, options)
  }
}

export const clipboard = new ClipboardManager()
export default clipboard
