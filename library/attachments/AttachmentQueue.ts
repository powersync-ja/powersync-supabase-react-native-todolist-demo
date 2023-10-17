import { BaseListener, BaseObserver, Transaction } from '@journeyapps/powersync-sdk-react-native';
import * as FileSystem from 'expo-file-system';
import { EncodingType } from 'expo-file-system';
import { ATTACHMENT_TABLE, AttachmentRecord, AttachmentState } from '../powersync/AppSchema';
import { System } from '../powersync/system';
import { UploadOptions } from '../storage/AbstractStorageAdapter';

export const ATTACHMENT_LOCAL_STORAGE_KEY = 'attachments';
export const ATTACHMENT_STORAGE_PATH = `${FileSystem.documentDirectory}${ATTACHMENT_LOCAL_STORAGE_KEY}`;
const ATTACHMENT_QUEUE_INTERVAL = 60_000;

export interface AttachmentQueueListener extends BaseListener {
  onUploadComplete: () => any;
  onDownloadComplete: () => any;
}

export class AttachmentQueue extends BaseObserver<AttachmentQueueListener> {
  uploading: boolean;
  downloading: boolean;

  constructor(protected system: System) {
    super();
    this.uploading = false;
    this.downloading = false;
  }

  async init() {
    // await this.clearQueue();
    this.watchUploads();
    this.watchDownloads();
    this.trigger();

    setInterval(() => this.trigger(), ATTACHMENT_QUEUE_INTERVAL);
  }

  get table() {
    return ATTACHMENT_TABLE;
  }

  trigger() {
    this.uploadRecords();
    this.downloadRecords();
  }

  async saveToQueue(record: Omit<AttachmentRecord, 'timestamp'>): Promise<AttachmentRecord> {
    const updatedRecord: AttachmentRecord = {
      ...record,
      timestamp: new Date().getTime()
    };

    await this.system.powersync.execute(
      `INSERT OR REPLACE INTO ${this.table} (id, timestamp, filename, local_uri, media_type, size, state) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        updatedRecord.id,
        updatedRecord.timestamp,
        updatedRecord.filename,
        updatedRecord.local_uri,
        updatedRecord.media_type || null,
        updatedRecord.size || null,
        updatedRecord.state
      ]
    );

    return updatedRecord;
  }

  async update(record: Omit<AttachmentRecord, 'timestamp'>): Promise<void> {
    const timestamp = new Date().getTime();
    await this.system.powersync.execute(
      `UPDATE ${this.table}
             SET 
                timestamp = ?,
                filename = ?,
                local_uri = ?,
                size = ?,
                media_type = ?,
                state = ?
             WHERE id = ?`,
      [timestamp, record.filename, record.local_uri, record.size, record.media_type, record.state, record.id]
    );
  }

  async getAttachment(id: string): Promise<AttachmentRecord | null> {
    return this.system.powersync.getOptional<AttachmentRecord>(`SELECT * FROM ${this.table} WHERE id = ?`, [id]);
  }

  async delete(id: string, tx: Transaction): Promise<void> {
    await tx.executeAsync(
      `DELETE
             FROM ${this.table}
             WHERE id = ?`,
      [id]
    );

    // TODO: delete file on storage
  }

  clearQueue(): Promise<void> {
    return this.system.powersync.writeTransaction(async (tx) => {
      await tx.executeAsync(
        `DELETE
             FROM ${this.table}`
      );
    });
  }

  async getNextUploadRecord(): Promise<AttachmentRecord | null> {
    return this.system.powersync.getOptional<AttachmentRecord>(
      `SELECT id, filename, local_uri, size, media_type
                FROM ${this.table} 
                WHERE state = ${AttachmentState.QUEUED_UPLOAD} OR state = ${AttachmentState.QUEUED_SYNC} 
                ORDER BY timestamp ASC`
    );
  }

  async getNextDownloadRecords(): Promise<AttachmentRecord[]> {
    return this.system.powersync.getAll<AttachmentRecord>(
      `SELECT id, filename, local_uri, size, media_type
                FROM ${this.table} 
                WHERE state = ${AttachmentState.QUEUED_DOWNLOAD} OR state = ${AttachmentState.QUEUED_SYNC}
                ORDER BY timestamp ASC`
    );
  }

  async uploadAttachment(record: AttachmentRecord) {
    try {
      const fileBuffer = await this.system.storage.readFile(record.local_uri, {
        encoding: EncodingType.Base64,
        mediaType: record.media_type
      });

      const options: UploadOptions = {};
      if (record.media_type) {
        options.mediaType = record.media_type;
      }

      await this.system.storage.uploadFile(record.filename, fileBuffer, options);
      // Mark as uploaded
      await this.update({ ...record, state: AttachmentState.SYNCED });

      return true;
    } catch (e: any) {
      if (e.error == 'Duplicate') {
        console.log('File already uploaded, marking as synced');
        await this.update({ ...record, state: AttachmentState.SYNCED });
        return false;
      }
      console.error(`UploadAttachment error for record ${JSON.stringify(record, null, 2)}`, e);
      return false;
    }
  }

  async downloadRecord(record: AttachmentRecord) {
    if (await this.system.storage.fileExists(record.local_uri)) {
      console.log('File already downloaded, marking as synced');
      await this.update({ ...record, state: AttachmentState.SYNCED });
      return true;
    }

    try {
      const fileBlob = await this.system.storage.downloadFile(record.filename);

      // Convert the blob data into a base64 string
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // remove the header from the result: 'data:*/*;base64,'
          resolve(reader.result?.toString().replace(/^data:.+;base64,/, '') || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(fileBlob);
      });

      await this.system.storage.makeDir(record.local_uri.replace(record.filename, ''));
      await this.system.storage.writeFile(record.local_uri, base64Data, { encoding: EncodingType.Base64 });

      await this.update({ ...record, state: AttachmentState.SYNCED });
      return true;
    } catch (e) {
      console.error(`Download attachment error for record ${JSON.stringify(record, null, 2)}`, e);
    }
    return false;
  }

  async *idsToUpload(): AsyncIterable<string[]> {
    for await (const result of this.system.powersync.watch(
      `SELECT id
              FROM ${this.table} 
              WHERE 
                  state = ${AttachmentState.QUEUED_UPLOAD} OR state = ${AttachmentState.QUEUED_SYNC}`,
      []
    )) {
      yield result.rows?._array.map((r) => r.id) || [];
    }
  }

  async watchUploads() {
    for await (const ids of this.idsToUpload()) {
      if (ids.length > 0) {
        console.log('Records to upload = ', ids.length);
        await this.uploadRecords();
      }
    }
  }

  /**
   * Returns immediately if another loop is in progress.
   */
  private async uploadRecords() {
    if (this.uploading) {
      return;
    }
    this.uploading = true;
    try {
      while (true) {
        const record = await this.getNextUploadRecord();
        if (!record) {
          break;
        }
        const uploaded = await this.uploadAttachment(record);
        if (!uploaded) {
          // TODO: we need to retry
          break;
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      this.uploading = false;
      this.iterateListeners((cb) => cb.onUploadComplete?.());
    }
  }

  async *idsToDownload(): AsyncIterable<string[]> {
    for await (const result of this.system.powersync.watch(
      `SELECT id
              FROM ${this.table} 
              WHERE state = ${AttachmentState.QUEUED_DOWNLOAD} OR state = ${AttachmentState.QUEUED_SYNC}`,
      []
    )) {
      yield result.rows?._array.map((r) => r.id) || [];
    }
  }

  async watchDownloads() {
    for await (const ids of this.idsToDownload()) {
      if (ids.length > 0) {
        console.log('Records to download = ', ids.length);
        await this.downloadRecords();
      }
    }
  }

  private async downloadRecords() {
    if (this.downloading) {
      return;
    }
    try {
      const recordsToDownload = await this.getNextDownloadRecords();
      if (recordsToDownload.length == 0) {
        return;
      }
      for (const record of recordsToDownload) {
        const success = await this.downloadRecord(record);
        console.log('Download success = ', success);
      }
    } catch (e) {
      console.error('Downloads failed:', e);
    } finally {
      this.downloading = false;
      this.iterateListeners((cb) => cb.onDownloadComplete?.());
    }
  }

  getLocalUri(filename: string): string {
    return `${ATTACHMENT_STORAGE_PATH}/${filename}`;
  }
}
