import * as React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, View } from 'react-native';
import { FAB } from 'react-native-elements';
import prompt from 'react-native-prompt-android';

import { Stack } from 'expo-router';
import { LIST_TABLE, ListRecord } from '../../../library/powersync/AppSchema';
import { useSystem } from '../../../library/powersync/system';
import { usePowerSyncWatchedQuery } from '@journeyapps/powersync-sdk-react-native';
import { SmartListItemWidget } from '../../../library/widgets/smart/SmartListItemWidget';

const ListsViewWidget: React.FC = () => {
  const system = useSystem();
  const listRecords = usePowerSyncWatchedQuery<ListRecord>(`SELECT * from ${LIST_TABLE}`);

  const createNewList = async (name: string) => {
    const { userID } = await system.supabaseConnector.fetchCredentials();

    const res = await system.powersync.execute(
      `INSERT INTO ${LIST_TABLE} (id, created_at, name, owner_id) VALUES (uuid(), datetime(), ?, ?) RETURNING *`,
      [name, userID]
    );

    const resultRecord = res.rows?.item(0);
    if (!resultRecord) {
      throw new Error('Could not create list');
    }
  };

  return (
    <View style={{ flex: 1, flexGrow: 1 }}>
      <Stack.Screen
        options={{
          headerShown: false
        }}
      />
      <FAB
        style={{ zIndex: 99, bottom: 0 }}
        icon={{ name: 'add', color: 'white' }}
        size="small"
        placement="right"
        onPress={() => {
          prompt(
            'Add a new list',
            '',
            async (name) => {
              if (!name) {
                return;
              }
              await createNewList(name);
            },
            { placeholder: 'List name', style: 'shimo' }
          );
        }}
      />
      <ScrollView key={'lists'} style={{ maxHeight: '90%' }}>
        {listRecords.map((r) => (
          <SmartListItemWidget key={r.id} record={r} />
        ))}
      </ScrollView>

      <StatusBar style={'light'} />
    </View>
  );
};

export default ListsViewWidget;
