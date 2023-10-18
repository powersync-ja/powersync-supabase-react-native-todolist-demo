import { SupabaseClient } from '@supabase/supabase-js';
import { AbstractStorageAdapter, BaseStorageAdapterOptions, UploadOptions } from '../storage/AbstractStorageAdapter';

export interface SupabaseStorageAdapterOptions extends BaseStorageAdapterOptions {
  client: SupabaseClient;
}

export class SupabaseStorageAdapter extends AbstractStorageAdapter<SupabaseStorageAdapterOptions> {
  static BUCKET_NAME = 'media';

  constructor(options: SupabaseStorageAdapterOptions) {
    super(options);
  }

  async uploadFile(filename: string, data: ArrayBuffer, options: UploadOptions): Promise<void> {
    const res = await this.options.client.storage
      .from(SupabaseStorageAdapter.BUCKET_NAME)
      .upload(filename, data, { contentType: options.mediaType });

    if (res.error) {
      throw res.error;
    }
  }

  async downloadFile(filePath: string) {
    const { data, error } = await this.options.client.storage
      .from(SupabaseStorageAdapter.BUCKET_NAME)
      .download(filePath);

    if (error) {
      throw error;
    }

    return data as Blob;
  }

  async deleteFile(filename: string, uri?: string): Promise<void> {
    await super.deleteFile(filename, uri);

    const { data, error } = await this.options.client.storage
      .from(SupabaseStorageAdapter.BUCKET_NAME)
      .remove([filename]);

    if (error) {
      console.debug('Failed to delete file from storage', error);
    }

    console.debug('Deleted file from storage', data);
  }
}
