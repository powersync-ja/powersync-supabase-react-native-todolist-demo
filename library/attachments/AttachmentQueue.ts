import {Transaction} from "@journeyapps/powersync-sdk-react-native";
import {EncodingType} from "expo-file-system";
import {UploadOptions} from "../storage/AbstractStorageAdapter";
import {System} from "../stores/system";
import {AttachmentEntry, AttachmentRecord, AttachmentState} from "./Attachment";

export const ATTACHMENT_QUEUE_TABLE = "attachments";

export class AttachmentQueue {
    uploading: boolean;

    constructor(protected system: System) {
        this.uploading = false;
    }

    async init() {
        await this.clearQueue()
        this.watchQueue();
    }

    get table() {
        return ATTACHMENT_QUEUE_TABLE;
    }

    async* watchRecordsToBeSynced(): AsyncGenerator<AttachmentRecord[]> {
        for await (const update of this.system.powersync.watch(
            `SELECT * FROM ${this.table}
                    WHERE state < 2`, [])) {
            yield update.rows?._array.map((r) => {
                return {
                    id: r.id,
                    timestamp: r.timestamp,
                    filename: r.filename,
                    local_uri: r.local_uri,
                    media_type: r.media_type,
                    size: r.size,
                    state: r.state,
                }
            }) || []
        }
    }

    async getRecordsToBeSynced(): Promise<AttachmentRecord[]> {
        return this.system.powersync.getAll<AttachmentRecord>(`SELECT * FROM ${this.table}
                    WHERE state < 2`, [])
    }

    async enqueue(entry: AttachmentEntry): Promise<void> {
        const record = {...entry, state: AttachmentState.QUEUED};
        const timestamp = new Date().getTime();
        await this.system.powersync.execute(
            `INSERT OR REPLACE INTO ${this.table} (id, timestamp, filename, local_uri, media_type, size, state) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                record.id,
                timestamp,
                record.filename,
                record.local_uri,
                record.media_type || null,
                record.size || null,
                record.state,
            ]
        );
    }

    async uploadNext(): Promise<boolean> {
        const entry = await this.getNextQueuedEntry();
        if (!entry) {
            return false;
        }
        return this.uploadEntry(entry);
    }

    async uploadEntry(entry: AttachmentEntry) {
        if (!entry.local_uri) {
            return false;
        }
        try {
            const fileBuffer = await this.system.storage.readFile(entry.local_uri, {
                encoding: EncodingType.Base64,
                mediaType: entry.media_type
            });

            const options: UploadOptions = {}
            if (entry.media_type) {
                options.mediaType = entry.media_type
            }

            await this.system.storage.uploadFile(entry.filename, fileBuffer, options);
            // Mark as uploaded
            await this.update({...entry, state: AttachmentState.UPLOADED});

            return true;
        } catch (e) {
            console.error(`uploadEntry::error for entry ${entry}`, e);
            return false;
        }
    }

    async downloadEntry(entry: AttachmentEntry) {
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

            await this.system.storage.writeFile(entry.local_uri, base64Data, {encoding: EncodingType.Base64});

            return true;

        } catch (e) {
            console.error(`downloadEntry::error for entry ${entry}`, e);
        }
        return false
    }

    async getEntry(id: string, tx: Transaction): Promise<AttachmentEntry | null> {
        try {
            const {rows} = await tx.executeAsync(
                `SELECT id, filename, local_uri, media_type FROM ${this.table} WHERE id = ?`, [id]
            );
            const row = rows?.item(0);
            return !!row ? {
                    id: row.id,
                    filename: row.filename,
                    local_uri: row.local_uri,
                    size: row.size,
                    media_type: row.media_type,
                }
                : null;
        } catch (e) {
            // ResultSet empty
            return null;
        }
    }

    async getNextQueuedEntry(): Promise<AttachmentEntry | null> {
        try {
            const row = await this.system.powersync.get<AttachmentRecord>(
                `SELECT id, filename, local_uri, media_type 
                        FROM ${this.table} 
                        WHERE state = 0 ORDER BY timestamp ASC`
            );
            return row ? {
                    id: row.id,
                    filename: row.filename,
                    local_uri: row.local_uri,
                    size: row.size,
                    media_type: row.media_type,
                }
                : null;
        } catch (e) {
            // ResultSet empty
            return null;
        }
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


    async checkRecords(records: AttachmentRecord[]): Promise<void> {
        for (const record of records) {
            const fileExists = await this.system.storage.fileExists(record.local_uri)
            if (!fileExists) {
                const success = await this.downloadEntry(record);
            } else if (record.state === AttachmentState.UPLOADED) {
                await this.update({...record, state: AttachmentState.SYNCED})
            } else {
                await this.uploadEntry(record);
            }
        }
    }

    async watchQueue() {
        for await (const records of this.watchRecordsToBeSynced()) {
            await this.checkRecords(records);
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
        }
    }
}