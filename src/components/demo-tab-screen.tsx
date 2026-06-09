import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type DemoTabScreenProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

export function DemoTabScreen({ icon, label }: DemoTabScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={30} color="#0A66C2" />
        </View>
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.subtitle}>Demo menu</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF3F8",
    borderWidth: 1,
    borderColor: "#DCE8F3",
    marginBottom: 16,
  },
  title: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },
});
