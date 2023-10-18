import { Column, ColumnType, Index, IndexedColumn, Schema, Table } from '@journeyapps/powersync-sdk-react-native';

export const TODO_TABLE = 'todos';
export const LIST_TABLE = 'lists';
export const ATTACHMENT_TABLE = 'attachments';

export interface ListRecord {
  id: string;
  name: string;
  created_at: string;
  owner_id?: string;
}

export interface TodoRecord {
  id: string;
  created_at: string;
  completed: boolean;
  description: string;
  completed_at?: string;

  created_by: string;
  completed_by?: string;
  list_id: string;

  photo_id?: string;
}

export enum AttachmentState {
  QUEUED_SYNC = 0, // WIll check if the attachment needs to be uploaded or downloaded
  QUEUED_UPLOAD = 1,
  QUEUED_DOWNLOAD = 2,
  SYNCED = 3
}

export interface AttachmentRecord {
  id: string;
  filename: string;
  local_uri?: string;
  size?: number;
  media_type?: string;
  timestamp?: number;
  state: AttachmentState;
}

export const AppSchema = new Schema([
  new Table({
    name: 'todos',
    columns: [
      new Column({ name: 'list_id', type: ColumnType.TEXT }),
      new Column({ name: 'photo_id', type: ColumnType.TEXT }),
      new Column({ name: 'created_at', type: ColumnType.TEXT }),
      new Column({ name: 'completed_at', type: ColumnType.TEXT }),
      new Column({ name: 'description', type: ColumnType.TEXT }),
      new Column({ name: 'completed', type: ColumnType.INTEGER }),
      new Column({ name: 'created_by', type: ColumnType.TEXT }),
      new Column({ name: 'completed_by', type: ColumnType.TEXT })
    ],
    indexes: [
      new Index({
        name: 'list',
        columns: [new IndexedColumn({ name: 'list_id' })]
      })
    ]
  }),
  new Table({
    name: 'lists',
    columns: [
      new Column({ name: 'created_at', type: ColumnType.TEXT }),
      new Column({ name: 'name', type: ColumnType.TEXT }),
      new Column({ name: 'owner_id', type: ColumnType.TEXT })
    ]
  }),

  // Attachment table
  Table.createLocalOnly({
    name: 'attachments',
    columns: [
      new Column({ name: 'filename', type: ColumnType.TEXT }),
      new Column({ name: 'local_uri', type: ColumnType.TEXT }),
      new Column({ name: 'timestamp', type: ColumnType.INTEGER }),
      new Column({ name: 'size', type: ColumnType.INTEGER }),
      new Column({ name: 'media_type', type: ColumnType.TEXT }),
      new Column({ name: 'state', type: ColumnType.INTEGER }) // Corresponds to AttachmentState
    ]
  })
]);
