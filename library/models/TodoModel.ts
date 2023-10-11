import {Transaction} from "@journeyapps/powersync-sdk-react-native";
import {CameraCapturedPicture} from 'expo-camera';
import * as FileSystem from "expo-file-system";
import _ from "lodash";
import {v4 as uuid} from 'uuid'
import {AttachmentEntry} from "../attachments/Attachment";
import {System} from "../stores/system";
import {AbstractModel, ModelRecord} from "./AbstractModel";

export interface TodoRecord extends ModelRecord {
    created_at: string;
    completed: boolean;
    description: string;
    completed_at?: string;

    created_by: string;
    completed_by?: string;
    list_id: string;

    photo_id?: string;
}

export const TODO_TABLE = "todos";
export const TODO_LOCAL_STORAGE_KEY = "todo_photos";
export const TODO_LOCAL_STORAGE_PATH = `${FileSystem.documentDirectory}${TODO_LOCAL_STORAGE_KEY}`;

export class TodoModel extends AbstractModel<TodoRecord> {

    constructor(public record: TodoRecord, protected system: System) {
        super(record, system);
        this.checkPhoto();
    }

    get table() {
        return TODO_TABLE;
    }

    async update(record: Partial<TodoRecord>): Promise<void> {
        const updatedRecord = _.merge(this.record, record);
        await this.system.powersync.execute(
            `UPDATE ${this.table}
             SET created_at = ?,
                 completed = ?,
                 completed_at = ?,
                 description = ?,
                 created_by = ?,
                 completed_by = ?,
                 list_id = ?,
                 photo_id = ?
             WHERE id = ?`,
            [
                updatedRecord.created_at,
                updatedRecord.completed,
                updatedRecord.completed_at,
                updatedRecord.description,
                updatedRecord.created_by,
                updatedRecord.completed_by,
                updatedRecord.list_id,
                updatedRecord.photo_id,
                this.id,
            ]
        );
        this.record = updatedRecord;
    }

    async toggleCompletion(completed: boolean) {
        const updatedRecord: Partial<TodoRecord> = {
            completed,
        }
        if (completed) {
            const {userID} = await this.system.supabaseConnector.fetchCredentials();
            updatedRecord.completed_at = new Date().toISOString();
            updatedRecord.completed_by = userID
        }

        return this.update(updatedRecord);
    }

    async _delete(tx: Transaction): Promise<void> {
        await tx.executeAsync(
            `DELETE
                       FROM ${this.table}
                   WHERE id = ?`,
            [this.id]
        );
        await this.deletePhoto(tx);
        this.system.todoStore.removeModel(this);
    }

    async deletePhoto(tx?: Transaction) {
        const {photo_id} = this.record;
        if (!photo_id) {
            return;
        }
        const _deletePhoto = async (tx: Transaction) => {
            const photoRecord = await this.system.attachmentQueue.getEntry(photo_id, tx);
            if (photoRecord) {
                await this.system.attachmentQueue.delete(photo_id, tx);
                await this.system.storage.deleteFile(photoRecord.local_uri)
                //todo delete from supabase
            }
        }
        if (tx) {
            return _deletePhoto(tx)
        }
        return this.system.powersync.writeTransaction((tx) => _deletePhoto(tx));
    }

    async savePhoto(data: CameraCapturedPicture) {
        const photoId = uuid();
        const filename = `${photoId}.jpg`;

        const entry: AttachmentEntry = {
            id: photoId,
            filename,
            local_uri: this.getPhotoUri(filename)!,
            media_type: "image/jpeg"
        }

        await this.update({
            photo_id: photoId
        });

        await this.system.storage.makeDir(TODO_LOCAL_STORAGE_PATH);
        //Copy photo from temp to local storage
        await this.system.storage.copyFile(data.uri, entry.local_uri!);

        const fileInfo = await FileSystem.getInfoAsync(entry.local_uri!);
        if (fileInfo.exists) {
            entry.size = fileInfo.size;
        } else {
            throw new Error(`File does not exist: ${entry.local_uri}`)
        }

        //Enqueue attachment
        await this.system.attachmentQueue.enqueue(entry);
    }

    getPhotoUri(filename?: string): string | null {
        if (!filename) {
            if (this.record.photo_id) {
                filename = `${this.record.photo_id}.jpg`;
            } else {
                return null;
            }
        }
        return `${TODO_LOCAL_STORAGE_PATH}/${filename}`;
    }

    async checkPhoto() {
        const photoId = this.record.photo_id;
        if (!photoId) {
            return;
        }

        const filename = `${photoId}.jpg`;
        const photoUri = this.getPhotoUri(filename);
        if (await this.system.storage.fileExists(photoUri!)) {
            return;
        }
        await this.system.storage.makeDir(TODO_LOCAL_STORAGE_PATH);
        
        await this.system.attachmentQueue.enqueue({
            id: photoId,
            filename,
            local_uri: photoUri!,
            media_type: "image/jpeg"
        });
    }
}
