import '@/global.css';

import { Tabs } from 'expo-router/js-tabs';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TabDock } from '@/components/tab-dock';
import { WeatherStoreProvider } from '@/weather/store';

/**
 * Root layout.
 *
 * The tab navigator renders with a transparent scene background so each
 * screen's animated sky reaches the very edges of the display — including
 * behind the floating dock, which is why `TabDock` replaces the default bar
 * rather than restyling it.
 */
export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <WeatherStoreProvider>
          {/* The sky is always dark enough for light status bar content. */}
          <StatusBar style="light" />
          <View style={styles.root}>
            <Tabs
              tabBar={(props) => <TabDock {...props} />}
              screenOptions={{
                headerShown: false,
                sceneStyle: { backgroundColor: 'transparent' },
                animation: 'shift',
              }}>
              <Tabs.Screen name="index" options={{ title: 'Today' }} />
              <Tabs.Screen name="cities" options={{ title: 'Cities' }} />
              <Tabs.Screen name="sky" options={{ title: 'Sky' }} />
            </Tabs>
          </View>
        </WeatherStoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050B18',
  },
});
