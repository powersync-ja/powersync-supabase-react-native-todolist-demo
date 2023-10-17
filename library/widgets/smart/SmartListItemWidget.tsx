import { usePowerSyncWatchedQuery } from '@journeyapps/powersync-sdk-react-native';
import { router } from 'expo-router';
import _ from 'lodash';
import React from 'react';
import { ListItemWidget } from '../simple/ListItemWidget';
import { useSystem } from '../../powersync/system';
import { LIST_TABLE, ListRecord, TODO_TABLE, TodoRecord } from '../../powersync/AppSchema';

export interface SmartListItemWidgetProps {
  record: ListRecord;
}

export const SmartListItemWidget: React.FC<SmartListItemWidgetProps> = (props) => {
  const system = useSystem();
  const { id, name: title } = props.record;

  const todoRecords = usePowerSyncWatchedQuery<TodoRecord>(`SELECT * from ${TODO_TABLE} WHERE list_id = ?`, [id]);

  const deleteList = async () => {
    await system.powersync.writeTransaction(async (tx) => {
      // Delete associated todos
      await tx.executeAsync(`DELETE FROM ${TODO_TABLE} WHERE list_id = ?`, [id]);
      // Delete list record
      await tx.executeAsync(`DELETE FROM ${LIST_TABLE} WHERE id = ?`, [id]);
    });
  };

  const description = React.useMemo(() => {
    const completedCount = _.sumBy(todoRecords, (r) => (r.completed ? 1 : 0));
    return `${todoRecords.length - completedCount} pending, ${completedCount} completed`;
  }, [todoRecords]);

  return (
    <ListItemWidget
      title={title}
      description={description}
      onDelete={() => deleteList()}
      onPress={() => {
        router.push({
          pathname: 'views/todos/edit/[id]',
          params: { id: id }
        });
      }}
    />
  );
};
