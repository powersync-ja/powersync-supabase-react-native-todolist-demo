import { decode as decodeBase64 } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';

export interface BaseStorageAdapterOptions {}

export interface UploadOptions {
  mediaType?: string;
}

export abstract class AbstractStorageAdapter<T extends BaseStorageAdapterOptions = BaseStorageAdapterOptions> {
  constructor(protected options: T) {}

  abstract uploadFile(filePath: string, data: ArrayBuffer, options?: UploadOptions): Promise<void>;

  abstract downloadFile(filePath: string): Promise<Blob>;

  async writeFile(
    fileURI: string,
    base64Data: string,
    options: {
      encoding: FileSystem.EncodingType;
    }
  ): Promise<void> {
    await FileSystem.writeAsStringAsync(fileURI, base64Data, options);
  }

  async readFile(
    fileURI: string,
    options: { encoding: FileSystem.EncodingType; mediaType?: string }
  ): Promise<ArrayBuffer> {
    const { exists } = await FileSystem.getInfoAsync(fileURI);
    if (!exists) {
      throw new Error(`File does not exist: ${fileURI}`);
    }
    const fileContent = await FileSystem.readAsStringAsync(fileURI, options);
    if (options.encoding === FileSystem.EncodingType.Base64) {
      return base64ToArrayBuffer(fileContent);
    }
    return stringToArrayBuffer(fileContent);
  }

  async fileExists(fileURI: string): Promise<boolean> {
    const { exists } = await FileSystem.getInfoAsync(fileURI);
    return exists;
  }

  async makeDir(uri: string): Promise<void> {
    const { exists } = await FileSystem.getInfoAsync(uri);
    if (!exists) {
      await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
    }
  }

  async copyFile(sourceUri: string, targetUri: string): Promise<void> {
    await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
  }

  async deleteFile(filename: string, uri?: string): Promise<void> {
    if (!uri) {
      return;
    }
    if (await this.fileExists(uri)) {
      await FileSystem.deleteAsync(uri);
    }
  }
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
