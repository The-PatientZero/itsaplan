'use client';

import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import GoogleIcon from '@/components/common/GoogleIcon';
import MicrosoftIcon from '@/components/common/MicrosoftIcon';
import { useAuthConfig } from '@/services/authConfig.service';

// Signing in through a provider covers sign-up too: an address without an account
// gets one, subject to the same registration mode as the form above.
export default function AuthRegisterProviders({
  pending,
  onOidc,
  onGoogle,
  onMicrosoft,
}: {
  pending: boolean;
  onOidc: () => void;
  onGoogle: () => void;
  onMicrosoft: () => void;
}) {
  const t = useTranslations('auth.register');
  const authConfig = useAuthConfig();

  return (
    <Field className="gap-2">
      {authConfig?.oidc && (
        <Button type="button" variant="outline" onClick={onOidc} disabled={pending}>
          <ShieldCheck />
          {/* The operator named their own identity provider, so the label is shown
              as given rather than translated. */}
          {authConfig.oidcLabel || t('withSso')}
        </Button>
      )}
      {authConfig?.google && (
        <Button type="button" variant="outline" onClick={onGoogle} disabled={pending}>
          <GoogleIcon className="size-4" />
          {t('withGoogle')}
        </Button>
      )}
      {authConfig?.microsoft && (
        <Button type="button" variant="outline" onClick={onMicrosoft} disabled={pending}>
          <MicrosoftIcon className="size-4" />
          {t('withMicrosoft')}
        </Button>
      )}
    </Field>
  );
}
