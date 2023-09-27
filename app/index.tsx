import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { observer } from 'mobx-react-lite';

import { useSystem } from '../library/stores/system';
import { router } from 'expo-router';

/**
 * This is the entry point when the app loads.
 * Checks for a Supabase session.
 *  - If one is present redirect to app views.
 *  - If not, reditect to login/register flow
 */
const App = observer(() => {
  const { supabaseConnector } = useSystem();

  React.useEffect(() => {
    supabaseConnector.supabaseClient.auth
      .getSession()
      .then(({ data, error }) => {
        if (data.session) {
          router.replace('views/todos/lists');
        } else {
          throw new Error('Signin required');
        }
      })
      .catch(() => {
        router.replace('signin');
      });
  }, []);

  return (
    <View style={{ flex: 1, flexGrow: 1, alignContent: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
});

export default App;
