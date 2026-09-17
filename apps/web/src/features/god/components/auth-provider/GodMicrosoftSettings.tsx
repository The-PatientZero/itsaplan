import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SettingsSection from '@/components/common/page/SettingsSection';
import SettingsCard from '@/components/common/page/SettingsCard';
import CopyableValue from '@/components/common/page/CopyableValue';
import EnabledSwitch from '@/components/common/inputs/EnabledSwitch';
import SecretInput from '@/components/common/inputs/SecretInput';
import type { GodMicrosoftForm } from '../../hooks/useGodMicrosoftForm';

// The app registration in Microsoft Entra. The tenant id scopes the sign-in to one
// directory; the redirect URI has to be registered on the app for the round trip to
// work at all.
export default function GodMicrosoftSettings({ form }: { form: GodMicrosoftForm }) {
  const t = useTranslations('god.authProvider');

  return (
    <SettingsSection
      title={t('microsoft')}
      description={t(form.hasCredentials ? 'microsoftConfigured' : 'microsoftMissing')}
      action={
        <EnabledSwitch
          checked={form.enabled}
          onChange={form.setEnabled}
          disabled={form.saving || !form.hasCredentials}
        />
      }
    >
      <SettingsCard className="space-y-6 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="microsoft-tenant-id">{t('tenantId')}</Label>
          <Input
            id="microsoft-tenant-id"
            value={form.tenantId}
            onChange={(e) => form.setTenantId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">{t('tenantIdHint')}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="microsoft-client-id">{t('clientId')}</Label>
            <Input
              id="microsoft-client-id"
              value={form.clientId}
              onChange={(e) => form.setClientId(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="microsoft-client-secret">{t('clientSecret')}</Label>
            <SecretInput
              id="microsoft-client-secret"
              value={form.clientSecret}
              onChange={form.setClientSecret}
              hasStored={form.settings.hasClientSecret}
            />
          </div>
        </div>

        <CopyableValue
          title={t('redirectUri')}
          value={form.settings.redirectUri}
          hint={t('microsoftRedirectUriHint')}
          copyLabel={t('copyRedirectUri')}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
