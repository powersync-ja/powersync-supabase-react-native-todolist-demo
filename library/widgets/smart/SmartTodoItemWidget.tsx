import { usePowerSyncWatchedQuery } from '@journeyapps/powersync-sdk-react-native';
import { CameraCapturedPicture } from 'expo-camera';
import * as React from 'react';
import { ATTACHMENT_TABLE, AttachmentRecord, AttachmentState, TODO_TABLE, TodoRecord } from '../../powersync/AppSchema';
import { useSystem } from '../../powersync/system';
import { TodoItemWidget } from '../simple/TodoItemWidget';

export interface SmartTodoItemWidgetProps {
  record: TodoRecord;
}

export const SmartTodoItemWidget: React.FC<SmartTodoItemWidgetProps> = (props) => {
  const system = useSystem();
  const { record } = props;

  React.useEffect(() => {
    (async () => {
      if (record.photo_id == null) {
        return;
      }
      // We need to query the attachment table, as the usePowerSyncWatchedQuery might not have updated yet
      const photoRecordAsync = await system.attachmentQueue.getAttachmentRecord(record.photo_id);
      if (photoRecordAsync == null) {
        const newRecord = system.attachmentQueue.newPhotoRecord({
          id: record.photo_id,
          state: AttachmentState.QUEUED_SYNC
        });
        await system.attachmentQueue.saveToQueue(newRecord);
      } else {
        // If the photo is not in local storage, queue it for download
        if (photoRecordAsync.local_uri == null || !(await system.storage.fileExists(photoRecordAsync.local_uri))) {
          await system.attachmentQueue.saveToQueue({ ...photoRecordAsync, state: AttachmentState.QUEUED_DOWNLOAD });
        }
      }
    })();
  }, [record.photo_id]);

  const [photoRecord] = usePowerSyncWatchedQuery<AttachmentRecord>(`SELECT * FROM ${ATTACHMENT_TABLE} WHERE id = ?`, [
    record.photo_id || 'NO_ATTACHMENT'
  ]);

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
    await system.powersync.execute(
      `UPDATE ${TODO_TABLE}
            SET completed = ?,
                completed_at = ?,
                completed_by = ?
            WHERE id = ?`,
      [completed, updatedRecord.completed_at, updatedRecord.completed_by, record.id]
    );
  };

  const deleteTodo = async () => {
    await system.powersync.writeTransaction(async (tx) => {
      if (photoRecord != null) {
        await system.attachmentQueue.delete(photoRecord, tx);
      }
      await tx.executeAsync(`DELETE FROM ${TODO_TABLE} WHERE id = ?`, [record.id]);
    });
  };

  const savePhoto = async (data: CameraCapturedPicture) => {
    // We are sure the base64 is not null, as we are using the base64 option in the CameraWidget
    const { id: photoId } = await system.attachmentQueue.savePhoto(data.base64!);

    await system.powersync.execute(`UPDATE ${TODO_TABLE} SET photo_id = ? WHERE id = ?`, [photoId, record.id]);
  };

  return (
    <TodoItemWidget
      record={record}
      photoAttachment={photoRecord}
      onToggleCompletion={toggleCompletion}
      onSavePhoto={savePhoto}
      onDelete={deleteTodo}
    />
  );
};
