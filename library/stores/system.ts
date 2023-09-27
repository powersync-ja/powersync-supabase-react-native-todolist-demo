import '@azure/core-asynciterator-polyfill';
import 'react-native-polyfill-globals/auto';
import React from 'react';
import { configure, makeAutoObservable, makeObservable, observable } from 'mobx';

import { AbstractPowerSyncDatabase } from '@journeyapps/powersync-sdk-react-native';
import { RNQSPowerSyncDatabaseOpenFactory } from '@journeyapps/powersync-react-native-quick-sqlite-adapter';

import { AppSchema } from '../powersync/AppSchema';
import { SupabaseConnector } from '../supabase/SupabaseConnector';
import { ListStore } from './ListStore';
import { TodoStore } from './TodoStore';

configure({
  enforceActions: 'never' // TODO for when PowerSyncDatabase is more observable friendly
});

export class System {
  supabaseConnector: SupabaseConnector;
  powersync: AbstractPowerSyncDatabase;

  listStore: ListStore;
  todoStore: TodoStore;

  constructor() {
    const factory = new RNQSPowerSyncDatabaseOpenFactory({
      schema: AppSchema,
      dbName: 'sqliteDB',
      dbPath: 'sqliteDB.db'
    });

    this.supabaseConnector = new SupabaseConnector();
    this.powersync = factory.getInstance();

    this.listStore = new ListStore(this);
    this.todoStore = new TodoStore(this);

    makeObservable(this.powersync, {
      currentStatus: observable,
      closed: observable
    });
    makeAutoObservable(this);
  }

  async init() {
    await this.powersync.init();
    await this.powersync.connect(this.supabaseConnector);
  }
}

export const system = new System();

export const SystemContext = React.createContext(system);
export const useSystem = () => React.useContext(SystemContext);
