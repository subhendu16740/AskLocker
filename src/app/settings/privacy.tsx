// Settings › Privacy — who can see what, and where a document's text goes.
// Every sentence here has to stay true of the code, and of the people who run
// AskLocker: documents are not end-to-end encrypted, so nothing here may
// promise that nobody but the family can see them. Check it when changing
// sharing, search, OCR, embeddings, voice, notifications, Gmail import,
// payments or usage counts.

import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/screen-header';
import { Card, CardTitle, Body, OnOff, SecondaryButton, screenStyles } from '../../components/settings-ui';
import { analyticsBuilt, analyticsOn, setAnalyticsOn } from '../../lib/analytics';
import { DEFAULT_PLAN_LIMITS } from '../../lib/plans';

const bold = { fontWeight: '600' as const };

export default function PrivacyScreen() {
  // Usage counts (analytics.ts): only builds made with a PostHog key send any.
  const [counts, setCounts] = useState<boolean | null>(null);
  useEffect(() => {
    if (analyticsBuilt) analyticsOn().then(setCounts);
  }, []);

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <ScreenHeader title="Privacy" fallback="/settings" />
      <ScrollView contentContainerStyle={screenStyles.body}>
        <Card>
          <CardTitle icon="users">Who can see your documents</CardTitle>
          <Body>Your family, and anyone you send a share link to. Your personal vault is yours alone.</Body>
        </Card>

        <Card>
          <CardTitle icon="eye">What AskLocker can see</CardTitle>
          <Body>
            Your documents are encrypted on the way and on disk, but not end-to-end. Our servers read the text to
            search it, and the people who run AskLocker can open your documents.
          </Body>
        </Card>

        <Card>
          <CardTitle icon="share-2">What goes to other services</CardTitle>
          <Body><Text style={bold}>Search:</Text> passages of your documents, and your questions, go to HuggingFace.</Body>
          <Body><Text style={bold}>Answers:</Text> your question and the best passages go to Anthropic (Claude) or Groq. Never your whole vault.</Body>
          <Body>
            <Text style={bold}>Reading:</Text> photos and spreadsheets you upload are read on your device. Scanned
            PDFs and photos from Gmail go to OCR.space.
          </Body>
          <Body><Text style={bold}>Voice:</Text> your browser's own speech service. In Chrome, that's Google's.</Body>
          <Body><Text style={bold}>Notifications:</Text> your browser's push service, which can't read them.</Body>
          <Body>
            <Text style={bold}>Payments:</Text> Razorpay takes your card or UPI details, never us. We check your
            country to pick ₹ or $, and don't keep it.
          </Body>
        </Card>

        <Card>
          <CardTitle icon="link">Share links</CardTitle>
          <Body>Anyone with the link can open that one document until it expires or is turned off.</Body>
        </Card>

        <Card>
          <CardTitle icon="plus-square">Emergency cards</CardTitle>
          <Body>Your family can see them. They're never sent to the AI.</Body>
        </Card>

        <Card>
          <CardTitle icon="mail">Import from Gmail</CardTitle>
          <Body>Until you pick a file, we keep only each attachment's sender, subject and name. Never the email.</Body>
        </Card>

        {/* What the agreement (062) leaves out: it says only what happens to documents. */}
        <Card>
          <CardTitle icon="info">Good to know</CardTitle>
          <Body>Answers are written by AI and can be wrong. Check the document before you rely on one.</Body>
          <Body>AskLocker is not a backup. Keep the originals of important papers.</Body>
          <Body>
            If Family Plus ends, a vault's newest documents over its free space are removed after{' '}
            {DEFAULT_PLAN_LIMITS.graceDays} days. We warn you first.
          </Body>
        </Card>

        {analyticsBuilt && (
          <Card>
            <CardTitle icon="bar-chart-2">How the app is used</CardTitle>
            <Body>
              PostHog counts which screens are used and the kinds of documents added, like "Passport". Never
              what they say, your questions or your name.
            </Body>
            {counts !== null && (
              <OnOff
                label="Share usage counts"
                value={counts}
                onChange={(on) => { setCounts(on); setAnalyticsOn(on); }}
              />
            )}
          </Card>
        )}

        <Card>
          <CardTitle icon="user-x">Leaving or deleting</CardTitle>
          <Body>
            Deleting your account is immediate. Documents you added to a family stay there, so delete any you want
            gone first.
          </Body>
          <Body>Backup copies expire on their own. What other services already got, they keep under their own rules.</Body>
          <SecondaryButton label="Manage Family" icon="users" onPress={() => router.push('/family' as any)} />
          <SecondaryButton label="Delete account" icon="user-x" onPress={() => router.push('/settings/delete-account' as any)} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
