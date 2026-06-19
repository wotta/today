import { AwsClient } from 'aws4fetch';
import { getS3Config, type S3Config } from './settings';

/** BlockNote's upload callback: takes a file, returns a public URL to it. */
export type UploadFile = (file: File) => Promise<string>;

/** A collision-resistant, reasonably readable object key under a `today/` prefix. */
function objectKey(name: string): string {
  const safe =
    name
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(-80) || 'file';
  return `today/${crypto.randomUUID()}-${safe}`;
}

/**
 * Build an upload function that PUTs a file straight to an S3-compatible store
 * (R2, S3, MinIO, …), signing the request in the browser with SigV4. Returns
 * the file's stable public URL, built from the configured public base URL — so
 * the markdown that BlockNote stores keeps resolving.
 */
export function createUploadFile(config: S3Config): UploadFile {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region,
    service: 's3',
  });
  // Normalise here too: the Options form may pass an endpoint/public URL with a
  // trailing slash (or a bucket with stray slashes), which would otherwise
  // produce a bad `host//bucket/key` URL.
  const endpoint = config.endpoint.replace(/\/+$/, '');
  const bucket = config.bucket.replace(/^\/+|\/+$/g, '');
  const publicBaseUrl = config.publicBaseUrl.replace(/\/+$/, '');

  return async (file: File): Promise<string> => {
    const key = objectKey(file.name);
    let res: Response;
    try {
      res = await client.fetch(`${endpoint}/${bucket}/${key}`, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
    } catch {
      // A CORS-blocked or unreachable endpoint rejects before any response.
      throw new Error(
        "Could not reach the bucket. This is almost always CORS — add this extension's origin " +
          'to the bucket CORS policy (AllowedOrigins) with PUT allowed, then retry.',
      );
    }
    if (!res.ok) {
      throw new Error(
        `Upload failed (${res.status} ${res.statusText}). Check the bucket name and credentials.`,
      );
    }
    return `${publicBaseUrl}/${key}`;
  };
}

/** An upload function if an object store is configured, otherwise null. */
export async function getUploadFile(): Promise<UploadFile | null> {
  const config = await getS3Config();
  return config ? createUploadFile(config) : null;
}

/**
 * Upload a tiny probe file to verify credentials + CORS from the Options page.
 * Returns the public URL on success; throws with a usable message on failure.
 */
export async function testUpload(config: S3Config): Promise<string> {
  const upload = createUploadFile(config);
  const file = new File(['today upload test'], 'today-upload-test.txt', {
    type: 'text/plain',
  });
  return upload(file);
}
