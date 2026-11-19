// Home, for locked vaults (071; test builds): what every member's app does
// when it opens them — lock the vault key for members who have none, make a
// new version after someone left — and the few things that need a person:
// this device has no keys yet, nobody has let them in yet, a member with new
// keys waits for an admin to let them back in (or for this person to trust
// them here, after comparing key IDs, 074), or their own older documents
// are still readable.

import { useCallback, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useFamily } from '../lib/family-context';
import { isProduction } from '../lib/environment';
import { usePreferences } from '../lib/preferences';
import { vaultName } from '../lib/vaults';
import { approveMember, lockedVaults, moveOlderDocuments, tendVault, trustMember, LockedVaultError } from '../lib/vault-lock';
import { pendingDeviceRequests } from '../lib/vault-keys';
import { Body, Card, CardTitle, Muted, PrimaryButton, SecondaryButton } from './settings-ui';

type Notice =
  | { kind: 'no_keys'; vault: string }
  | { kind: 'waiting'; vault: string }
  | { kind: 'approve'; familyId: string; vault: string; memberId: string; name: string; keyId: string; admin: boolean; newPhone: boolean }
  | { kind: 'readable'; familyId: string; vault: string; namespace: string; count: number }
  | { kind: 'device' };

/** A key ID as people read it out: five groups of four. */
export function keyIdText(keyId: string): string {
  return (keyId.match(/.{1,4}/g) ?? []).join(' ');
}

export function LockedVaultNotices({ style }: { style?: StyleProp<ViewStyle> }) {
  const { families } = useFamily();
  const { documentLanguages } = usePreferences();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

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
        for (const c of t?.needsApproval ?? []) {
          // A viewer can only trust keys the server does not call changed; an admin can let anyone in.
          if (!t?.admin && c.serverSaysChanged) continue;
          found.push({
            kind: 'approve', familyId: f.family_id, vault: name, memberId: c.member.userId, name: c.member.name,
            keyId: c.keyId, admin: Boolean(t?.admin), newPhone: c.serverSaysChanged,
          });
        }
        if (t?.myReadable && f.families?.storage_namespace) {
          found.push({ kind: 'readable', familyId: f.family_id, vault: name, namespace: f.families.storage_namespace, count: t.myReadable });
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
        if (n.kind === 'readable') {
          return (
            <Card key={`r${n.familyId}`}>
              <CardTitle icon="unlock">{n.count === 1 ? 'One of your documents' : `${n.count} of your documents`} in {n.vault} {n.count === 1 ? "isn't" : "aren't"} locked yet</CardTitle>
              <Body>Only you can lock what you added.</Body>
              {progress && busy === n.familyId && <Muted>{progress}</Muted>}
              <PrimaryButton label="Lock them now" icon="lock" busy={busy === n.familyId}
                onPress={async () => {
                  setBusy(n.familyId);
                  try {
                    await moveOlderDocuments(n.familyId, n.namespace, documentLanguages, (done, total) => setProgress(`${done} of ${total}`));
                    setNotices((list) => list.filter((x) => !(x.kind === 'readable' && x.familyId === n.familyId)));
                  } finally {
                    setBusy(null);
                    setProgress(null);
                  }
                }} />
            </Card>
          );
        }
        return (
          <Card key={`a${n.familyId}${n.memberId}`}>
            <CardTitle icon="user-check">{n.newPhone ? `${n.name} set up a new phone` : `${n.name}'s keys changed`}</CardTitle>
            <Body>
              {n.admin ? `Let them back into ${n.vault}?` : `Trust their new keys in ${n.vault}?`} First ask {n.name} to open Settings › Security › Encryption keys and read you their key ID. It must be:
            </Body>
            <Body>{keyIdText(n.keyId)}</Body>
            <PrimaryButton label={n.admin ? 'It matches. Let them in' : 'It matches. Trust them'} icon="check" busy={busy === n.memberId}
              onPress={async () => {
                setBusy(n.memberId);
                try {
                  if (n.admin) await approveMember(n.familyId, n.memberId);
                  else await trustMember(n.familyId, n.memberId);
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
