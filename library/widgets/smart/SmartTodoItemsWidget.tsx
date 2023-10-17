import * as FileSystem from 'expo-file-system';
import React from 'react';
import { usePowerSync, usePowerSyncWatchedQuery } from '@journeyapps/powersync-sdk-react-native';
import { CameraCapturedPicture } from 'expo-camera';
import { v4 as uuid } from 'uuid';
import { TODO_TABLE, TodoRecord } from '../../powersync/AppSchema';
import { TodoItemWidget } from '../simple/TodoItemWidget';
import { useSystem } from '../../powersync/system';
import { AttachmentEntry } from '../../attachments/Attachment';

export const TODO_LOCAL_STORAGE_KEY = 'todo_photos';
export const TODO_LOCAL_STORAGE_PATH = `${FileSystem.documentDirectory}${TODO_LOCAL_STORAGE_KEY}`;

export interface SmartTodoItemsWidgetProps {
  id: string;
}

export const SmartTodoItemsWidget: React.FC<SmartTodoItemsWidgetProps> = (props) => {
  const system = useSystem();
  const powerSync = usePowerSync();

  const idParam = React.useMemo(() => {
    return [props.id];
  }, [props.id]);

  const todos = usePowerSyncWatchedQuery<TodoRecord>(`SELECT * from ${TODO_TABLE} WHERE list_id = ?`, idParam);

  const toggleCompletion = async (record: TodoRecord, completed: boolean) => {
    const updatedRecord = { ...record, completed: completed };
    if (completed) {
      const { userID } = await system.supabaseConnector.fetchCredentials();
      updatedRecord.completed_at = new Date().toISOString();
      updatedRecord.completed_by = userID;
    } else {
      updatedRecord.completed_at = undefined;
      updatedRecord.completed_by = undefined;
    }
    await powerSync.execute(
      `UPDATE ${TODO_TABLE}
            SET completed = ?,
                completed_at = ?,
                completed_by = ?
            WHERE id = ?`,
      [completed, updatedRecord.completed_at, updatedRecord.completed_by, record.id]
    );
  };

  const deleteTodo = async (record: TodoRecord) => {
    await powerSync.execute(`DELETE FROM ${TODO_TABLE} WHERE id = ?`, [record.id]);
  };

  const savePhoto = async (record: TodoRecord, data: CameraCapturedPicture) => {
    const photoId = uuid();
    const entry = await newPhotoEntry(photoId);

    await powerSync.execute(`UPDATE ${TODO_TABLE} SET photo_id = ? WHERE id = ?`, [photoId, record.id]);

    const { local_uri, filename } = entry;
    await system.storage.makeDir(local_uri.replace(filename, ''));
    //Copy photo from temp to local storage
    await system.storage.copyFile(data.uri, entry.local_uri!);

    console.log(`filename ${filename} copied to ${entry.local_uri}`);

    const fileInfo = await FileSystem.getInfoAsync(entry.local_uri!);
    if (fileInfo.exists) {
      entry.size = fileInfo.size;
    }

    //Enqueue attachment
    await system.attachmentQueue.saveToQueue(entry);
  };

  return (
    <>
      {todos.map((r) => {
        return (
          <TodoItemWidget
            key={r.id}
            record={r}
            onToggleCompletion={(completed) => toggleCompletion(r, completed)}
            onSavePhoto={(data) => savePhoto(r, data)}
            onDelete={() => deleteTodo(r)}
          />
        );
      })}
    </>
  );
};

export function buildPhotoUri(filename: string) {
  return `${TODO_LOCAL_STORAGE_PATH}/${filename}`;
}

export async function newPhotoEntry(photoId: string): Promise<AttachmentEntry> {
  const filename = `${photoId}.jpg`;
  const fileUri = buildPhotoUri(filename);

  return {
    id: photoId,
    filename,
    local_uri: fileUri!,
    media_type: 'image/jpeg'
  };
}
