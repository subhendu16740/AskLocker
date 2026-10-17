// Drawer › My notes, in a business (056): a person's own scratchpad. Nobody
// else in the team reads it, not even an admin (RLS on the owner). A note can
// carry a day to be reminded on, on a paid plan; the server makes the
// reminder from 9 in the morning, India time, and sends it to their devices.
// On Free, 20 notes and no reminders. Leaving the business deletes them.

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFamily } from '../lib/family-context';
import { isBusinessVault, vaultName } from '../lib/vaults';
import { plusPage, useFamilyPlan } from '../lib/family-plan';
import { addNote, deleteNote, FeatureUnavailable, fetchNotes, fetchPlanLimits, updateNote, type Note } from '../lib/api';
import { DEFAULT_PLAN_LIMITS, type PlanLimits } from '../lib/plans';
import { formatDateInput, parseDocumentDate } from '../lib/dates';
import { daysFromToday, shortDate } from '../lib/overview';
import { ScreenHeader, PlusTag } from '../components/screen-header';
import { Card, Muted, PrimaryButton, SecondaryButton, Status, screenStyles } from '../components/settings-ui';
import { color, radius, size, space, type } from '../constants/design';
import { track } from '../lib/analytics';

const MAX_LENGTH = 2000;

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTyped = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const fromIso = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const inDays = (n: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d; };

/** "25/10/2026" → "2026-10-25"; '' → null; 'invalid' or 'past' otherwise. */
function readDay(text: string): string | null | 'invalid' | 'past' {
  const t = formatDateInput(text.trim());
  if (!t) return null;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(t)) return 'invalid';
  const d = parseDocumentDate(t);
  if (!d) return 'invalid';
  if (daysFromToday(d) < 0) return 'past';
  return toIso(d);
}

function dayText(iso: string): { text: string; late: boolean } {
  const d = fromIso(iso);
  const days = daysFromToday(d);
  if (days === 0) return { text: 'Today', late: false };
  if (days === 1) return { text: 'Tomorrow', late: false };
  if (days < 0) return { text: `Was ${shortDate(d)}`, late: true };
  return { text: shortDate(d), late: false };
}

export default function NotesScreen() {
  const { currentFamily } = useFamily();
  const business = isBusinessVault(currentFamily);
  const { plan, isFree } = useFamilyPlan();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [limits, setLimits] = useState<PlanLimits>(DEFAULT_PLAN_LIMITS);
  const [problem, setProblem] = useState<{ unavailable: boolean; text: string } | null>(null);

  const [text, setText] = useState('');
  const [day, setDay] = useState('');
  const [editing, setEditing] = useState<Note | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [askDelete, setAskDelete] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setProblem(null);
    if (!currentFamily || !business) return;
    fetchNotes(currentFamily.id)
      .then((n) => { if (!cancelled) setNotes(n); })
      .catch((err) => {
        if (!cancelled) setProblem({ unavailable: err instanceof FeatureUnavailable, text: err?.message || "Couldn't load your notes." });
      });
    fetchPlanLimits().then((l) => { if (!cancelled) setLimits(l); }).catch(() => {});
    return () => { cancelled = true; };
  }, [currentFamily?.id, business]);

  useFocusEffect(useCallback(() => load(), [load]));

  const open = useMemo(() => (notes ?? []).filter((n) => !n.done).sort((a, b) => {
    if (a.remindOn && b.remindOn) return a.remindOn.localeCompare(b.remindOn);
    if (a.remindOn) return -1;
    if (b.remindOn) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  }), [notes]);
  const done = useMemo(() => (notes ?? []).filter((n) => n.done), [notes]);
  const cap = plan == null ? null : plan === 'free' ? limits.notesPerPerson.free : limits.notesPerPerson.paid;
  const count = notes?.length ?? 0;
  const full = !editing && cap != null && count >= cap;

  const reset = () => { setText(''); setDay(''); setEditing(null); setFailed(null); };

  const save = async () => {
    if (!currentFamily) return;
    const body = text.trim();
    if (!body) { setFailed('Write something first.'); return; }
    const remind = isFree ? null : readDay(day);
    if (remind === 'invalid') { setFailed('Enter a day like 25/10/2026.'); return; }
    if (remind === 'past') { setFailed('Pick a day from today on.'); return; }
    setSaving(true);
    setFailed(null);
    try {
      if (editing) {
        const patch: { body: string; remind_on?: string | null } = { body };
        if (!isFree) patch.remind_on = remind;
        const saved = await updateNote(editing.id, patch);
        setNotes((list) => (list ?? []).map((n) => (n.id === saved.id ? saved : n)));
      } else {
        const saved = await addNote(currentFamily.id, body, remind);
        track('note_added', { reminder: !!remind });
        setNotes((list) => [saved, ...(list ?? [])]);
      }
      reset();
    } catch (err: any) {
      setFailed(err?.message || "Couldn't save the note.");
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (n: Note) => {
    setNotes((list) => (list ?? []).map((x) => (x.id === n.id ? { ...x, done: !n.done } : x)));
    try {
      await updateNote(n.id, { done: !n.done });
    } catch {
      setNotes((list) => (list ?? []).map((x) => (x.id === n.id ? { ...x, done: n.done } : x)));
    }
  };

  const remove = async (n: Note) => {
    if (askDelete !== n.id) { setAskDelete(n.id); return; }
    setAskDelete(null);
    const before = notes;
    setNotes((list) => (list ?? []).filter((x) => x.id !== n.id));
    if (editing?.id === n.id) reset();
    try {
      await deleteNote(n.id);
    } catch {
      setNotes(before);
    }
  };

  const edit = (n: Note) => {
    setEditing(n);
    setText(n.body);
    setDay(n.remindOn ? toTyped(n.remindOn) : '');
    setFailed(null);
  };

  if (!business) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={['top']}>
        <ScreenHeader title="My notes" fallback="/home" />
        <ScrollView contentContainerStyle={screenStyles.body}>
          <Status kind="error">Notes are for business vaults. Open one in Manage Family.</Status>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <ScreenHeader title="My notes" fallback="/home" />
      <ScrollView contentContainerStyle={screenStyles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>Your own notes in {vaultName(currentFamily)}. Nobody else in the team can open them.</Text>

        {problem ? (
          <>
            <Status kind="error">{problem.text}</Status>
            {!problem.unavailable && <SecondaryButton label="Try again" icon="refresh-cw" onPress={load} />}
          </>
        ) : notes === null ? (
          <View style={styles.center}><ActivityIndicator color={color.primary} /></View>
        ) : (
          <>
            <Card>
              <TextInput
                value={text}
                onChangeText={(t) => { setText(t); setFailed(null); }}
                placeholder={full ? 'Delete a note to add another' : 'Write a note'}
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={MAX_LENGTH}
                editable={!full}
                style={styles.input}
                accessibilityLabel="Note"
              />
              <View style={styles.remindHead}>
                <Text style={styles.remindLabel}>Remind me on</Text>
                {isFree && <TouchableOpacity onPress={() => router.push(plusPage('notes') as any)} accessibilityRole="link"><PlusTag /></TouchableOpacity>}
              </View>
              {isFree ? (
                <Text style={styles.link} onPress={() => router.push(plusPage('notes') as any)} accessibilityRole="link">
                  Reminders on notes come with a business plan ›
                </Text>
              ) : (
                <>
                  <View style={styles.chips}>
                    {[['Today', 0], ['Tomorrow', 1], ['Next week', 7]].map(([label, n]) => {
                      const typed = toTyped(toIso(inDays(n as number)));
                      const on = day === typed;
                      return (
                        <TouchableOpacity
                          key={label as string}
                          onPress={() => setDay(on ? '' : typed)}
                          style={[styles.chip, on && styles.chipOn]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                        >
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TextInput
                    value={day}
                    onChangeText={(t) => { setDay(formatDateInput(t)); setFailed(null); }}
                    placeholder="DD/MM/YYYY, or leave empty"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={10}
                    style={styles.dayInput}
                    accessibilityLabel="Remind me on, day"
                  />
                </>
              )}
              {failed && <Status kind="error">{failed}</Status>}
              <PrimaryButton label={editing ? 'Save changes' : 'Add note'} icon={editing ? 'check' : 'plus'} onPress={save} busy={saving} disabled={full} />
              {editing && <SecondaryButton label="Cancel" onPress={reset} />}
              {cap != null && (isFree || count >= cap * 0.8) && (
                <Muted>{count} of {cap} notes{full && isFree ? '. A business plan keeps more.' : ''}</Muted>
              )}
            </Card>

            {open.length === 0 && done.length === 0 && <Muted>No notes yet.</Muted>}
            {open.map((n) => (
              <NoteRow key={n.id} n={n} asking={askDelete === n.id} onToggle={toggleDone} onEdit={edit} onDelete={remove} />
            ))}
            {done.length > 0 && (
              <>
                <Text style={styles.doneHead} onPress={() => setShowDone(!showDone)} accessibilityRole="button">
                  {showDone ? '▾' : '▸'} Done ({done.length})
                </Text>
                {showDone && done.map((n) => (
                  <NoteRow key={n.id} n={n} asking={askDelete === n.id} onToggle={toggleDone} onEdit={edit} onDelete={remove} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NoteRow({ n, asking, onToggle, onEdit, onDelete }: {
  n: Note; asking: boolean; onToggle: (n: Note) => void; onEdit: (n: Note) => void; onDelete: (n: Note) => void;
}) {
  const when = n.remindOn ? dayText(n.remindOn) : null;
  return (
    <View style={styles.note}>
      <TouchableOpacity
        onPress={() => onToggle(n)}
        style={styles.check}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: n.done }}
        accessibilityLabel={n.done ? 'Done. Tap to open again' : 'Mark done'}
        hitSlop={8}
      >
        <Feather name={n.done ? 'check-circle' : 'circle'} size={20} color={n.done ? '#16A34A' : color.textMuted} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.noteMain} onPress={() => onEdit(n)} activeOpacity={0.7} accessibilityRole="button" accessibilityHint="Edit">
        <Text style={[styles.noteText, n.done && styles.noteDone]} numberOfLines={6}>{n.body}</Text>
        {when && !n.done && (
          <View style={styles.when}>
            <Feather name="bell" size={12} color={when.late ? color.danger : color.secondary} />
            <Text style={[styles.whenText, when.late && { color: color.danger }]}>{when.text}</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onDelete(n)}
        style={styles.del}
        accessibilityRole="button"
        accessibilityLabel={asking ? 'Tap again to delete' : 'Delete note'}
        hitSlop={8}
      >
        {asking ? <Text style={styles.delAsk}>Delete?</Text> : <Feather name="trash-2" size={16} color={color.textMuted} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 40 },
  intro: { ...type.body },
  link: { ...type.caption, fontWeight: '600', color: color.primary },
  input: {
    ...type.body, minHeight: 88, textAlignVertical: 'top', borderWidth: 1, borderColor: color.inputBorder,
    borderRadius: radius.control, padding: space.md, outlineStyle: 'none',
  } as any,
  remindHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  remindLabel: { ...type.caption, fontWeight: '600', color: color.textBody },
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  chip: {
    minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.control, borderWidth: 1,
    borderColor: color.inputBorder, justifyContent: 'center', backgroundColor: color.surface,
  },
  chipOn: { backgroundColor: color.primary, borderColor: color.primary },
  chipText: { ...type.caption, fontWeight: '600', color: color.primary },
  chipTextOn: { color: '#FFFFFF' },
  dayInput: {
    ...type.body, minHeight: size.control, borderWidth: 1, borderColor: color.inputBorder,
    borderRadius: radius.control, paddingHorizontal: space.md, outlineStyle: 'none',
  } as any,
  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, backgroundColor: color.surface,
    borderRadius: radius.control, borderWidth: 1, borderColor: color.border, padding: space.md,
  },
  check: { paddingTop: 1 },
  noteMain: { flex: 1, gap: 4 },
  noteText: { ...type.body },
  noteDone: { color: color.textMuted, textDecorationLine: 'line-through' },
  when: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  whenText: { ...type.meta, fontSize: 12, fontWeight: '600', color: color.secondary },
  del: { minWidth: 24, alignItems: 'flex-end', paddingTop: 2 },
  delAsk: { ...type.meta, fontSize: 12, fontWeight: '700', color: color.danger },
  doneHead: { ...type.overline, marginTop: space.sm },
});
