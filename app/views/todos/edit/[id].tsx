import { usePowerSync, usePowerSyncWatchedQuery } from '@journeyapps/powersync-sdk-react-native';
import * as React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, View, Text } from 'react-native';
import { FAB } from 'react-native-elements';
import { Stack, useLocalSearchParams } from 'expo-router';
import prompt from 'react-native-prompt-android';
import { LIST_TABLE, ListRecord, TODO_TABLE, TodoRecord } from '../../../../library/powersync/AppSchema';
import { SmartTodoItemsWidget } from '../../../../library/widgets/smart/SmartTodoItemsWidget';
import { useSystem } from '../../../../library/powersync/system';

const TodoView: React.FC = () => {
  const system = useSystem();
  const powerSync = usePowerSync();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const idParam = React.useMemo(() => {
    return [id];
  }, [id]);

  const [listRecord] = usePowerSyncWatchedQuery<ListRecord>(`SELECT * FROM ${LIST_TABLE} WHERE id = ?`, idParam);

  const createNewTodo = async (record: Pick<TodoRecord, 'description' | 'list_id'>) => {
    const { userID } = await system.supabaseConnector.fetchCredentials();

    await powerSync.execute(
      `INSERT INTO
              ${TODO_TABLE}
                  (id, created_at, created_by, description, list_id) 
              VALUES
                  (uuid(), datetime(), ?, ?, ?)`,
      [userID, record.description, record.list_id]
    );
  };

  if (!listRecord) {
    return (
      <View>
        <Text>No matching List found</Text>
      </View>
    );
  }

  return (
    <View key={`$edit-${id}`} style={{ flexGrow: 1 }}>
      <Stack.Screen
        options={{
          title: listRecord.name
        }}
      />
      <FAB
        style={{ zIndex: 99, bottom: 0 }}
        icon={{ name: 'add', color: 'white' }}
        size="small"
        placement="right"
        onPress={() => {
          prompt(
            'Add a new Todo',
            '',
            (text) => {
              if (!text) {
                return;
              }

              return createNewTodo({
                list_id: id!,
                description: text
              });
            },
            { placeholder: 'Todo description', style: 'shimo' }
          );
        }}
      />
      <ScrollView key={`edit-view-${id}`} style={{ maxHeight: '90%' }}>
        <SmartTodoItemsWidget id={listRecord.id} />
      </ScrollView>
      <StatusBar style={'light'} />
    </View>
  );
};

export default TodoView;
