/**
 * Comprehensive Clipboard Implementation
 *
 * Non-blocking async implementation with AbortController signals for cancellation
 * Multiple fallback methods for maximum compatibility across environments
 */

export interface ClipboardOptions {
  /** Optional identifier for tracking operations */
  identifier?: string
  /** Timeout in milliseconds for operation */
  timeout?: number
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
  /** AbortController signal for cancellation */
  signal?: AbortSignal
  /** Callback for operation result */
  callback?: (result: ClipboardResult) => void
}

export interface ClipboardResult {
  success: boolean
  method?: string
  error?: string
  identifier?: string
  cancelled?: boolean
}

export class ClipboardManager {
  /**
   * Main clipboard function with multiple fallback methods and signal support
   */
  async writeToClipboard(
    text: string,
    options: ClipboardOptions = {},
  ): Promise<ClipboardResult> {
    // Detect Chrome extension context and optimize for it
    const isExtensionContext =
      typeof globalThis.chrome !== 'undefined' && globalThis.chrome?.runtime?.id
    const {
      identifier,
      timeout = 5000,
      logger,
      successMessage,
      errorMessage,
      signal,
      callback,
    } = options

    // Check if already cancelled
    if (signal?.aborted) {
      const result = {
        success: false,
        error: 'Operation cancelled',
        cancelled: true,
        identifier,
      }
      if (callback) queueMicrotask(() => callback(result))
      return result
    }

    // Validate input
    if (!text || typeof text !== 'string') {
      const error = 'Invalid text provided for clipboard operation'
      logger?.('error', error, { identifier })
      const result = { success: false, error, identifier }
      if (callback) queueMicrotask(() => callback(result))
      return result
    }

    // Optimize method order for extension contexts to prevent stack overflow
    const methods = isExtensionContext
      ? [
          { name: 'navigator.clipboard', fn: this.writeWithClipboardAPI },
          { name: 'extension-fallback', fn: this.writeWithExtensionFallback },
          { name: 'execCommand', fn: this.writeWithExecCommand },
          { name: 'webkit-fallback', fn: this.writeWithWebKitFallback },
        ]
      : [
          { name: 'navigator.clipboard', fn: this.writeWithClipboardAPI },
          { name: 'execCommand', fn: this.writeWithExecCommand },
          { name: 'webkit-fallback', fn: this.writeWithWebKitFallback },
          { name: 'extension-fallback', fn: this.writeWithExtensionFallback },
        ]

    for (const method of methods) {
      try {
        // Create timeout promise that respects abort signal
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timeoutId = setTimeout(
            () => reject(new Error('Timeout')),
            timeout,
          )

          signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timeoutId)
              reject(new Error('Operation cancelled'))
            },
            { once: true },
          )
        })

        const result = await Promise.race([
          method.fn.call(this, text, signal),
          timeoutPromise,
        ])

        if (signal?.aborted) {
          const cancelledResult = {
            success: false,
            error: 'Operation cancelled',
            cancelled: true,
            identifier,
          }
          if (callback) queueMicrotask(() => callback(cancelledResult))
          return cancelledResult
        }

        if (result.success) {
          const finalResult = {
            ...result,
            method: method.name,
            identifier,
          }

          if (logger) {
            const message =
              successMessage ||
              `Written to clipboard: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`
            logger('success', message, { identifier, method: method.name })
          }

          if (callback) {
            queueMicrotask(() => callback(finalResult))
          }

          return finalResult
        }
      } catch (error) {
        if (signal?.aborted) {
          const cancelledResult = {
            success: false,
            error: 'Operation cancelled',
            cancelled: true,
            identifier,
          }
          if (callback) queueMicrotask(() => callback(cancelledResult))
          return cancelledResult
        }

        logger?.(
          'warning',
          `${method.name} failed: ${error instanceof Error ? error.message : String(error)}`,
          { identifier },
        )
      }
    }

    // All methods failed
    const error = errorMessage || 'All clipboard methods failed'
    logger?.('error', error, { identifier })

    const failedResult = { success: false, error, identifier }
    if (callback) {
      queueMicrotask(() => callback(failedResult))
    }

    return failedResult
  }

  /**
   * Write using modern Clipboard API (2025 approach)
   * Optimized for Chrome extension contexts to prevent stack overflow
   */
  private async writeWithClipboardAPI(
    text: string,
    signal?: AbortSignal,
  ): Promise<ClipboardResult> {
    if (signal?.aborted) {
      throw new Error('Operation cancelled')
    }

    if (!navigator.clipboard?.writeText) {
      throw new Error('Clipboard API not available')
    }

    // For extension contexts, use direct approach to avoid Promise chain recursion
    const isExtensionContext =
      typeof globalThis.chrome !== 'undefined' && globalThis.chrome?.runtime?.id

    if (isExtensionContext) {
      // Direct call without additional Promise wrapping to prevent stack overflow
      await navigator.clipboard.writeText(text)
      return { success: true }
    }

    if (signal) {
      return new Promise((resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(new Error('Operation cancelled')),
          { once: true },
        )

        navigator.clipboard
          .writeText(text)
          .then(() => resolve({ success: true }))
          .catch(reject)
      })
    }

    await navigator.clipboard.writeText(text)
    return { success: true }
  }

  /**
   * Write using legacy document.execCommand with signal support
   * Enhanced for WebKit/Safari compatibility
   */
  private async writeWithExecCommand(
    text: string,
    signal?: AbortSignal,
  ): Promise<ClipboardResult> {
    if (signal?.aborted) {
      throw new Error('Operation cancelled')
    }

    return new Promise((resolve, reject) => {
      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            reject(new Error('Operation cancelled'))
          },
          { once: true },
        )
      }

      // Use setTimeout for better WebKit compatibility instead of requestAnimationFrame
      setTimeout(() => {
        let textArea: HTMLTextAreaElement | null = null

        try {
          if (signal?.aborted) {
            reject(new Error('Operation cancelled'))
            return
          }

          // Check if execCommand is supported (more thorough check for WebKit)
          if (typeof document.execCommand !== 'function') {
            reject(new Error('execCommand not available'))
            return
          }

          textArea = document.createElement('textarea')
          textArea.value = text

          // Enhanced styling for WebKit compatibility
          textArea.style.cssText = `
            position: fixed !important;
            top: -1000px !important;
            left: -1000px !important;
            width: 1px !important;
            height: 1px !important;
            padding: 0 !important;
            border: none !important;
            outline: none !important;
            boxShadow: none !important;
            background: transparent !important;
            opacity: 0 !important;
            pointer-events: none !important;
            z-index: -1 !important;
          `

          // Remove readonly for better WebKit compatibility
          textArea.removeAttribute('readonly')
          textArea.setAttribute('tabindex', '0') // Make focusable

          document.body.appendChild(textArea)

          if (signal?.aborted) {
            document.body.removeChild(textArea)
            reject(new Error('Operation cancelled'))
            return
          }

          // Enhanced selection for WebKit
          textArea.focus()
          textArea.select()

          // Additional selection methods for WebKit
          if (textArea.setSelectionRange) {
            textArea.setSelectionRange(0, text.length)
          }
          if (textArea.select) {
            textArea.select()
          }

          // Try multiple approaches for execCommand
          let successful = false

          try {
            // First attempt: standard execCommand
            successful = document.execCommand('copy')
          } catch (e) {
            // If that fails, try with different parameters
            try {
              successful = document.execCommand('copy', false, undefined)
            } catch (e2) {
              // Final attempt with explicit parameters
              successful = document.execCommand('copy', false, undefined)
            }
          }

          // Clean up
          if (textArea?.parentNode) {
            document.body.removeChild(textArea)
          }

          if (!successful) {
            reject(new Error('execCommand copy returned false'))
          } else {
            resolve({ success: true })
          }
        } catch (error) {
          // Ensure cleanup on error
          if (textArea?.parentNode) {
            try {
              document.body.removeChild(textArea)
            } catch (e) {
              // Ignore cleanup errors
            }
          }
          reject(error)
        }
      }, 0)
    })
  }

  /**
   * WebKit-specific fallback using button click approach
   * This method works better in Safari by simulating user interaction
   */
  private async writeWithWebKitFallback(
    text: string,
    signal?: AbortSignal,
  ): Promise<ClipboardResult> {
    if (signal?.aborted) {
      throw new Error('Operation cancelled')
    }

    return new Promise((resolve, reject) => {
      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            reject(new Error('Operation cancelled'))
          },
          { once: true },
        )
      }

      // Create a button element that triggers the copy on click
      const button = document.createElement('button')
      const textArea = document.createElement('textarea')

      try {
        // Setup textarea with text
        textArea.value = text
        textArea.style.cssText = `
          position: fixed !important;
          left: -9999px !important;
          top: -9999px !important;
          width: 1px !important;
          height: 1px !important;
          opacity: 0 !important;
        `

        // Setup button
        button.style.cssText = `
          position: fixed !important;
          left: -9999px !important;
          top: -9999px !important;
          width: 1px !important;
          height: 1px !important;
          opacity: 0 !important;
        `

        document.body.appendChild(textArea)
        document.body.appendChild(button)

        if (signal?.aborted) {
          document.body.removeChild(textArea)
          document.body.removeChild(button)
          reject(new Error('Operation cancelled'))
          return
        }

        // Add click handler to button
        const clickHandler = (e: Event) => {
          e.preventDefault()

          try {
            textArea.focus()
            textArea.select()

            // Try different selection methods for WebKit
            if (textArea.setSelectionRange) {
              textArea.setSelectionRange(0, text.length)
            }

            const success = document.execCommand('copy')

            // Cleanup
            document.body.removeChild(textArea)
            document.body.removeChild(button)

            if (success) {
              resolve({ success: true })
            } else {
              reject(new Error('Button copy method failed'))
            }
          } catch (error) {
            // Cleanup on error
            if (textArea.parentNode) document.body.removeChild(textArea)
            if (button.parentNode) document.body.removeChild(button)
            reject(error)
          }
        }

        button.addEventListener('click', clickHandler, { once: true })

        // Trigger the click programmatically
        setTimeout(() => {
          if (signal?.aborted) {
            if (textArea.parentNode) document.body.removeChild(textArea)
            if (button.parentNode) document.body.removeChild(button)
            reject(new Error('Operation cancelled'))
            return
          }

          button.click()
        }, 0)
      } catch (error) {
        // Ensure cleanup
        if (textArea.parentNode) {
          try {
            document.body.removeChild(textArea)
          } catch (e) {}
        }
        if (button.parentNode) {
          try {
            document.body.removeChild(button)
          } catch (e) {}
        }
        reject(error)
      }
    })
  }

  /**
   * Write using Chrome extension-specific methods with signal support
   */
  private async writeWithExtensionFallback(
    text: string,
    signal?: AbortSignal,
  ): Promise<ClipboardResult> {
    if (signal?.aborted) {
      throw new Error('Operation cancelled')
    }

    // Check if we're in an extension context
    if (
      typeof globalThis.chrome === 'undefined' ||
      !globalThis.chrome?.runtime ||
      !globalThis.chrome?.runtime?.id
    ) {
      throw new Error('Not in extension context')
    }

    return new Promise((resolve, reject) => {
      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            reject(new Error('Operation cancelled'))
          },
          { once: true },
        )
      }

      globalThis.chrome.runtime.sendMessage(
        { action: 'writeToClipboard', text },
        (response: { success?: boolean; error?: string }) => {
          if (signal?.aborted) {
            reject(new Error('Operation cancelled'))
            return
          }

          if (globalThis.chrome.runtime.lastError) {
            reject(new Error(globalThis.chrome.runtime.lastError.message))
          } else if (response?.success) {
            resolve({ success: true })
          } else {
            reject(new Error(response?.error || 'Extension clipboard failed'))
          }
        },
      )
    })
  }
}

// Default instance for convenience
export const clipboard = new ClipboardManager()

// Export for backwards compatibility - create direct function to prevent stack overflow in extensions
export function writeToClipboard(
  text: string,
  options?: ClipboardOptions,
): Promise<ClipboardResult> {
  return clipboard.writeToClipboard(text, options)
}

export default clipboard
