import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/text';
import { Button, Card, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useS } from '@/lib/strings';
import { signInWithPassword, visionIsSeparate } from '@/lib/vision';

/**
 * Sign-in prompt. With the main Mibyan account it hands off to the existing Apple/Google flow
 * (/account); only a separate test project gets an in-app email form (that is the only case where
 * the app can sign in with a password).
 */
export function SignInCard({ message }: { message?: string }) {
  const s = useS();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Card style={{ gap: Spacing.three }}>
      <Text variant="heading" accessibilityRole="header">
        {s.signIn}
      </Text>
      <Text tone="secondary">{message ?? s.signInNeeded}</Text>
      {visionIsSeparate ? (
        <>
          <TextField value={email} onChange={setEmail} placeholder="Email" />
          <TextField value={password} onChange={setPassword} placeholder="Password" secure />
          {error ? (
            <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <Button
            label={s.signIn}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                await signInWithPassword(email.trim(), password);
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      ) : (
        <View>
          <Button label={s.signIn} icon="person.crop.circle" onPress={() => router.push('/account')} />
        </View>
      )}
    </Card>
  );
}
