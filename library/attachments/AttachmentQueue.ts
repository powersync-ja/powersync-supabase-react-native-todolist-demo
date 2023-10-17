import * as FileSystem from 'expo-file-system';
import { BaseListener, BaseObserver, Transaction } from '@journeyapps/powersync-sdk-react-native';
import { EncodingType } from 'expo-file-system';
import { UploadOptions } from '../storage/AbstractStorageAdapter';
import { System } from '../powersync/system';
import { AttachmentEntry, AttachmentRecord } from './Attachment';

export const ATTACHMENT_QUEUE_TABLE = 'attachments';
export const ATTACHMENT_LOCAL_STORAGE_KEY = 'attachments';
export const ATTACHMENT_STORAGE_PATH = `${FileSystem.documentDirectory}${ATTACHMENT_LOCAL_STORAGE_KEY}`;

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
    // this.watchUploads();
    // this.watchDownloads();
    // this.trigger();
  }

  get table() {
    return ATTACHMENT_QUEUE_TABLE;
  }

  trigger() {
    this.uploadLoop();
    this.downloadLoop();
  }

  async getEntry(id: string, tx: Transaction): Promise<AttachmentEntry | null> {
    const { rows } = await tx.executeAsync(
      `SELECT id, filename, local_uri, size, media_type FROM ${this.table} WHERE id = ?`,
      [id]
    );
    const row = rows?.item(0);
    return !!row
      ? {
          id: row.id,
          filename: row.filename,
          local_uri: row.local_uri,
          size: row.size,
          media_type: row.media_type
        }
      : null;
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
                queued = ?,
                synced = ?
             WHERE id = ?`,
      [
        timestamp,
        record.filename,
        record.local_uri,
        record.size,
        record.media_type,
        record.queued,
        record.synced,
        record.id
      ]
    );
  }

  async delete(id: string, tx: Transaction): Promise<void> {
    await tx.executeAsync(
      `DELETE
             FROM ${this.table}
             WHERE id = ?`,
      [id]
    );
  }

  clearQueue(): Promise<void> {
    return this.system.powersync.writeTransaction(async (tx) => {
      await tx.executeAsync(
        `DELETE
             FROM ${this.table}`
      );
    });
  }

  async saveToQueue(
    entry: AttachmentEntry,
    options: {
      queue?: boolean;
      sync?: boolean;
    } = {}
  ): Promise<AttachmentEntry> {
    const record: AttachmentRecord = {
      ...entry,
      timestamp: new Date().getTime(),
      queued: options.queue === false ? 0 : 1,
      synced: options.sync ? 1 : 0
    };

    await this.system.powersync.execute(
      `INSERT OR REPLACE INTO ${this.table} (id, timestamp, filename, local_uri, media_type, size, queued, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.timestamp,
        record.filename,
        record.local_uri,
        record.media_type || null,
        record.size || null,
        record.queued,
        record.synced
      ]
    );

    return record;
  }

  async getNextUploadEntry(): Promise<AttachmentEntry | null> {
    try {
      const row = await this.system.powersync.get<AttachmentRecord>(
        `SELECT id, filename, local_uri, size, media_type
                        FROM ${this.table} 
                        WHERE synced = 0 and queued = 1 ORDER BY timestamp ASC`
      );
      return row
        ? {
            id: row.id,
            filename: row.filename,
            local_uri: row.local_uri,
            size: row.size,
            media_type: row.media_type
          }
        : null;
    } catch (e) {
      // ResultSet empty
      return null;
    }
  }

  async getNextDownloadEntries(): Promise<AttachmentEntry[]> {
    const rows = await this.system.powersync.getAll<AttachmentRecord>(
      `SELECT id, filename, local_uri, size, media_type
                        FROM ${this.table} 
                        WHERE synced = 0 and queued = 0 ORDER BY timestamp ASC`
    );

    return rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      local_uri: row.local_uri,
      size: row.size,
      media_type: row.media_type
    }));
  }

  async uploadNext(): Promise<boolean> {
    const entry = await this.getNextUploadEntry();
    if (!entry) {
      return false;
    }
    return this.uploadEntry(entry);
  }

  async uploadEntry(entry: AttachmentEntry) {
    try {
      const fileBuffer = await this.system.storage.readFile(entry.local_uri, {
        encoding: EncodingType.Base64,
        mediaType: entry.media_type
      });

      const options: UploadOptions = {};
      if (entry.media_type) {
        options.mediaType = entry.media_type;
      }

      await this.system.storage.uploadFile(entry.filename, fileBuffer, options);
      // Mark as uploaded
      await this.update({ ...entry, queued: 0, synced: 1 });

      return true;
    } catch (e: any) {
      if (e.error == 'Duplicate') {
        console.log('File already uploaded, marking as synced');
        await this.update({ ...entry, queued: 0, synced: 1 });
        return false;
      }
      console.error(`uploadEntry::error for entry ${entry.filename}`, e);
      return false;
    }
  }

  async downloadEntry(entry: AttachmentEntry) {
    if (await this.system.storage.fileExists(entry.local_uri)) {
      console.log('File already downloaded, marking as synced');
      await this.update({ ...entry, queued: 0, synced: 1 });
      return true;
    }

    try {
      const fileBlob = await this.system.storage.downloadFile(entry.filename);

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

      await this.system.storage.makeDir(entry.local_uri.replace(entry.filename, ''));
      await this.system.storage.writeFile(entry.local_uri, base64Data, { encoding: EncodingType.Base64 });

      await this.update({ ...entry, queued: 0, synced: 1 });
      return true;
    } catch (e) {
      console.error(`downloadEntry::error for entry ${entry}`, e);
    }
    return false;
  }

  async *idsToUpload(): AsyncIterable<string[]> {
    for await (const result of this.system.powersync.watch(
      `SELECT id
                        FROM ${this.table} 
                        WHERE synced = 0 and queued = 1`,
      []
    )) {
      yield result.rows?._array.map((r) => r.id) || [];
    }
  }

  async watchUploads() {
    for await (const ids of this.idsToUpload()) {
      if (ids.length > 0) {
        console.log('UploadEntries', ids.length);
        await this.uploadLoop();
      }
    }
  }

  /**
   * Returns immediately if another loop is in progress.
   */
  private async uploadLoop() {
    if (this.uploading) {
      return;
    }
    this.uploading = true;
    try {
      while (true) {
        const uploaded = await this.uploadNext();
        if (!uploaded) {
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
                        WHERE synced = 0 and queued = 0`,
      []
    )) {
      yield result.rows?._array.map((r) => r.id) || [];
    }
  }

  async watchDownloads() {
    for await (const ids of this.idsToDownload()) {
      if (ids.length > 0) {
        await this.downloadLoop();
      }
    }
  }

  private async downloadLoop() {
    if (this.downloading) {
      return;
    }
    if (this.uploading) {
      console.log('Waiting for upload to complete');
      await new Promise<void>((resolve) => {
        const l = this.registerListener({
          onUploadComplete: () => {
            l();
            resolve();
          }
        });
      });
    }
    try {
      const entriesToDownload = await this.getNextDownloadEntries();
      console.log('DownloadEntries', entriesToDownload.length);
      for (const entry of entriesToDownload) {
        const success = await this.downloadEntry(entry);
        console.log('downloadEntry success', success, entry.local_uri);
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
