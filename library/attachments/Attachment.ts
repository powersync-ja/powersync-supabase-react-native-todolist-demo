export enum AttachmentState {
    QUEUED = 0,
    UPLOADED = 1,
    SYNCED = 2,
}

export interface AttachmentEntry {
    id: string;
    filename: string;
    local_uri: string;
    size?: number;
    media_type?: string;
}

export interface AttachmentRecord extends AttachmentEntry {
    timestamp: number,
    state: AttachmentState;
}
