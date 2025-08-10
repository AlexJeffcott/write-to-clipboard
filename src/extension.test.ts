import { test, expect } from "bun:test";
import { writeToClipboard, clipboard } from './index';

// Mock Chrome extension environment
const mockChrome = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: (message: any, callback: (response: any) => void) => {
      setTimeout(() => {
        callback({ success: true });
      }, 10);
    },
    lastError: null
  }
};

test("Chrome extension context - prevents stack overflow with large text", async () => {
  // Set up Chrome extension environment
  (globalThis as any).chrome = mockChrome;
  
  // Mock navigator.clipboard for test environment
  const mockWriteText = async (text: string) => Promise.resolve();
  (globalThis as any).navigator = {
    ...globalThis.navigator,
    clipboard: { writeText: mockWriteText }
  };
  
  // Generate large text that previously caused stack overflow
  const largeText = Array(50000).fill(0).map((_, i) => 
    `Log entry ${i}: This is a sample log message with data ${Math.random()}`
  ).join('\n');
  
  // This should not cause a stack overflow
  const result = await writeToClipboard(largeText);
  
  expect(result.success).toBe(true);
  expect(result.method).toBe('navigator.clipboard');
});

test("Chrome extension context - callback handling uses queueMicrotask", async () => {
  (globalThis as any).chrome = mockChrome;
  
  let callbackCalled = false;
  let callbackResult: any = null;
  
  const result = await writeToClipboard('test text', {
    callback: (result) => {
      callbackCalled = true;
      callbackResult = result;
    }
  });
  
  expect(result.success).toBe(true);
  
  // Wait for microtask to execute
  await new Promise(resolve => queueMicrotask(resolve));
  
  expect(callbackCalled).toBe(true);
  expect(callbackResult.success).toBe(true);
});

test("Extension context optimizes method order", async () => {
  (globalThis as any).chrome = mockChrome;
  
  // Mock navigator.clipboard to fail so we test the fallback order
  const originalClipboard = navigator.clipboard;
  
  // @ts-ignore - for testing
  navigator.clipboard = undefined;
  
  try {
    const result = await writeToClipboard('test');
    // In extension context, extension-fallback should be second in line
    expect(result.method).toBe('extension-fallback');
  } finally {
    // @ts-ignore - restore
    navigator.clipboard = originalClipboard;
  }
});

test("Non-extension context uses normal method order", async () => {
  // Remove Chrome extension environment
  delete (globalThis as any).chrome;
  
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
      parentNode: null
    }),
    body: {
      appendChild: () => {},
      removeChild: () => {}
    },
    execCommand: () => true
  };
  
  (globalThis as any).document = mockDocument;
  
  // Mock navigator.clipboard to fail
  const originalClipboard = navigator.clipboard;
  // @ts-ignore
  navigator.clipboard = undefined;
  
  try {
    const result = await writeToClipboard('test');
    // In non-extension context, execCommand should be used
    expect(result.method).toBe('execCommand');
    expect(result.success).toBe(true);
  } finally {
    // @ts-ignore
    navigator.clipboard = originalClipboard;
  }
});

test("Arrow function export prevents binding issues", () => {
  // Verify that writeToClipboard is not a bound method
  expect(writeToClipboard.name).not.toBe('bound writeToClipboard');
  
  // Verify it's a regular function
  expect(typeof writeToClipboard).toBe('function');
  
  // Should work when called directly
  expect(() => writeToClipboard('test')).not.toThrow();
});