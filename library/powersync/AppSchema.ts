import {
    Column,
    ColumnType,
    Index,
    IndexedColumn,
    Schema,
    Table,
} from "@journeyapps/powersync-sdk-react-native";

export const AppSchema = new Schema([
    new Table({
        name: "todos",
        columns: [
            new Column({name: "list_id", type: ColumnType.TEXT}),
            new Column({name: "photo_id", type: ColumnType.TEXT}),
            new Column({name: "created_at", type: ColumnType.TEXT}),
            new Column({name: "completed_at", type: ColumnType.TEXT}),
            new Column({name: "description", type: ColumnType.TEXT}),
            new Column({name: "completed", type: ColumnType.INTEGER}),
            new Column({name: "created_by", type: ColumnType.TEXT}),
            new Column({name: "completed_by", type: ColumnType.TEXT}),
        ],
        indexes: [
            new Index({
                name: "list",
                columns: [new IndexedColumn({name: "list_id"})],
            }),
        ],
    }),
    new Table({
        name: "lists",
        columns: [
            new Column({name: "created_at", type: ColumnType.TEXT}),
            new Column({name: "name", type: ColumnType.TEXT}),
            new Column({name: "owner_id", type: ColumnType.TEXT}),
        ],
    }),

    // Attachment table
    Table.createLocalOnly({
        name: "upload_queue",
        columns: [
            new Column({name: "filename", type: ColumnType.TEXT}),
            new Column({name: "local_uri", type: ColumnType.TEXT}),
            new Column({name: "size", type: ColumnType.INTEGER}),
            new Column({name: "state", type: ColumnType.INTEGER}), // This integer will be mapped to AttachmentState
            new Column({name: "timestamp", type: ColumnType.INTEGER}),
            new Column({name: "media_type", type: ColumnType.TEXT}),
        ],
    })
]);
