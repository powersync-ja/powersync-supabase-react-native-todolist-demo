import {decode as decodeBase64} from "base64-arraybuffer";
import * as FileSystem from "expo-file-system";
import {cacheDirectory, EncodingType, writeAsStringAsync,} from 'expo-file-system';

export interface BaseStorageAdapterOptions {
}

export interface StorageOptions {
    bucket?: string;
}

export interface UploadOptions extends StorageOptions {
    mediaType?: string;
}

export abstract class AbstractStorageAdapter<T extends BaseStorageAdapterOptions = BaseStorageAdapterOptions> {

    constructor(protected options: T) {
    }

    abstract uploadFile(filePath: string, data: ArrayBuffer, options?: UploadOptions): Promise<void>;

    abstract downloadFile(filePath: string, options?: StorageOptions): Promise<Blob>;

    async writeFile(fileURI: string, data: Blob, options: {
        encoding: EncodingType
    }): Promise<void> {
        const content = await data.text();

        // TODO: Check if target filePath is external and has permissions
        return writeAsStringAsync(fileURI, content, options)
    }

    async writeFileToCache(filename: string, data: Blob, options: {
        encoding: EncodingType
        dirName?: string,
    }): Promise<void> {
        const uri = `${cacheDirectory}${options.dirName ?? ''}${filename}`;
        return this.writeFile(uri, data, options);
    }

    async readFile(fileURI: string, options: { encoding: EncodingType, mediaType?: string }): Promise<ArrayBuffer> {
        const {exists} = await FileSystem.getInfoAsync(fileURI)
        if (!exists) {
            throw new Error(`File does not exist: ${fileURI}`)
        }
        const fileContent = await FileSystem.readAsStringAsync(fileURI, options);
        if (options.encoding === EncodingType.Base64) {
            return base64ToArrayBuffer(fileContent);
        }
        return stringToArrayBuffer(fileContent);
    }

    async makeDir(uri: string): Promise<void> {
        const {exists} = await FileSystem.getInfoAsync(uri)
        if (!exists) {
            await FileSystem.makeDirectoryAsync(uri, {intermediates: true})
        }
    }

    async copyFile(sourceUri: string, targetUri: string): Promise<void> {
        await FileSystem.copyAsync({from: sourceUri, to: targetUri});
    }

    async deleteFile(uri?: string): Promise<void> {
        if (uri == null) {
            return
        }
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists) {
            await FileSystem.deleteAsync(uri);
        }
    }
}

export const stringToArrayBuffer = async (str: string): Promise<ArrayBuffer> => {
    const encoder = new TextEncoder();
    return encoder.encode(str).buffer;
}

/**
 * Converts a base64 string to an ArrayBuffer
 */
export const base64ToArrayBuffer = async (base64: string): Promise<ArrayBuffer> => {
    return decodeBase64(base64);
}