import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Appearance, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, SafeAreaView,
  ScrollView, StatusBar as NativeStatusBar, StyleSheet, Switch, Text, TextInput, useColorScheme, View,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Notifications from "expo-notifications";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { googleCalendarUrl, routineToIcs } from "./src/calendar";
import { addDays, displayDuration, formatDateKey, formatTime, itemDateRange, itemsForDate, normalizeTime, parseDateKey } from "./src/schedule";
import { notificationSummary } from "./src/notification-plans";
import { configureNotificationChannel, rescheduleNotifications } from "./src/notifications";
import { LocalRoutineRepository, toggleCompletion } from "./src/storage";
import { WEEKDAYS, type RoutineData, type RoutineItem, type RoutineLink } from "./src/types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

const repository = new LocalRoutineRepository();
const categories = ["Morning", "Wellbeing", "Fitness", "Meals", "Focus", "Work", "Personal", "Sleep"];
const light = { bg: "#F6F2E9", card: "#FFFDF8", ink: "#23322E", muted: "#6F7975", line: "#DEDDD4", sage: "#476657", soft: "#E7EDE6", coral: "#E88368", input: "#FFFFFF" };
const dark = { bg: "#17201D", card: "#222D29", ink: "#F7F3EA", muted: "#AAB7B1", line: "#3B4944", sage: "#9BC2AA", soft: "#2C3A34", coral: "#F29A82", input: "#293530" };
type Palette = typeof light;

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyItem(order: number): RoutineItem {
  return { id: uid(), title: "", emoji: "✨", startTime: "09:00", endTime: "", category: "Personal", days: [0, 1, 2, 3, 4, 5, 6], reminderMinutes: null, notes: "", links: [], order };
}

function readableDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(date);
}

function validHttpUrl(value: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(value);
}

export default function App() {
  const scheme = useColorScheme();
  const colors = scheme === "dark" ? dark : light;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [data, setData] = useState<RoutineData | null>(null);
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
  const [screen, setScreen] = useState<"today" | "builder" | "settings">("today");
  const [editing, setEditing] = useState<RoutineItem | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    void (async () => {
      try {
        await configureNotificationChannel();
        const [stored, permission] = await Promise.all([repository.load(), Notifications.getPermissionsAsync()]);
        setData(stored);
        setNotificationsEnabled(permission.granted);
      } catch {
        Alert.alert("Could not load Dayframe", "Your routine could not be read from this device.");
      } finally {
        loaded.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!data || !loaded.current) return;
    void repository.save(data).catch(() => Alert.alert("Could not save", "Your latest changes were not saved. Please try again."));
  }, [data]);

  useEffect(() => {
    if (!data || !notificationsEnabled || !loaded.current) return;
    void rescheduleNotifications(data.items).catch(() => Alert.alert("Reminder update failed", "Dayframe could not update scheduled reminders."));
  }, [data?.items, notificationsEnabled]);

  if (!data) {
    return <SafeAreaView style={[styles.safe, styles.center]}><StatusBar style={scheme === "dark" ? "light" : "dark"} /><Text style={styles.loading}>Preparing your day…</Text></SafeAreaView>;
  }

  const date = parseDateKey(selectedDate);
  const dayItems = itemsForDate(data.items, date);
  const completed = dayItems.filter((item) => data.completions[selectedDate]?.[item.id]).length;
  const progress = dayItems.length ? Math.round(completed / dayItems.length * 100) : 0;
  const updateData = (fn: (current: RoutineData) => RoutineData) => setData((current) => current ? fn(current) : current);

  const saveItem = (item: RoutineItem) => {
    updateData((current) => ({ ...current, items: current.items.some((candidate) => candidate.id === item.id) ? current.items.map((candidate) => candidate.id === item.id ? item : candidate) : [...current.items, item] }));
    setEditing(null);
  };

  const removeItem = (item: RoutineItem) => Alert.alert("Delete routine item?", `"${item.title}" and its completion history will be removed.`, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => updateData((current) => ({
      ...current,
      items: current.items.filter((candidate) => candidate.id !== item.id),
      completions: Object.fromEntries(Object.entries(current.completions).map(([key, values]) => {
        const next = { ...values }; delete next[item.id]; return [key, next];
      })),
    })) },
  ]);

  const moveItem = (item: RoutineItem, direction: -1 | 1) => {
    const sorted = [...data.items].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((candidate) => candidate.id === item.id);
    const target = sorted[index + direction];
    if (!target) return;
    updateData((current) => ({ ...current, items: current.items.map((candidate) => candidate.id === item.id ? { ...candidate, order: target.order } : candidate.id === target.id ? { ...candidate, order: item.order } : candidate) }));
  };

  const enableNotifications = async (value: boolean) => {
    if (!value) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      setNotificationsEnabled(false);
      return;
    }
    const permission = await Notifications.requestPermissionsAsync();
    setNotificationsEnabled(permission.granted);
    if (!permission.granted) Alert.alert("Notifications are off", "Enable notifications for Dayframe in system settings to receive routine reminders.", [{ text: "OK" }, { text: "Open settings", onPress: () => Linking.openSettings() }]);
  };

  const shareCalendar = async () => {
    try {
      const uri = `${FileSystem.cacheDirectory}dayframe-routine.ics`;
      await FileSystem.writeAsStringAsync(uri, routineToIcs(data.items, date));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "text/calendar", UTI: "public.calendar-event" });
      else Alert.alert("Sharing unavailable", "Calendar file sharing is not available on this device.");
    } catch {
      Alert.alert("Export failed", "Dayframe could not create the calendar file.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View style={styles.header}>
        <Text style={styles.brand}><Text style={styles.brandAccent}>day</Text>frame<Text style={styles.dot}>.</Text></Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Add routine item" onPress={() => setEditing(emptyItem(data.items.length))} style={styles.addButton}><Text style={styles.addButtonText}>＋ Add</Text></Pressable>
      </View>

      {screen === "today" && <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>YOUR DAILY RHYTHM</Text>
          <Text style={styles.heroTitle}>Make space for{"\n"}<Text style={styles.heroEm}>what matters.</Text></Text>
          <Text style={styles.subtitle}>A calm plan for your day, flexible enough for real life.</Text>
          <View style={styles.progressRow}><Text style={styles.progress}>{progress}%</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View><Text style={styles.progressLabel}>{completed}/{dayItems.length}</Text></View>
        </View>
        <View style={styles.dateControls}>
          <Pressable accessibilityLabel="Previous day" onPress={() => setSelectedDate(formatDateKey(addDays(date, -1)))} style={styles.roundButton}><Text style={styles.roundButtonText}>‹</Text></Pressable>
          <View style={styles.dateTitle}><Text style={styles.eyebrow}>{selectedDate === formatDateKey(new Date()) ? "TODAY" : "SCHEDULE"}</Text><Text style={styles.sectionTitle}>{readableDate(date)}</Text></View>
          <Pressable accessibilityLabel="Next day" onPress={() => setSelectedDate(formatDateKey(addDays(date, 1)))} style={styles.roundButton}><Text style={styles.roundButtonText}>›</Text></Pressable>
        </View>
        {dayItems.length === 0 ? <View style={styles.empty}><Text style={styles.emptyEmoji}>🌱</Text><Text style={styles.itemTitle}>A clear day</Text><Text style={styles.muted}>No recurring items are planned for this date.</Text></View> : dayItems.map((item) => {
          const done = Boolean(data.completions[selectedDate]?.[item.id]);
          return <RoutineCard key={item.id} item={item} done={done} colors={colors} styles={styles}
            onToggle={() => updateData((current) => toggleCompletion(current, selectedDate, item.id))}
            onEdit={() => setEditing(item)} onCalendar={() => void Linking.openURL(googleCalendarUrl(item, date))} />;
        })}
      </ScrollView>}

      {screen === "builder" && <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ROUTINE BUILDER</Text><Text style={styles.pageTitle}>Shape your{"\n"}<Text style={styles.heroEm}>ideal rhythm.</Text></Text>
        <Text style={styles.subtitle}>Build once, adjust anytime. Changes update local reminders automatically.</Text>
        <Pressable onPress={() => void shareCalendar()} style={styles.toolCard}><Text style={styles.toolIcon}>📅</Text><View style={styles.flex}><Text style={styles.itemTitle}>Share calendar file</Text><Text style={styles.muted}>Export all routines as a recurring .ics file</Text></View><Text style={styles.chevron}>›</Text></Pressable>
        {[...data.items].sort((a, b) => a.order - b.order).map((item, index, sorted) => <View key={item.id} style={styles.builderCard}>
          <View style={styles.reorder}>
            <Pressable disabled={index === 0} onPress={() => moveItem(item, -1)} accessibilityLabel={`Move ${item.title} up`}><Text style={[styles.reorderText, index === 0 && styles.disabled]}>▲</Text></Pressable>
            <Pressable disabled={index === sorted.length - 1} onPress={() => moveItem(item, 1)} accessibilityLabel={`Move ${item.title} down`}><Text style={[styles.reorderText, index === sorted.length - 1 && styles.disabled]}>▼</Text></Pressable>
          </View>
          <Text style={styles.builderEmoji}>{item.emoji}</Text><Pressable style={styles.flex} onPress={() => setEditing(item)}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.meta}>{formatTime(item.startTime)}{item.endTime ? ` – ${formatTime(item.endTime)}` : ""} · {item.category}</Text><Text style={styles.days}>{item.days.length === 7 ? "Every day" : item.days.map((day) => WEEKDAYS[day]?.short).join(", ")}</Text></Pressable>
          <Pressable accessibilityLabel={`Duplicate ${item.title}`} onPress={() => {
            const copy = { ...item, id: uid(), title: `${item.title} copy`, order: data.items.length };
            updateData((current) => ({ ...current, items: [...current.items, copy] })); setEditing(copy);
          }} style={styles.smallAction}><Text style={styles.smallActionText}>⧉</Text></Pressable>
          <Pressable accessibilityLabel={`Delete ${item.title}`} onPress={() => removeItem(item)} style={styles.smallAction}><Text style={styles.deleteText}>×</Text></Pressable>
        </View>)}
      </ScrollView>}

      {screen === "settings" && <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>SETTINGS</Text><Text style={styles.pageTitle}>A little{"\n"}<Text style={styles.heroEm}>gentle support.</Text></Text>
        <View style={styles.settingCard}><View style={styles.flex}><Text style={styles.itemTitle}>Routine reminders</Text><Text style={styles.muted}>Schedule the next 14 days on this device</Text></View><Switch value={notificationsEnabled} onValueChange={(value) => void enableNotifications(value)} trackColor={{ true: colors.sage }} /></View>
        <View style={styles.infoCard}><Text style={styles.infoTitle}>How reminders work</Text><Text style={styles.body}>Dayframe schedules local notifications with iOS or Android, so reminders can fire while the app is closed. Delivery timing remains subject to device focus modes, battery optimization, notification settings, and OS scheduling.</Text></View>
        <View style={styles.infoCard}><Text style={styles.infoTitle}>Calendar connection</Text><Text style={styles.body}>Google Calendar actions open a pre-filled recurring event for your review. No account credentials are stored. Calendar file sharing works with Apple Calendar, Google Calendar, and other compatible apps.</Text></View>
        <Text style={styles.appearance}>Appearance: {Appearance.getColorScheme() === "dark" ? "Dark" : "Light"} · follows your device</Text>
      </ScrollView>}

      <View style={[styles.tabBar, { paddingBottom: Math.max(10, Platform.OS === "ios" ? 4 : 10) }]}>
        {([{ key: "today", icon: "◷", label: "Today" }, { key: "builder", icon: "☷", label: "Builder" }, { key: "settings", icon: "⚙", label: "Settings" }] as const).map((tab) =>
          <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: screen === tab.key }} onPress={() => setScreen(tab.key)} style={styles.tab}><Text style={[styles.tabIcon, screen === tab.key && styles.tabActive]}>{tab.icon}</Text><Text style={[styles.tabLabel, screen === tab.key && styles.tabActive]}>{tab.label}</Text></Pressable>)}
      </View>
      <ItemEditor visible={editing !== null} item={editing} colors={colors} styles={styles} onClose={() => setEditing(null)} onSave={saveItem} />
    </SafeAreaView>
  );
}

function RoutineCard({ item, done, onToggle, onEdit, onCalendar, colors, styles }: { item: RoutineItem; done: boolean; onToggle: () => void; onEdit: () => void; onCalendar: () => void; colors: Palette; styles: ReturnType<typeof makeStyles> }) {
  const openLink = async (link: RoutineLink) => {
    if (!validHttpUrl(link.url) || !(await Linking.canOpenURL(link.url))) return Alert.alert("Invalid link", "This link cannot be opened safely.");
    await Linking.openURL(link.url);
  };
  return <View style={[styles.routineCard, done && { opacity: .58 }]}>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={`${done ? "Mark incomplete" : "Mark complete"}: ${item.title}`} onPress={onToggle} style={[styles.check, done && { backgroundColor: colors.sage, borderColor: colors.sage }]}><Text style={styles.checkText}>{done ? "✓" : ""}</Text></Pressable>
    <View style={styles.timeCol}><Text style={styles.time}>{formatTime(item.startTime)}</Text><Text style={styles.timeEnd}>{item.endTime ? formatTime(item.endTime) : "Point in time"}</Text></View>
    <View style={styles.flex}>
      <View style={styles.titleRow}><Text style={styles.cardEmoji}>{item.emoji}</Text><Text style={[styles.itemTitle, done && styles.done]}>{item.title}</Text></View>
      {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
      <View style={styles.chips}><Text style={styles.chip}>{item.category}</Text><Text style={styles.meta}>{displayDuration(item)}</Text>{item.reminderMinutes !== null && <Text style={styles.meta}>🔔 {item.reminderMinutes === 0 ? "At start" : `${item.reminderMinutes}m`}</Text>}</View>
      {item.links.map((link) => <Pressable accessibilityRole="link" key={link.id} onPress={() => void openLink(link)}><Text style={styles.link}>↗ {link.label || "Open link"}</Text></Pressable>)}
    </View>
    <View><Pressable accessibilityLabel={`Edit ${item.title}`} onPress={onEdit} style={styles.smallAction}><Text style={styles.smallActionText}>✎</Text></Pressable><Pressable accessibilityLabel={`Add ${item.title} to Google Calendar`} onPress={onCalendar} style={styles.smallAction}><Text style={styles.google}>G</Text></Pressable></View>
  </View>;
}

function ItemEditor({ visible, item, onClose, onSave, colors, styles }: { visible: boolean; item: RoutineItem | null; onClose: () => void; onSave: (item: RoutineItem) => void; colors: Palette; styles: ReturnType<typeof makeStyles> }) {
  const [draft, setDraft] = useState<RoutineItem | null>(item);
  const [validationError, setValidationError] = useState("");
  useEffect(() => {
    setDraft(item ? structuredClone(item) : null);
    setValidationError("");
  }, [item]);
  if (!draft) return null;
  const update = <K extends keyof RoutineItem>(key: K, value: RoutineItem[K]) => setDraft((current) => current ? { ...current, [key]: value } : current);
  const save = () => {
    const startTime = normalizeTime(draft.startTime);
    const endTime = draft.endTime.trim() ? normalizeTime(draft.endTime) : "";
    if (!draft.title.trim()) {
      setValidationError("Add a title before saving.");
      return;
    }
    if (!startTime || (draft.endTime.trim() && !endTime)) {
      setValidationError("Use a valid 24-hour time such as 7:00 or 19:30.");
      return;
    }
    if (!draft.days.length) {
      setValidationError("Choose at least one recurring day.");
      return;
    }
    const invalidLink = draft.links.find((link) => link.url && !validHttpUrl(link.url));
    if (invalidLink) {
      setValidationError("Links must start with http:// or https://.");
      return;
    }
    setValidationError("");
    onSave({ ...draft, title: draft.title.trim(), startTime, endTime: endTime ?? "", links: draft.links.filter((link) => link.url.trim()) });
  };
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={styles.modalSafe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={styles.cancel}>Cancel</Text></Pressable><Text style={styles.modalTitle}>{item?.title ? "Edit moment" : "New moment"}</Text><Pressable onPress={save}><Text style={styles.save}>Save</Text></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
          <View style={styles.formRow}><Field label="ICON" value={draft.emoji} onChange={(value) => update("emoji", value)} styles={styles} compact /><Field label="TITLE" value={draft.title} onChange={(value) => update("title", value)} styles={styles} flex autoFocus /></View>
          <View style={styles.formRow}><Field label="START (24H)" value={draft.startTime} onChange={(value) => update("startTime", value)} styles={styles} flex /><Field label="END (OPTIONAL)" value={draft.endTime} onChange={(value) => update("endTime", value)} styles={styles} flex /></View>
          <Text style={styles.label}>REPEATS</Text><View style={styles.dayRow}>{WEEKDAYS.map((day) => <Pressable key={day.value} accessibilityRole="checkbox" accessibilityState={{ checked: draft.days.includes(day.value) }} onPress={() => update("days", draft.days.includes(day.value) ? draft.days.filter((value) => value !== day.value) : [...draft.days, day.value].sort())} style={[styles.day, draft.days.includes(day.value) && { backgroundColor: colors.sage, borderColor: colors.sage }]}><Text style={[styles.dayText, draft.days.includes(day.value) && { color: colors.bg }]}>{day.short[0]}</Text></Pressable>)}</View>
          <Text style={styles.label}>CATEGORY</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>{categories.map((category) => <Pressable key={category} onPress={() => update("category", category)} style={[styles.categoryChoice, draft.category === category && { backgroundColor: colors.sage }]}><Text style={[styles.categoryText, draft.category === category && { color: colors.bg }]}>{category}</Text></Pressable>)}</ScrollView>
          <Text style={styles.label}>REMINDER</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>{([{ label: "None", value: null }, { label: "At start", value: 0 }, { label: "5 min", value: 5 }, { label: "10 min", value: 10 }, { label: "15 min", value: 15 }, { label: "30 min", value: 30 }, { label: "1 hour", value: 60 }] as const).map((option) => <Pressable key={option.label} onPress={() => update("reminderMinutes", option.value)} style={[styles.categoryChoice, draft.reminderMinutes === option.value && { backgroundColor: colors.sage }]}><Text style={[styles.categoryText, draft.reminderMinutes === option.value && { color: colors.bg }]}>{option.label}</Text></Pressable>)}</ScrollView>
          <Text style={styles.label}>NOTES</Text><TextInput multiline placeholder="Context, preparation, or an intention…" placeholderTextColor={colors.muted} value={draft.notes} onChangeText={(value) => update("notes", value)} style={[styles.input, styles.textarea]} />
          <Text style={styles.label}>LINKS</Text>{draft.links.map((link) => <View key={link.id} style={styles.linkEditor}><View style={styles.flex}><TextInput placeholder="Label" placeholderTextColor={colors.muted} value={link.label} onChangeText={(value) => update("links", draft.links.map((candidate) => candidate.id === link.id ? { ...candidate, label: value } : candidate))} style={styles.input} /><TextInput autoCapitalize="none" keyboardType="url" placeholder="https://…" placeholderTextColor={colors.muted} value={link.url} onChangeText={(value) => update("links", draft.links.map((candidate) => candidate.id === link.id ? { ...candidate, url: value } : candidate))} style={styles.input} /></View><Pressable onPress={() => update("links", draft.links.filter((candidate) => candidate.id !== link.id))}><Text style={styles.remove}>×</Text></Pressable></View>)}
          <Pressable onPress={() => update("links", [...draft.links, { id: uid(), label: "Open link", url: "" }])}><Text style={styles.addLink}>＋ Add link</Text></Pressable>
          {validationError ? <Text accessibilityRole="alert" style={styles.validationError}>{validationError}</Text> : null}
          <Text style={styles.helper}>{notificationSummary(draft)}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

function Field({ label, value, onChange, styles, flex, compact, autoFocus }: { label: string; value: string; onChange: (value: string) => void; styles: ReturnType<typeof makeStyles>; flex?: boolean; compact?: boolean; autoFocus?: boolean }) {
  return <View style={flex ? styles.flex : compact ? styles.compactField : undefined}><Text style={styles.label}>{label}</Text><TextInput autoFocus={autoFocus} value={value} onChangeText={onChange} style={styles.input} /></View>;
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg, paddingTop: Platform.OS === "android" ? NativeStatusBar.currentHeight : 0 },
    center: { alignItems: "center", justifyContent: "center" }, flex: { flex: 1 }, loading: { color: c.muted, fontSize: 16 },
    header: { height: 62, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.card },
    brand: { color: c.ink, fontSize: 24, fontWeight: "700", letterSpacing: -.6 }, brandAccent: { color: c.sage }, dot: { color: c.coral },
    addButton: { backgroundColor: c.sage, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }, addButtonText: { color: c.bg, fontWeight: "700" },
    content: { padding: 18, paddingBottom: 110 }, hero: { paddingVertical: 22 }, eyebrow: { color: c.sage, fontWeight: "800", fontSize: 11, letterSpacing: 1.7, marginBottom: 8 },
    heroTitle: { color: c.ink, fontSize: 40, lineHeight: 44, fontWeight: "700", letterSpacing: -1.5 }, heroEm: { color: c.sage, fontStyle: "italic" }, subtitle: { color: c.muted, fontSize: 15, lineHeight: 22, marginTop: 10, marginBottom: 18 },
    progressRow: { flexDirection: "row", alignItems: "center", gap: 10 }, progress: { color: c.coral, fontWeight: "800", fontSize: 20 }, progressTrack: { flex: 1, height: 7, backgroundColor: c.line, borderRadius: 9, overflow: "hidden" }, progressFill: { height: 7, backgroundColor: c.coral, borderRadius: 9 }, progressLabel: { color: c.muted, fontSize: 12 },
    dateControls: { flexDirection: "row", alignItems: "center", marginBottom: 18 }, dateTitle: { flex: 1, alignItems: "center" }, sectionTitle: { color: c.ink, fontSize: 20, fontWeight: "700" }, roundButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center" }, roundButtonText: { color: c.ink, fontSize: 28, lineHeight: 30 },
    routineCard: { flexDirection: "row", gap: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 17, padding: 14, marginBottom: 11 },
    check: { width: 25, height: 25, borderRadius: 13, borderWidth: 2, borderColor: c.line, alignItems: "center", justifyContent: "center", marginTop: 2 }, checkText: { color: c.bg, fontWeight: "900" },
    timeCol: { width: 68 }, time: { color: c.ink, fontSize: 12, fontWeight: "700" }, timeEnd: { color: c.muted, fontSize: 9, marginTop: 3 }, titleRow: { flexDirection: "row", alignItems: "center", gap: 7 }, cardEmoji: { fontSize: 20 }, itemTitle: { color: c.ink, fontSize: 15, fontWeight: "700" }, done: { textDecorationLine: "line-through" },
    notes: { color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 7 }, chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 }, chip: { color: c.sage, backgroundColor: c.soft, fontSize: 9, fontWeight: "800", textTransform: "uppercase", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }, meta: { color: c.muted, fontSize: 10 }, link: { color: c.sage, fontWeight: "700", fontSize: 12, paddingVertical: 5 },
    smallAction: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center", marginBottom: 5 }, smallActionText: { color: c.ink, fontSize: 16 }, google: { color: c.sage, fontWeight: "900" }, deleteText: { color: c.coral, fontSize: 23 },
    empty: { backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 17, padding: 40, alignItems: "center" }, emptyEmoji: { fontSize: 38, marginBottom: 8 }, muted: { color: c.muted, fontSize: 12, lineHeight: 18 },
    pageTitle: { color: c.ink, fontSize: 37, lineHeight: 41, fontWeight: "700", letterSpacing: -1.2 }, toolCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.soft, padding: 16, borderRadius: 15, marginBottom: 18 }, toolIcon: { fontSize: 25 }, chevron: { color: c.muted, fontSize: 27 },
    builderCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 14, marginBottom: 9 }, builderEmoji: { fontSize: 23 }, reorder: { gap: 5 }, reorderText: { color: c.sage, fontSize: 11, padding: 3 }, disabled: { opacity: .18 }, days: { color: c.sage, fontSize: 10, marginTop: 4 },
    settingCard: { flexDirection: "row", alignItems: "center", gap: 15, backgroundColor: c.card, padding: 18, borderRadius: 15, borderWidth: 1, borderColor: c.line, marginTop: 8, marginBottom: 16 }, infoCard: { backgroundColor: c.soft, borderRadius: 15, padding: 17, marginBottom: 12 }, infoTitle: { color: c.ink, fontSize: 15, fontWeight: "700", marginBottom: 7 }, body: { color: c.muted, fontSize: 13, lineHeight: 20 }, appearance: { color: c.muted, textAlign: "center", fontSize: 11, marginTop: 15 },
    tabBar: { flexDirection: "row", backgroundColor: c.card, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line, paddingTop: 8 }, tab: { flex: 1, alignItems: "center", paddingVertical: 3 }, tabIcon: { color: c.muted, fontSize: 20 }, tabLabel: { color: c.muted, fontSize: 10, marginTop: 2 }, tabActive: { color: c.sage, fontWeight: "800" },
    modalSafe: { flex: 1, backgroundColor: c.bg }, modalHeader: { height: 58, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.line }, cancel: { color: c.muted, fontSize: 15 }, save: { color: c.sage, fontWeight: "800", fontSize: 15 }, modalTitle: { color: c.ink, fontWeight: "800", fontSize: 17 }, form: { padding: 18, paddingBottom: 60 },
    formRow: { flexDirection: "row", gap: 12 }, compactField: { width: 72 }, label: { color: c.sage, fontSize: 10, fontWeight: "800", letterSpacing: 1.1, marginBottom: 7, marginTop: 12 }, input: { color: c.ink, backgroundColor: c.input, borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, marginBottom: 6 }, textarea: { minHeight: 90, textAlignVertical: "top" },
    dayRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }, day: { width: 39, height: 39, borderRadius: 20, borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center", backgroundColor: c.card }, dayText: { color: c.ink, fontWeight: "700" },
    categoryScroll: { marginBottom: 5 }, categoryChoice: { paddingHorizontal: 13, paddingVertical: 9, marginRight: 7, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 18 }, categoryText: { color: c.ink, fontSize: 12, fontWeight: "600" },
    linkEditor: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 7 }, remove: { color: c.coral, fontSize: 28, padding: 7 }, addLink: { color: c.sage, fontWeight: "700", paddingVertical: 10 }, helper: { color: c.muted, fontSize: 10, marginTop: 18, textAlign: "center" },
    validationError: { color: c.coral, fontSize: 13, fontWeight: "700", marginTop: 10, textAlign: "center" },
  });
}
