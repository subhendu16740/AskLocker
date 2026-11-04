// Home, for locked vaults (071; test builds): what every member's app does
// when it opens them — lock the vault key for members who have none, make a
// new version after someone left — and the few things that need a person:
// this device has no keys yet, nobody has let them in yet, or a member with a
// new phone waits for an admin to let them back in.

import { useCallback, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useFamily } from '../lib/family-context';
import { isProduction } from '../lib/environment';
import { vaultName } from '../lib/vaults';
import { approveMember, lockedVaults, tendVault, LockedVaultError } from '../lib/vault-lock';
import { pendingDeviceRequests } from '../lib/vault-keys';
import { Body, Card, CardTitle, PrimaryButton, SecondaryButton } from './settings-ui';

type Notice =
  | { kind: 'no_keys'; vault: string }
  | { kind: 'waiting'; vault: string }
  | { kind: 'approve'; familyId: string; vault: string; memberId: string; name: string }
  | { kind: 'device' };

export function LockedVaultNotices({ style }: { style?: StyleProp<ViewStyle> }) {
  const { families } = useFamily();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const look = useCallback(async () => {
    if (isProduction) return;
    const locked = await lockedVaults().catch(() => new Set<string>());
    const found: Notice[] = [];
    let keysHere = true;
    for (const f of families) {
      if (!locked.has(f.family_id)) continue;
      const name = vaultName(f.families);
      try {
        const t = await tendVault(f.family_id);
        if (t?.waitingForMe) found.push({ kind: 'waiting', vault: name });
        if (t?.admin) {
          for (const m of t.needsApproval) found.push({ kind: 'approve', familyId: f.family_id, vault: name, memberId: m.userId, name: m.name });
        }
      } catch (err) {
        if (err instanceof LockedVaultError && err.code === 'no_keys_here') {
          keysHere = false;
          found.push({ kind: 'no_keys', vault: name });
        }
      }
    }
    if (keysHere && (await pendingDeviceRequests().catch(() => [])).length) found.push({ kind: 'device' });
    setNotices(found);
  }, [families]);

  useFocusEffect(useCallback(() => { look(); }, [look]));

  if (!notices.length) return null;
  return (
    <View style={style}>
      {notices.map((n, i) => {
        if (n.kind === 'no_keys') {
          return (
            <Card key={`k${i}`}>
              <CardTitle icon="lock">{n.vault} is locked</CardTitle>
              <Body>Unlock your keys on this device to open its documents.</Body>
              <PrimaryButton label="Unlock this device" icon="unlock" onPress={() => router.push('/settings/encryption' as any)} />
            </Card>
          );
        }
        if (n.kind === 'waiting') {
          return (
            <Card key={`w${i}`}>
              <CardTitle icon="clock">{n.vault} is locked</CardTitle>
              <Body>Waiting for someone in it to open AskLocker and let you in.</Body>
            </Card>
          );
        }
        if (n.kind === 'device') {
          return (
            <Card key={`d${i}`}>
              <CardTitle icon="smartphone">A new device wants your keys</CardTitle>
              <SecondaryButton label="See the code" onPress={() => router.push('/settings/encryption' as any)} />
            </Card>
          );
        }
        return (
          <Card key={`a${n.memberId}`}>
            <CardTitle icon="user-check">{n.name} set up a new phone</CardTitle>
            <Body>Let them back into {n.vault}? Check with them first that it was them.</Body>
            <PrimaryButton label="Let them back in" icon="check" busy={busy === n.memberId}
              onPress={async () => {
                setBusy(n.memberId);
                try {
                  await approveMember(n.familyId, n.memberId);
                  setNotices((list) => list.filter((x) => !(x.kind === 'approve' && x.memberId === n.memberId)));
                } finally {
                  setBusy(null);
                }
              }} />
          </Card>
        );
      })}
    </View>
  );
}
