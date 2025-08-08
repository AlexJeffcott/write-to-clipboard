import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/test.html');
  
  // Simulate user interaction for webkit/safari clipboard permissions
  await page.click('body');
});

test.describe('Clipboard Functionality', () => {
  
  test('basic clipboard write operation', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { writeToClipboard } = await import('./dist/index.js');
      return await writeToClipboard('Hello, Playwright!');
    });
    
    expect(result.success).toBe(true);
    expect(result.method).toBeDefined();
  });

  test('clipboard write with custom identifier', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { writeToClipboard } = await import('./dist/index.js');
      return await writeToClipboard('Test with identifier', {
        identifier: 'test-001'
      });
    });
    
    expect(result.success).toBe(true);
    expect(result.identifier).toBe('test-001');
  });

  test('clipboard write with logger', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { writeToClipboard } = await import('./dist/index.js');
      
      let loggedMessage = '';
      let loggedLevel = '';
      
      const result = await writeToClipboard('Test with logger', {
        logger: (level, message, data) => {
          loggedLevel = level;
          loggedMessage = message;
        }
      });
      
      return { result, loggedMessage, loggedLevel };
    });
    
    expect(result.result.success).toBe(true);
    expect(result.loggedLevel).toBe('success');
    expect(result.loggedMessage).toContain('Written to clipboard');
  });

  test('clipboard write with timeout', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { writeToClipboard } = await import('./dist/index.js');
      return await writeToClipboard('Test with timeout', {
        timeout: 10000
      });
    });
    
    expect(result.success).toBe(true);
  });

  test('empty text validation', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { writeToClipboard } = await import('./dist/index.js');
      return await writeToClipboard('');
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid text provided');
  });

  test('null text validation', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { writeToClipboard } = await import('./dist/index.js');
      return await writeToClipboard(null as any);
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid text provided');
  });

  test('abort signal functionality', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { writeToClipboard } = await import('./dist/index.js');
      
      const controller = new AbortController();
      controller.abort(); // Abort immediately
      
      return await writeToClipboard('This should be cancelled', {
        signal: controller.signal
      });
    });
    
    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(true);
    expect(result.error).toContain('Operation cancelled');
  });

  test('callback functionality', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { writeToClipboard } = await import('./dist/index.js');
      
      return new Promise((resolve) => {
        writeToClipboard('Test callback', {
          callback: (result) => {
            resolve(result);
          }
        });
      });
    });
    
    expect(result.success).toBe(true);
  });

  test('ClipboardManager class usage', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { ClipboardManager } = await import('./dist/index.js');
      
      const clipboard = new ClipboardManager();
      return await clipboard.writeToClipboard('Test ClipboardManager');
    });
    
    expect(result.success).toBe(true);
  });

  test('custom success message', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { writeToClipboard } = await import('./dist/index.js');
      
      let loggedMessage = '';
      
      const result = await writeToClipboard('Test custom message', {
        successMessage: 'Custom success message!',
        logger: (level, message) => {
          loggedMessage = message;
        }
      });
      
      return { result, loggedMessage };
    });
    
    expect(result.result.success).toBe(true);
    expect(result.loggedMessage).toBe('Custom success message!');
  });

});

test.describe('Browser Compatibility', () => {
  
  test('modern clipboard API availability', async ({ page, browserName }) => {
    const hasClipboardAPI = await page.evaluate(() => {
      return !!(navigator.clipboard && navigator.clipboard.writeText);
    });
    
    // Modern browsers should have the clipboard API
    if (browserName === 'chromium' || browserName === 'firefox' || browserName === 'webkit') {
      expect(hasClipboardAPI).toBe(true);
    }
  });

  test('clipboard write works across all browsers', async ({ page, browserName }) => {
    const result = await page.evaluate(async () => {
      const { writeToClipboard } = await import('./dist/index.js');
      return await writeToClipboard(`Browser test: ${navigator.userAgent.slice(0, 30)}`);
    });
    
    expect(result.success).toBe(true);
    console.log(`${browserName}: Clipboard operation succeeded with method: ${result.method}`);
  });

});