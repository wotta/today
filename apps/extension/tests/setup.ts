import '@testing-library/jest-dom/vitest';
// Installs an in-memory IndexedDB implementation onto globalThis so db.ts (Dexie)
// works under jsdom without a real browser.
import 'fake-indexeddb/auto';

// jsdom doesn't implement Range geometry; CodeMirror needs it to measure text.
if (typeof Range !== 'undefined') {
  Range.prototype.getBoundingClientRect ??= () =>
    ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }) as DOMRect;
  Range.prototype.getClientRects ??= () =>
    ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
}
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw';

// Start the MSW request interceptor once for the whole suite. Individual tests
// register handlers with server.use(...); they're reset between tests.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
