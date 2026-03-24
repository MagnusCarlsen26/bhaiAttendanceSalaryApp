import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SalaryScreen from '../screens/SalaryScreen';
import AddEmployeeScreen from '../screens/AddEmployeeScreen';
import { HomeIcon, HistoryIcon, SalaryIcon } from '../components/TabIcons';
import navigationTheme from '../theme/navigationTheme';
import { colors, radius, shadows } from '../theme/tokens';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const HeaderBackground = () => (
  <View style={styles.headerBackground}>
    <View style={styles.backgroundOrbTop} />
    <View style={styles.backgroundOrbBottom} />
  </View>
);

const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerStyle: {
        backgroundColor: 'transparent',
      },
      headerBackground: () => <HeaderBackground />,
      headerShadowVisible: false,
      headerTitleStyle: {
        color: colors.text,
        fontSize: 24,
        fontWeight: '800',
      },
      headerTintColor: colors.text,
      headerTitleAlign: 'left',
      sceneStyle: { backgroundColor: colors.bg },
      tabBarIcon: ({ color, size }) => {
        if (route.name === 'Today') {
          return <HomeIcon color={color} size={size} />;
        }
        if (route.name === 'History') {
          return <HistoryIcon color={color} size={size} />;
        }
        if (route.name === 'Payout') {
          return <SalaryIcon color={color} size={size} />;
        }
        return null;
      },
      tabBarActiveTintColor: colors.accentStrong,
      tabBarInactiveTintColor: colors.textSoft,
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 2,
      },
      tabBarStyle: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 16,
        height: 72,
        borderTopWidth: 0,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        ...shadows.floating,
      },
      tabBarItemStyle: {
        paddingVertical: 8,
      },
      tabBarHideOnKeyboard: true,
    })}
  >
    <Tab.Screen
      name="Today"
      component={HomeScreen}
      options={{
        title: 'Attendance',
        tabBarLabel: 'Attendance',
      }}
    />
    <Tab.Screen
      name="History"
      component={HistoryScreen}
      options={{
        headerTitle: '',
      }}
    />
    <Tab.Screen name="Payout" component={SalaryScreen} />
  </Tab.Navigator>
);

const RootNavigator = () => (
  <NavigationContainer theme={navigationTheme}>
    <Stack.Navigator>
      <Stack.Screen name="Main" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen
        name="AddEmployee"
        component={AddEmployeeScreen}
        options={({ route }) => ({
          title: route.params?.employee ? 'Edit Employee' : 'New Employee',
          headerBackTitleVisible: false,
          headerStyle: { backgroundColor: 'transparent' },
          headerBackground: () => <HeaderBackground />,
          headerShadowVisible: false,
          headerTitleStyle: { color: colors.text, fontSize: 24, fontWeight: '800' },
        })}
      />
    </Stack.Navigator>
  </NavigationContainer>
);

export default RootNavigator;

const styles = StyleSheet.create({
  headerBackground: {
    flex: 1,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  backgroundOrbTop: {
    position: 'absolute',
    top: -90,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#ead9c1',
    opacity: 0.7,
  },
  backgroundOrbBottom: {
    position: 'absolute',
    left: -70,
    bottom: -120,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#e8dece',
    opacity: 0.5,
  },
});
