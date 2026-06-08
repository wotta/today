import { setupServer } from 'msw/node';

/** Shared MSW server. Tests add handlers per-case with `server.use(...)`. */
export const server = setupServer();
