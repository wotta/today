import '@testing-library/jest-dom/vitest';
// Installs an in-memory IndexedDB implementation onto globalThis so db.ts (Dexie)
// works under jsdom without a real browser.
import 'fake-indexeddb/auto';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw';

// Start the MSW request interceptor once for the whole suite. Individual tests
// register handlers with server.use(...); they're reset between tests.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
