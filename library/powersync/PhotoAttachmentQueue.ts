import * as FileSystem from 'expo-file-system';
import { v4 as uuid } from 'uuid';
import { AppConfig } from '../supabase/AppConfig';
import { AbstractAttachmentQueue, AttachmentRecord, AttachmentState } from '@journeyapps/powersync-attachments';
import { TODO_TABLE } from './AppSchema';

export class PhotoAttachmentQueue extends AbstractAttachmentQueue {
  async init() {
    if (!AppConfig.supabaseBucket) {
      console.debug('No Supabase bucket configured, skipping setting up PhotoAttachmentQueue watches');
      // Disable sync interval
      this.options.syncInterval = undefined;
      return;
    }

    await super.init();
  }

  async *attachmentIds(): AsyncIterable<string[]> {
    for await (const result of this.powersync.watch(
      `SELECT photo_id as id FROM ${TODO_TABLE} WHERE photo_id IS NOT NULL`,
      []
    )) {
      yield result.rows?._array.map((r) => r.id) ?? [];
    }
  }

  newAttachmentRecord(record?: Partial<AttachmentRecord>): AttachmentRecord {
    const photoId = record?.id ?? uuid();
    const filename = record?.filename ?? `${photoId}.jpg`;
    return {
      id: photoId,
      filename,
      media_type: 'image/jpeg',
      state: AttachmentState.QUEUED_UPLOAD,
      ...record
    };
  }

  async savePhoto(base64Data: string): Promise<AttachmentRecord> {
    const photoAttachment = this.newAttachmentRecord();
    photoAttachment.local_uri = this.getLocalUri(photoAttachment.filename);
    await this.storage.writeFile(photoAttachment.local_uri!, base64Data, { encoding: FileSystem.EncodingType.Base64 });

    const fileInfo = await FileSystem.getInfoAsync(photoAttachment.local_uri!);
    if (fileInfo.exists) {
      photoAttachment.size = fileInfo.size;
    }

    return this.saveToQueue(photoAttachment);
  }
}
