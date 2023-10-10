import {SupabaseClient} from "@supabase/supabase-js";
import {
    AbstractStorageAdapter,
    BaseStorageAdapterOptions,
    StorageOptions,
    UploadOptions
} from "../storage/AbstractStorageAdapter";

export interface SupabaseStorageAdapterOptions extends BaseStorageAdapterOptions {
    client: SupabaseClient;
}

export class SupabaseStorageAdapter extends AbstractStorageAdapter<SupabaseStorageAdapterOptions> {
    static BUCKET_NAME = 'media';

    constructor(options: SupabaseStorageAdapterOptions) {
        super(options);
    }

    async uploadFile(filename: string, data: ArrayBuffer, options: UploadOptions): Promise<void> {
        const bucket = options.bucket ?? SupabaseStorageAdapter.BUCKET_NAME;

        const res = await this.options.client
            .storage
            .from(bucket)
            .upload(filename, data, {contentType: options.mediaType})

        if (res.error) {
            console.error('Error uploading file', res.error);
            return;
        }
    }

    async downloadFile(filePath: string, options?: StorageOptions): Promise<Blob> {
        const bucket = options?.bucket ?? SupabaseStorageAdapter.BUCKET_NAME;

        const {data, error} = await this.options.client
            .storage
            .from(bucket)
            .download(filePath)

        if (error) {
            console.error('Error downloading file', error);
            throw error;
        }

        return data
    }

}