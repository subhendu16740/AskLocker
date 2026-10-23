// The agreement (062): what AskLocker does with your documents, in plain
// words (supabase/functions/_shared/agreement.ts), shown once to every
// signed-in account and again whenever the words change (a new
// AGREEMENT_VERSION). Drawn over everything, in a Modal nothing else can be
// reached past (the lock screen's way): tick "I've read this and I agree"
// and Continue, or sign out. There is no other way on.
//
// The database records who agreed to which version and when, by its own
// clock (record_agreement()), as the proof. The device remembers it too, so
// the screen does not ask the database at every start. Where 062 is not
// applied yet, the agreement is kept on the device and sent at the next
// start that can record it.
//
// After the lock: while AskLocker is locked, or deciding whether to be, this
// waits. A shared document (/s) is for anyone with the link, never behind it.

import { useEffect, useState } from 'react';
import {
  Modal, View, Text, ScrollView, Pressable, TouchableOpacity, ActivityIndicator, StyleSheet, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSegments } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { useAppLock } from '../lib/app-lock';
import { fetchAgreement, recordAgreement } from '../lib/api';
import { accountKey, storageGet, storageSet } from '../lib/storage';
import { appVersion, buildCommit } from '../lib/app-info';
import { useNothingElseReachable } from './app-lock-screen';
import {
  AGREEMENT_FOOTER, AGREEMENT_INTRO, AGREEMENT_POINTS, AGREEMENT_TICK, AGREEMENT_TITLE, AGREEMENT_VERSION,
} from '../../supabase/functions/_shared/agreement';
import { color, radius, size, space, type } from '../constants/design';

/** The agreement's own element on the web, to tell it from everything it covers. */
const AGREEMENT_ID = 'agreement';

/** What the device keeps: the version agreed to, and whether the database has it. */
type Kept = { version: string; recorded: boolean; at: string };

async function readKept(userId: string): Promise<Kept | null> {
  try {
    const kept = JSON.parse((await storageGet(accountKey.agreement(userId))) ?? 'null');
    return kept && typeof kept.version === 'string' ? kept : null;
  } catch {
    return null;
  }
}

const keep = (userId: string, kept: Kept) => storageSet(accountKey.agreement(userId), JSON.stringify(kept));

const platform = Platform.OS === 'web' ? 'web' : Platform.OS;
const appBuild = buildCommit ? `${appVersion} ${buildCommit}` : appVersion;

export function AgreementScreen() {
  const { user, signOut } = useAuth();
  const { locked, deciding } = useAppLock();
  const segments = useSegments();
  const shared = (segments[0] as string | undefined) === 's';
  const [state, setState] = useState<'checking' | 'needed' | 'done'>('checking');
  const [ticked, setTicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    setTicked(false);
    setProblem(null);
    if (!user) {
      setState('checking');
      return;
    }
    let cancelled = false;
    (async () => {
      const kept = await readKept(user.id);
      if (kept?.version === AGREEMENT_VERSION) {
        if (!cancelled) setState('done');
        // Agreed here before the database could take it: send it now.
        if (!kept.recorded) {
          recordAgreement(AGREEMENT_VERSION, platform, appBuild)
            .then((at) => { if (at) keep(user.id, { version: AGREEMENT_VERSION, recorded: true, at }); })
            .catch(() => {});
        }
        return;
      }
      if (!cancelled) setState('checking');
      try {
        // Agreed on another device: the database knows.
        const check = await fetchAgreement(user.id, AGREEMENT_VERSION);
        if (cancelled) return;
        if (check === 'agreed') {
          await keep(user.id, { version: AGREEMENT_VERSION, recorded: true, at: '' });
          setState('done');
        } else {
          setState('needed');
        }
      } catch {
        if (!cancelled) setState('needed');
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const visible = !!user && !shared && !locked && !deciding;
  useNothingElseReachable(visible && state === 'needed', AGREEMENT_ID);

  const agree = async () => {
    if (!user || !ticked) return;
    setBusy(true);
    setProblem(null);
    try {
      const at = await recordAgreement(AGREEMENT_VERSION, platform, appBuild);
      await keep(user.id, { version: AGREEMENT_VERSION, recorded: at !== null, at: at ?? new Date().toISOString() });
      setState('done');
    } catch {
      setProblem("Couldn't save that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!visible || state === 'done') return null;
  // A moment while it asks the database: nothing behind shows meanwhile.
  if (state === 'checking') return <View style={[StyleSheet.absoluteFill, styles.cover]} />;

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.frame} nativeID={AGREEMENT_ID}>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.title} accessibilityRole="header">{AGREEMENT_TITLE}</Text>
            <Text style={styles.intro}>{AGREEMENT_INTRO}</Text>
            {AGREEMENT_POINTS.map((p) => (
              <View key={p.head} style={styles.point}>
                <Text style={styles.head}>{p.head}</Text>
                <Text style={styles.text}>{p.text}</Text>
              </View>
            ))}
            <Text style={styles.footer}>{AGREEMENT_FOOTER}</Text>
          </ScrollView>

          <View style={styles.bottom}>
            <Pressable
              style={styles.tick}
              onPress={() => setTicked(!ticked)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ticked }}
              aria-checked={ticked}
            >
              <View style={[styles.box, ticked && styles.boxOn]}>
                {ticked && <Feather name="check" size={16} color="#FFFFFF" />}
              </View>
              <Text style={styles.tickText}>{AGREEMENT_TICK}</Text>
            </Pressable>
            {!!problem && <Text style={styles.problem} accessibilityRole="alert">{problem}</Text>}
            <TouchableOpacity
              style={[styles.continue, (!ticked || busy) && styles.off]}
              onPress={agree}
              disabled={!ticked || busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: !ticked || busy }}
            >
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.continueText}>Continue</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.out} onPress={() => signOut()} disabled={busy} accessibilityRole="button">
              <Text style={styles.outText}>Don't agree? Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cover: { backgroundColor: color.background, zIndex: 1000 },
  safe: { flex: 1, backgroundColor: color.background },
  frame: { flex: 1, maxWidth: 420, width: '100%', alignSelf: 'center' },
  body: { paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.lg, gap: space.lg },
  title: { ...type.title, fontSize: 20, lineHeight: 26 },
  intro: { ...type.body, marginTop: -space.sm },
  point: { gap: 2 },
  head: { ...type.heading },
  text: { ...type.body },
  footer: { ...type.caption },
  bottom: {
    paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md, gap: space.md,
    borderTopWidth: 1, borderTopColor: color.border, backgroundColor: color.surface,
  },
  tick: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size.control },
  box: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: color.primary,
    alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface,
  },
  boxOn: { backgroundColor: color.primary },
  tickText: { ...type.label, flex: 1 },
  problem: { ...type.caption, color: color.danger },
  continue: {
    minHeight: size.control, borderRadius: radius.control, backgroundColor: color.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  off: { opacity: 0.4 },
  continueText: { ...type.button, color: '#FFFFFF' },
  out: { minHeight: size.control, alignItems: 'center', justifyContent: 'center' },
  outText: { ...type.button, color: color.primary },
});
