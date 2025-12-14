/**
 * Test setup file for Vitest
 * Configures the testing environment for Home Assistant custom card testing
 */

import { beforeEach, afterEach } from 'vitest';

// Setup DOM environment
beforeEach(() => {
  // Clear the document body before each test
  document.body.innerHTML = '';

  // Mock window.matchMedia for responsive design tests
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {}, // Deprecated
      removeListener: () => {}, // Deprecated
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }),
  });

  // Mock customElements if not present
  if (!window.customElements) {
    (window as any).customElements = {
      define: () => {},
      get: () => undefined,
      whenDefined: () => Promise.resolve(),
    };
  }
});

afterEach(() => {
  // Clean up after each test
  document.body.innerHTML = '';
});
