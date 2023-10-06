import {ModelRecord} from "../models/AbstractModel";
import {System} from "../stores/system";
import {AttachmentState} from "./AppSchema";

export interface AttachmentRecord extends ModelRecord {
    localUri: string;
    state?: AttachmentState
}

export interface AttachmentQueueOptions {
    system: System;
}

export const ATTACHMENT_QUEUE_TABLE = "upload_queue";

export class AttachmentQueue {
    constructor(protected options: AttachmentQueueOptions) {
    }

    get table() {
        return ATTACHMENT_QUEUE_TABLE;
    }

    async enqueue(record: AttachmentRecord): Promise<void> {
        record.state = record.state || AttachmentState.QUEUED;
        await this.options.system.powersync.execute(
            `INSERT INTO ${this.table} (id, local_uri, state) VALUES (?, ?, ?)`,
            [
                record.id,
                record.localUri,
                record.state
            ]
        );
    }

    async update(record: AttachmentRecord): Promise<void> {
        await this.options.system.powersync.execute(
            `UPDATE ${this.table}
             SET local_uri = ?,
             state = ?
             WHERE id = ?`,
            [record.localUri, record.state, record.id]
        );
    }

    async delete(id: string): Promise<void> {
        return this.options.system.powersync.writeTransaction(async (tx) => {
            await tx.executeAsync(
                `DELETE
             FROM ${this.table}
             WHERE id = ?`,
                [id]
            );
        });
    }

    clearQueue(): Promise<void> {
        return this.options.system.powersync.writeTransaction(async (tx) => {
            await tx.executeAsync(
                `DELETE
             FROM ${this.table}`
            );
        });
    }

}