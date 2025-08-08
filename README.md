# @fairfox/write-to-clipboard

Comprehensive clipboard utilities with multiple fallback methods for maximum browser compatibility.

## Features

- ✨ Multiple fallback methods for maximum compatibility
- 🚫 Non-blocking async implementation with AbortController support
- 📝 TypeScript support with full type definitions
- 🔄 Browser and extension environment support
- 📊 Built-in logging and operation tracking
- ⚡ Optimized for performance with timeout handling

## Installation

```bash
npm install @fairfox/write-to-clipboard
```

## Usage

### Basic Usage

```typescript
import { writeToClipboard } from '@fairfox/write-to-clipboard';

// Simple usage
const result = await writeToClipboard('Hello, clipboard!');
console.log(result.success); // true

// With console logging
const result = await writeToClipboard('Hello, clipboard!', {
  timeout: 3000,
  logger: (level, message, data) => {
    console.log(`[${level.toUpperCase()}] ${message}`, data);
  },
  successMessage: 'Text copied successfully!'
});
```

### Advanced Usage with Custom Logger

```typescript
import { ClipboardManager } from '@fairfox/write-to-clipboard';

const clipboard = new ClipboardManager();

// With abort signal and custom logging
const controller = new AbortController();
const result = await clipboard.writeToClipboard('Hello!', {
  signal: controller.signal,
  timeout: 5000,
  logger: (level, message, data) => {
    // Use your preferred logger (Winston, Pino, etc.)
    myLogger[level](`[Clipboard] ${message}`, data);
  },
  callback: (result) => {
    console.log('Operation completed:', result);
  }
});

// Cancel operation
controller.abort();
```

### Options

```typescript
interface ClipboardOptions {
  identifier?: string;          // Optional identifier for tracking
  timeout?: number;             // Timeout in milliseconds (default: 5000)
  logger?: (level: 'success' | 'warning' | 'error', message: string, data?: any) => void;
  successMessage?: string;      // Custom success message
  errorMessage?: string;        // Custom error message
  signal?: AbortSignal;         // AbortController signal for cancellation
  callback?: (result: ClipboardResult) => void; // Callback for operation result
}
```

### Result

```typescript
interface ClipboardResult {
  success: boolean;
  method?: string;              // Method used: 'navigator.clipboard', 'execCommand', or 'extension-fallback'
  error?: string;               // Error message if operation failed
  identifier?: string;          // Optional identifier passed in options
  cancelled?: boolean;          // True if operation was cancelled
}
```

## Fallback Methods

The library tries multiple methods in order:

1. **Modern Clipboard API** (`navigator.clipboard.writeText`)
2. **Legacy execCommand** (`document.execCommand('copy')`)  
3. **WebKit-specific fallback** (Enhanced compatibility for Safari)
4. **Extension Fallback** (Chrome extension context)

## Browser Support

**✅ Full Cross-Browser Support Confirmed**

- **Chrome/Edge**: Full support (uses `navigator.clipboard` or `execCommand`)
- **Firefox**: Full support (uses `navigator.clipboard`)
- **Safari/WebKit**: **Full support** ✅ (uses multiple fallback methods)
- **Opera**: Full support

All major browsers are supported with automatic fallback methods. Safari works perfectly with real user interactions.

### Safari Usage Notes

Safari has stricter clipboard security policies but **works fully** with this library:
- Requires user interaction (click, touch, keyboard event) 
- Multiple fallback methods ensure compatibility
- May fail only in automated testing environments

```typescript
// ✅ Recommended: Called from user interaction (works in all browsers including Safari)
button.addEventListener('click', async () => {
  const result = await writeToClipboard('Hello Safari!'); // ✅ Works perfectly
});

// ⚠️ Note: May fail in Safari if called without user context
document.addEventListener('DOMContentLoaded', async () => {
  const result = await writeToClipboard('Hello Safari!'); // May fail in Safari only
});
```

## Testing

### Automated Testing
Run the full test suite across browsers:
```bash
bun test              # Unit tests
bun run test:e2e      # Playwright tests (Chrome/Firefox pass, WebKit expected failures)
```

### Manual Testing

**🔗 [Live Demo](https://copy-to-clipboard.tiiny.site)**

<iframe src="https://copy-to-clipboard.tiiny.site" width="500" height="500" allowfullscreen></iframe>

**📱 Mobile Testing (Scan QR Code):**

<img src="qr-code.png" alt="QR Code for mobile testing" width="150">

For real-world browser validation, especially Safari and mobile devices:

```bash
# Serve the test page locally
bun run serve         # Start local server
# Open http://localhost:8347/manual-test.html
```

The test page provides interactive buttons to validate clipboard functionality across different browsers with real user interactions. Perfect for testing Safari's strict clipboard security policies.

## Advanced Examples

### BroadcastChannel Logger

```typescript
import { writeToClipboard } from '@fairfox/write-to-clipboard';

// Create a broadcast channel logger for cross-tab communication
function createBroadcastLogger(channelName: string) {
  const channel = new BroadcastChannel(channelName);
  
  return (level: string, message: string, data?: any) => {
    const logEntry = {
      timestamp: Date.now(),
      category: 'clipboard',
      source: 'clipboard-utils',
      level,
      message,
      data: { ...data, timestamp: Date.now() }
    };
    
    // Send to other tabs/windows
    channel.postMessage({ type: 'LOG', entry: logEntry });
    
    // Also log locally
    const prefix = level === 'success' ? '✅' : level === 'warning' ? '⚠️' : '❌';
    console.log(`${prefix} [Clipboard] ${message}`, data);
  };
}

// Usage
const logger = createBroadcastLogger('my-app-logs');
const result = await writeToClipboard('Hello!', { logger });
```

### Integration with Popular Loggers

```typescript
// Winston
import winston from 'winston';
const logger = winston.createLogger({ /* config */ });

await writeToClipboard('text', {
  logger: (level, message, data) => logger[level](message, data)
});

// Pino
import pino from 'pino';
const logger = pino();

await writeToClipboard('text', {
  logger: (level, message, data) => logger[level](data, message)
});
```

## License

MIT © Alex Jeffcott
