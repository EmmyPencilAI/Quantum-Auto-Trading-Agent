import { Buffer } from 'buffer';

// Polyfill Buffer, global, and process
window.Buffer = Buffer;
(window as any).global = window;
if (!(window as any).process) {
  (window as any).process = {
    env: { NODE_ENV: 'development' },
    nextTick: (fn: any, ...args: any[]) => setTimeout(() => fn(...args), 0),
    browser: true,
    cwd: () => '/',
    version: 'v18.0.0',
    versions: { node: '18.0.0' },
    on: () => {},
    once: () => {},
    off: () => {},
    emit: () => {},
    listeners: () => []
  };
}

// Safety for fetch being read-only
try {
  const originalFetch = window.fetch;
  const descriptor = Object.getOwnPropertyDescriptor(window, 'fetch');
  if (descriptor && descriptor.get && !descriptor.set) {
    Object.defineProperty(window, 'fetch', {
      get: () => originalFetch,
      set: (v) => console.warn('Attempted to set read-only fetch in main.tsx', v),
      configurable: true
    });
  }
} catch (e) {
  // Ignore errors
}
// Ensure globalThis also has Buffer for some libraries
(globalThis as any).Buffer = Buffer;

// Test Buffer polyfill
try {
  const testBuf = Buffer.from([1, 2, 3]);
  if (!(testBuf instanceof Uint8Array)) {
    console.warn("Buffer polyfill is not a Uint8Array!");
  }
} catch (e) {
  console.error("Buffer polyfill test failed:", e);
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

try {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
} catch (error) {
  console.error("Critical error during app render:", error);
  document.body.innerHTML = `
    <div style="background: #050505; color: #ef4444; padding: 20px; font-family: monospace; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
      <h1 style="font-size: 24px; margin-bottom: 10px;">QUANTUM ENGINE CRITICAL ERROR</h1>
      <p style="color: rgba(255,255,255,0.6); max-width: 600px;">The application failed to initialize. This is usually due to a missing environment variable or a network restriction.</p>
      <pre style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; margin-top: 20px; text-align: left; overflow: auto; max-width: 90vw;">${error instanceof Error ? error.stack : String(error)}</pre>
      <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer;">RETRY INITIALIZATION</button>
    </div>
  `;
}
