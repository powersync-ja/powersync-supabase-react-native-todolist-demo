import { usePowerSync } from '@journeyapps/powersync-sdk-react-native';
import React from 'react';
import { Alert, Text } from 'react-native';
import { Icon } from 'react-native-elements';
import { useNavigation } from 'expo-router';
import { Header } from 'react-native-elements';
import { DrawerActions } from '@react-navigation/native';

export const HeaderWidget: React.FC<{
  title?: string;
}> = (props) => {
  const { title } = props;
  const [, forceUpdate] = React.useState<object>();
  const powersync = usePowerSync();
  const navigation = useNavigation();

  React.useEffect(() => {
    return powersync.registerListener({
      statusChanged: () => {
        forceUpdate({});
      }
    });
  }, [powersync]);

  return (
    <Header
      leftComponent={
        <Icon
          name={'menu'}
          type="material-community"
          color="white"
          style={{ padding: 5 }}
          onPress={() => {
            navigation.dispatch(DrawerActions.toggleDrawer());
          }}
        />
      }
      rightComponent={
        <Icon
          name={powersync.connected ? 'wifi' : 'wifi-off'}
          type="material-community"
          color="black"
          size={20}
          style={{ padding: 5 }}
          onPress={() => {
            Alert.alert(
              'Status',
              `${powersync.connected ? 'Connected' : 'Disconnected'}. \nLast Synced at ${
                powersync.currentStatus?.lastSyncedAt.toISOString() ?? '-'
              }\nVersion: ${powersync.sdkVersion}`
            );
          }}
        />
      }
      centerComponent={<Text style={{ padding: 5, color: '#fff' }}>{title}</Text>}
    />
  );
};
