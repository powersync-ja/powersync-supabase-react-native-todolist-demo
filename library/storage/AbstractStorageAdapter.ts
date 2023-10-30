import { decode as decodeBase64 } from 'base64-arraybuffer';

export enum EncodingType {
  UTF8 = 'utf8',
  Base64 = 'base64'
}

export interface BaseStorageAdapterOptions {}

export abstract class AbstractStorageAdapter<T extends BaseStorageAdapterOptions = BaseStorageAdapterOptions> {
  constructor(protected options: T) {}

  abstract uploadFile(filePath: string, data: ArrayBuffer, options?: { mediaType?: string }): Promise<void>;

  abstract downloadFile(filePath: string): Promise<Blob>;

  abstract writeFile(fileURI: string, base64Data: string, options?: { encoding?: EncodingType }): Promise<void>;

  abstract readFile(fileURI: string, options?: { encoding?: EncodingType; mediaType?: string }): Promise<ArrayBuffer>;

  abstract deleteFile(uri: string, options?: { filename?: string }): Promise<void>;

  abstract fileExists(fileURI: string): Promise<boolean>;

  abstract makeDir(uri: string): Promise<void>;

  abstract copyFile(sourceUri: string, targetUri: string): Promise<void>;

  /**
   * Returns the directory where user data is stored.
   * Should end with a '/'
   */
  abstract getUserStorageDirectory(): string;
}

export const stringToArrayBuffer = async (str: string): Promise<ArrayBuffer> => {
  const encoder = new TextEncoder();
  return encoder.encode(str).buffer;
};

/**
 * Converts a base64 string to an ArrayBuffer
 */
export const base64ToArrayBuffer = async (base64: string): Promise<ArrayBuffer> => {
  return decodeBase64(base64);
};
