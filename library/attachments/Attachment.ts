export interface AttachmentEntry {
  id: string;
  filename: string;
  local_uri: string;
  size?: number;
  media_type?: string;
}

export interface AttachmentRecord extends AttachmentEntry {
  timestamp: number;
  queued: number; // 0 = not queued, 1 = queued
  synced: number; // 0 = not synced, 1 = synced
}
