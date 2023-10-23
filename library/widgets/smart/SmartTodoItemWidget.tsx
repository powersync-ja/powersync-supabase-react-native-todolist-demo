import { usePowerSyncWatchedQuery } from '@journeyapps/powersync-sdk-react-native';
import { CameraCapturedPicture } from 'expo-camera';
import * as React from 'react';
import { ATTACHMENT_TABLE, AttachmentRecord, AttachmentState, TODO_TABLE, TodoRecord } from '../../powersync/AppSchema';
import { useSystem } from '../../powersync/system';
import { TodoItemWidget } from '../TodoItemWidget';

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

  return null;
};
