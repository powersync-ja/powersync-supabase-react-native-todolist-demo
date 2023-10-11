import '@azure/core-asynciterator-polyfill';
import 'react-native-polyfill-globals/auto';
import React from 'react';
import {configure, makeAutoObservable, makeObservable, observable} from 'mobx';

import {AbstractPowerSyncDatabase, RNQSPowerSyncDatabaseOpenFactory} from '@journeyapps/powersync-sdk-react-native';

import {AppSchema} from '../powersync/AppSchema';
import {AbstractStorageAdapter} from "../storage/AbstractStorageAdapter";
import {SupabaseConnector} from '../supabase/SupabaseConnector';
import {ListStore} from './ListStore';
import {TodoStore} from './TodoStore';
import {KVStorage} from '../storage/KVStorage';
import {AttachmentQueue} from '../attachments/AttachmentQueue';

configure({
    enforceActions: 'never' // TODO for when PowerSyncDatabase is more observable friendly
});

export class System {
    kvStorage: KVStorage;
    storage: AbstractStorageAdapter;
    supabaseConnector: SupabaseConnector;
    powersync: AbstractPowerSyncDatabase;

    listStore: ListStore;
    todoStore: TodoStore;
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

        this.attachmentQueue = new AttachmentQueue(this);

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


        // Make sure to only watch queries after PowerSync has been initialized as those tables
        // might not exist yet.
        this.listStore.init();
        this.todoStore.init();

        await this.attachmentQueue.init();
    }
}

export const system = new System();

// TODO remove
(window as any).__system = system;

export const SystemContext = React.createContext(system);
export const useSystem = () => React.useContext(SystemContext);
