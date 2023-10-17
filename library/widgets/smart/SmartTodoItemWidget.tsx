import { usePowerSync, usePowerSyncWatchedQuery } from '@journeyapps/powersync-sdk-react-native';
import { CameraCapturedPicture } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as React from 'react';
import { v4 as uuid } from 'uuid';
import { ATTACHMENT_TABLE, AttachmentRecord, AttachmentState, TODO_TABLE, TodoRecord } from '../../powersync/AppSchema';
import { useSystem } from '../../powersync/system';
import { TodoItemWidget } from '../simple/TodoItemWidget';

export const TODO_LOCAL_STORAGE_KEY = 'todo_photos';
export const TODO_LOCAL_STORAGE_PATH = `${FileSystem.documentDirectory}${TODO_LOCAL_STORAGE_KEY}`;

export interface SmartTodoItemWidgetProps {
  record: TodoRecord;
}

export const SmartTodoItemWidget: React.FC<SmartTodoItemWidgetProps> = (props) => {
  const system = useSystem();
  const powerSync = usePowerSync();
  const { record } = props;

  const [photoRecord] = usePowerSyncWatchedQuery<AttachmentRecord>(`SELECT * FROM ${ATTACHMENT_TABLE} WHERE id = ?`, [
    record.photo_id || 'NO_ATTACHMENT'
  ]);

  React.useEffect(() => {
    (async () => {
      if (record.photo_id == null) {
        return;
      }
      if (photoRecord == null) {
        const newRecord = newPhotoRecord(record.photo_id);
        await system.attachmentQueue.saveToQueue(newRecord);
      } else {
        const fileExist = await system.storage.fileExists(photoRecord.local_uri);
        if (!fileExist) {
          await system.attachmentQueue.saveToQueue({ ...photoRecord, state: AttachmentState.QUEUED_DOWNLOAD });
        }
      }
    })();
  }, [record.photo_id, photoRecord]);

  const toggleCompletion = async (completed: boolean) => {
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

  const deleteTodo = async () => {
    await powerSync.writeTransaction(async (tx) => {
      if (photoRecord != null) {
        await system.attachmentQueue.delete(photoRecord, tx);
      }
      await tx.executeAsync(`DELETE FROM ${TODO_TABLE} WHERE id = ?`, [record.id]);
    });
  };

  const savePhoto = async (data: CameraCapturedPicture) => {
    const photoId = uuid();
    const entry = newPhotoRecord(photoId);

    const { local_uri, filename } = entry;
    await system.storage.makeDir(local_uri.replace(filename, ''));
    //Copy photo from temp to local storage
    await system.storage.copyFile(data.uri, entry.local_uri!);

    const fileInfo = await FileSystem.getInfoAsync(entry.local_uri!);
    if (fileInfo.exists) {
      entry.size = fileInfo.size;
    }
    //Enqueue attachment
    await system.attachmentQueue.saveToQueue(entry);

    await powerSync.execute(`UPDATE ${TODO_TABLE} SET photo_id = ? WHERE id = ?`, [photoId, record.id]);
  };

  return (
    <TodoItemWidget
      record={record}
      imageUri={photoRecord?.local_uri}
      onToggleCompletion={toggleCompletion}
      onSavePhoto={savePhoto}
      onDelete={deleteTodo}
    />
  );
};

export function buildPhotoUri(filename: string) {
  return `${TODO_LOCAL_STORAGE_PATH}/${filename}`;
}

export function newPhotoRecord(
  photoId: string,
  state: AttachmentState = AttachmentState.QUEUED_SYNC
): AttachmentRecord {
  const filename = `${photoId}.jpg`;

  return {
    id: photoId,
    filename,
    local_uri: buildPhotoUri(filename),
    media_type: 'image/jpeg',
    state
  };
}
