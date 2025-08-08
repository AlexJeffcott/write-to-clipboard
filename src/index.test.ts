import { expect, test } from 'bun:test'
import { ClipboardManager, writeToClipboard } from './index'

test('ClipboardManager can be instantiated', () => {
  const clipboard = new ClipboardManager()
  expect(clipboard).toBeInstanceOf(ClipboardManager)
})

test('writeToClipboard function exists', () => {
  expect(typeof writeToClipboard).toBe('function')
})

test('invalid text validation', async () => {
  const result = await writeToClipboard('')
  expect(result.success).toBe(false)
  expect(result.error).toContain('Invalid text provided')
})

test('null text validation', async () => {
  // @ts-expect-error - testing invalid input
  const result = await writeToClipboard(null)
  expect(result.success).toBe(false)
  expect(result.error).toContain('Invalid text provided')
})

test('cancelled operation', async () => {
  const controller = new AbortController()
  controller.abort()

  const result = await writeToClipboard('test', {
    signal: controller.signal,
  })

  expect(result.success).toBe(false)
  expect(result.cancelled).toBe(true)
  expect(result.error).toContain('Operation cancelled')
})
