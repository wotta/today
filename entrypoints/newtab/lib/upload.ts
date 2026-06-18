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
  return async (file: File): Promise<string> => {
    const key = objectKey(file.name);
    const res = await client.fetch(`${config.endpoint}/${config.bucket}/${key}`, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
    if (!res.ok) {
      throw new Error(
        `Upload failed (${res.status} ${res.statusText}). Check the bucket name, ` +
          'credentials, and that the bucket CORS policy allows PUT from this extension.',
      );
    }
    return `${config.publicBaseUrl}/${key}`;
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
