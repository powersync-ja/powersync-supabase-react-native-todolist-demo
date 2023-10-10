import {Transaction} from "@journeyapps/powersync-sdk-react-native";
import {EncodingType} from "expo-file-system";
import {UploadOptions} from "../storage/AbstractStorageAdapter";
import {System} from "../stores/system";
import {AttachmentEntry, AttachmentRecord, AttachmentState} from "./Attachment";

export const ATTACHMENT_QUEUE_TABLE = "upload_queue";

export class AttachmentQueue {
    uploading: any;

    constructor(protected system: System) {
    }

    async init() {
        this.uploadLoop()
    }

    get table() {
        return ATTACHMENT_QUEUE_TABLE;
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
                record.local_uri || null,
                record.media_type || null,
                record.size || null,
                record.state,
            ]
        );
    }

    async uploadNext(): Promise<boolean> {
        const entry = await this.getNextQueuedEntry();
        if (entry == null || !entry.local_uri) {
            return false;
        }
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
    }

    async getEntry(id: string): Promise<AttachmentEntry | null> {
        try {
            const row = await this.system.powersync.get<AttachmentRecord>(
                `SELECT id, filename, local_uri, media_type FROM ${this.table} WHERE id = ?`, [id]
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

    async getNextQueuedEntry(): Promise<AttachmentEntry | null> {
        try {
            const row = await this.system.powersync.get<AttachmentRecord>(
                `SELECT id, filename, local_uri, media_type FROM ${this.table} WHERE state = 0 ORDER BY timestamp ASC`
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