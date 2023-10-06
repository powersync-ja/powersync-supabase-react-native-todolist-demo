import {SupabaseClient} from "@supabase/supabase-js";
import {FileOptions} from "@supabase/storage-js";
import {decode} from 'base64-arraybuffer'

export interface SupabaseStorageAdapterOptions {
    supabaseClient: SupabaseClient;
    storageBucket?: string;
}

export class SupabaseStorageAdapter {
    static BUCKET_NAME = 'media';
    options: SupabaseStorageAdapterOptions

    constructor(options: SupabaseStorageAdapterOptions) {
        this.options = {storageBucket: SupabaseStorageAdapter.BUCKET_NAME, ...options};
    }

    async uploadFile(filename: string, data: ArrayBuffer, options: {
        bucket?: string,
        fileOptions?: FileOptions
    } = {}): Promise<boolean> {
        const bucket = options.bucket ?? this.options.storageBucket!;
        const res = await this.options.supabaseClient
            .storage
            .from(bucket)
            .upload(filename, data, options.fileOptions)

        if (res.error) {
            console.error('Error uploading file', res.error);
            return false;
        }
        return true;
    }

    /**
     * Converts a base64 string to an ArrayBuffer
     */
    toArrayBuffer(base64: string): ArrayBuffer {
        return decode(base64);
    }

}