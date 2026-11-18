import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  birdInfo: Record<string, unknown> | null | undefined;
}

function getValue(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }
  return "";
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function BirdInfoCard({ birdInfo }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!birdInfo || typeof birdInfo !== "object") {
    return null;
  }
  const ukrainianName = getValue(birdInfo, "ukrainianName", "UkrainianName");
  const englishName = getValue(birdInfo, "englishName", "EnglishName");
  const scientificName = getValue(birdInfo, "scientificName", "ScientificName");
  const family = getValue(birdInfo, "family", "Family");
  const habitat = getValue(birdInfo, "habitat", "Habitat");
  const distribution = getValue(birdInfo, "distribution", "Distribution");
  const diet = getValue(birdInfo, "diet", "Diet");
  const averageSize = getValue(birdInfo, "averageSize", "AverageSize");
  const conservationStatus = getValue(
    birdInfo,
    "conservationStatus",
    "ConservationStatus",
  );
  const description = getValue(birdInfo, "description", "Description");
  const interestingFacts = getValue(
    birdInfo,
    "interestingFacts",
    "InterestingFacts",
  );
  const sourceUrl = getValue(birdInfo, "sourceUrl", "SourceUrl");
  const hasContent = [
    ukrainianName,
    englishName,
    scientificName,
    family,
    habitat,
    distribution,
    diet,
    averageSize,
    conservationStatus,
    description,
    interestingFacts,
  ].some(Boolean);
  if (!hasContent) return null;

  async function openSource() {
    if (!/^https?:\/\//i.test(sourceUrl)) return;
    try {
      await Linking.openURL(sourceUrl);
    } catch {}
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.toggle}
        onPress={() => setExpanded(!expanded)}
        accessibilityRole="button"
      >
        <Text style={styles.toggleText}>
          {expanded ? "Скрыть информацию о птице" : "Подробнее о птице"}
        </Text>
        <Text style={styles.arrow}>{expanded ? "▲" : "▼"}</Text>
      </Pressable>
      {expanded && (
        <View style={styles.content}>
          <Text style={styles.heading}>
            {ukrainianName || englishName || scientificName}
          </Text>
          {description ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}
          <InfoRow label="Украинское название" value={ukrainianName} />
          <InfoRow label="Английское название" value={englishName} />
          <InfoRow label="Научное название" value={scientificName} />
          <InfoRow label="Семейство" value={family} />
          <InfoRow label="Среда обитания" value={habitat} />
          <InfoRow label="Распространение" value={distribution} />
          <InfoRow label="Питание" value={diet} />
          <InfoRow label="Средний размер" value={averageSize} />
          <InfoRow label="Охранный статус" value={conservationStatus} />
          {interestingFacts ? (
            <View style={styles.facts}>
              <Text style={styles.factsTitle}>Интересные факты</Text>
              <Text style={styles.factsText}>{interestingFacts}</Text>
            </View>
          ) : null}
          {/^https?:\/\//i.test(sourceUrl) && (
            <Pressable onPress={openSource}>
              <Text style={styles.link}>Открыть источник информации</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e3e8e3",
    paddingTop: 14,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
  },
  toggleText: {
    color: "#217346",
    fontSize: 15,
    fontWeight: "bold",
  },
  arrow: {
    color: "#217346",
    fontSize: 13,
  },
  content: {
    marginTop: 12,
    padding: 15,
    backgroundColor: "#f4f8f5",
    borderRadius: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#217346",
    marginBottom: 12,
  },
  description: {
    color: "#444",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  row: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#217346",
    marginBottom: 3,
  },
  value: {
    color: "#333",
    fontSize: 14,
    lineHeight: 21,
  },
  facts: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#e8f2e9",
    borderRadius: 9,
  },
  factsTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#217346",
    marginBottom: 7,
  },
  factsText: {
    color: "#333",
    fontSize: 14,
    lineHeight: 21,
  },
  link: {
    marginTop: 15,
    color: "#217346",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
});
