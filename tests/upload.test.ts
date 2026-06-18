import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture how aws4fetch is driven without making real network/signing calls.
const h = vi.hoisted(() => ({
  fetch: vi.fn(),
  ctorArgs: undefined as unknown,
}));

vi.mock('aws4fetch', () => ({
  AwsClient: class {
    fetch = h.fetch;
    constructor(args: unknown) {
      h.ctorArgs = args;
    }
  },
}));

import { createUploadFile } from '../entrypoints/newtab/lib/upload';
import type { S3Config } from '../entrypoints/newtab/lib/settings';

const config: S3Config = {
  endpoint: 'https://acc.r2.cloudflarestorage.com',
  bucket: 'files',
  accessKeyId: 'AKIA',
  secretAccessKey: 'secret',
  region: 'auto',
  publicBaseUrl: 'https://pub.r2.dev',
};

beforeEach(() => {
  h.fetch.mockReset();
  h.ctorArgs = undefined;
});

describe('createUploadFile', () => {
  it('signs with the s3 service and configured credentials', () => {
    createUploadFile(config);
    expect(h.ctorArgs).toMatchObject({
      accessKeyId: 'AKIA',
      secretAccessKey: 'secret',
      region: 'auto',
      service: 's3',
    });
  });

  it('PUTs the file to endpoint/bucket/key and returns its public URL', async () => {
    h.fetch.mockResolvedValue(new Response(null, { status: 200 }));
    const upload = createUploadFile(config);

    const url = await upload(new File(['hi'], 'My Photo.png', { type: 'image/png' }));

    const [reqUrl, init] = h.fetch.mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(init.headers['Content-Type']).toBe('image/png');
    // endpoint/bucket/today/<uuid>-My-Photo.png
    expect(reqUrl).toMatch(
      /^https:\/\/acc\.r2\.cloudflarestorage\.com\/files\/today\/[0-9a-f-]+-My-Photo\.png$/,
    );
    // The returned URL is the public one, with the same key.
    const key = reqUrl.replace('https://acc.r2.cloudflarestorage.com/files/', '');
    expect(url).toBe(`https://pub.r2.dev/${key}`);
  });

  it('throws a helpful error when the store rejects the upload', async () => {
    h.fetch.mockResolvedValue(new Response('denied', { status: 403, statusText: 'Forbidden' }));
    const upload = createUploadFile(config);

    await expect(upload(new File(['x'], 'a.txt'))).rejects.toThrow(/403 Forbidden.*CORS/s);
  });
});
