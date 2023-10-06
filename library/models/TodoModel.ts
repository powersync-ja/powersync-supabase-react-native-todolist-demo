import _ from "lodash";
import {action, makeObservable, observable} from "mobx";
import {AbstractModel, ModelRecord} from "./AbstractModel";
import {Transaction} from "@journeyapps/powersync-sdk-react-native";
import {CameraCapturedPicture} from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import {v4 as uuid} from 'uuid'
import {System} from "../stores/system";

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
        makeObservable(this, {
            record: observable,
            update: action
        });
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
        if (this.record.photo_id) {
            await this.system.attachmentQueue.delete(this.record.photo_id);
        }
        await tx.executeAsync(
            `DELETE
                       FROM ${this.table}
                   WHERE id = ?`,
            [this.id]
        );
        this.system.todoStore.removeModel(this);
    }

    async savePhoto(data: CameraCapturedPicture) {

        const photoId = uuid();
        const newPhotoUri = this.getPhotoUri(photoId);

        await this.update({
            photo_id: photoId
        });

        const {exists} = await FileSystem.getInfoAsync(TODO_LOCAL_STORAGE_PATH)
        if (!exists) {
            await FileSystem.makeDirectoryAsync(TODO_LOCAL_STORAGE_PATH, {intermediates: true})
        }

        //Copy photo from temp to local storage
        await FileSystem.copyAsync({from: data.uri, to: newPhotoUri!});

        //Enqueue attachment
        await this.system.attachmentQueue.enqueue({id: photoId, localUri: newPhotoUri!});
    }

    getPhotoUri(id?: string): string {
        if (!id && !this.record.photo_id) {
            throw new Error('No photo id specified');
        }
        const photoId = id || this.record.photo_id;
        return `${TODO_LOCAL_STORAGE_PATH}/${photoId}.jpg`;
    }
}
