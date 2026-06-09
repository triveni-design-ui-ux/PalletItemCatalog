import { StatusBar } from "expo-status-bar";
import { DefaultTheme, ThemeProvider } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AppTabs from "@/components/app-tabs";
import { ItemsProvider } from "@/context/ItemsContext";

export default function TabLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ThemeProvider value={DefaultTheme}>
        <ItemsProvider>
          <AnimatedSplashOverlay />
          <AppTabs />
        </ItemsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
