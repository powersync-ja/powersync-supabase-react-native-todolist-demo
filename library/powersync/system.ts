import '@azure/core-asynciterator-polyfill';
import 'react-native-polyfill-globals/auto';
import React from 'react';
import { AbstractPowerSyncDatabase, RNQSPowerSyncDatabaseOpenFactory } from '@journeyapps/powersync-sdk-react-native';

import { AppSchema, TODO_TABLE } from './AppSchema';
import { AbstractStorageAdapter } from '../storage/AbstractStorageAdapter';
import { SupabaseConnector } from '../supabase/SupabaseConnector';
import { KVStorage } from '../storage/KVStorage';
import { AttachmentQueue } from './AttachmentQueue';

export class System {
  kvStorage: KVStorage;
  storage: AbstractStorageAdapter;
  supabaseConnector: SupabaseConnector;
  powersync: AbstractPowerSyncDatabase;

  attachmentQueue: AttachmentQueue;

  constructor() {
    this.kvStorage = new KVStorage();
    const factory = new RNQSPowerSyncDatabaseOpenFactory({
      schema: AppSchema,
      dbFilename: 'sqlite.db'
    });

    this.supabaseConnector = new SupabaseConnector(this);
    this.storage = this.supabaseConnector.storage;
    this.powersync = factory.getInstance();

    this.attachmentQueue = new AttachmentQueue({
      powersync: this.powersync,
      storage: this.storage,
      getAttachmentIds: async () => {
        const res = await this.powersync.execute(`SELECT photo_id
                                          FROM
                                            ${TODO_TABLE}
                                          WHERE
                                            photo_id IS NOT NULL`);
        return res.rows?._array.map((r) => r.photo_id) || [];
      }
    });
  }

  async init() {
    await this.powersync.init();
    await this.powersync.connect(this.supabaseConnector);

    await this.attachmentQueue.init();
  }
}

export const system = new System();

export const SystemContext = React.createContext(system);
export const useSystem = () => React.useContext(SystemContext);
