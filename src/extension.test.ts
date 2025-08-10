import { expect, test } from 'bun:test'
import { type ClipboardResult, clipboard, writeToClipboard } from './index'

// Types for Chrome extension API
interface ChromeMessage {
  action: string
  text: string
}

interface ChromeResponse {
  success?: boolean
  error?: string
}

interface MockChrome {
  runtime: {
    id: string
    sendMessage: (
      message: ChromeMessage,
      callback: (response: ChromeResponse) => void,
    ) => void
    lastError: null
  }
}

// Mock Chrome extension environment
const mockChrome: MockChrome = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: (
      message: ChromeMessage,
      callback: (response: ChromeResponse) => void,
    ) => {
      setTimeout(() => {
        callback({ success: true })
      }, 10)
    },
    lastError: null,
  },
}




test('Non-extension context uses normal method order', async () => {
  // Remove Chrome extension environment
  ;(globalThis as any).chrome = undefined

  // Create a working DOM environment for execCommand
  const mockDocument = {
    createElement: () => ({
      style: {},
      value: '',
      setAttribute: () => {},
      removeAttribute: () => {},
      focus: () => {},
      select: () => {},
      setSelectionRange: () => {},
      parentNode: null,
    }),
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
    execCommand: () => true,
  }

  ;(globalThis as any).document = mockDocument

  // Mock navigator.clipboard to fail
  const originalClipboard = navigator.clipboard
  // @ts-ignore
  navigator.clipboard = undefined

  try {
    const result = await writeToClipboard('test')
    // In non-extension context, execCommand should be used
    expect(result.method).toBe('execCommand')
    expect(result.success).toBe(true)
  } finally {
    // @ts-ignore
    navigator.clipboard = originalClipboard
  }
})

