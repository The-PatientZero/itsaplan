'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type {
  InstanceGoogleSettings,
  InstanceMicrosoftSettings,
  InstanceOidcSettings,
} from '@/lib/api/endpoints/god';
import { Button } from '@/components/ui/button';
import GodSectionPage from '../GodSectionPage';
import GodGoogleSettings from './GodGoogleSettings';
import GodMicrosoftSettings from './GodMicrosoftSettings';
import GodOidcSettings from './GodOidcSettings';
import { useGodGoogleForm } from '../../hooks/useGodGoogleForm';
import { useGodMicrosoftForm } from '../../hooks/useGodMicrosoftForm';
import { useGodOidcForm } from '../../hooks/useGodOidcForm';

// One section per provider, committed through the page's single Save. Another
// provider is another section with its own form hook.
export default function GodAuthProviderForm({
  googleSettings,
  oidcSettings,
  microsoftSettings,
}: {
  googleSettings: InstanceGoogleSettings;
  oidcSettings: InstanceOidcSettings;
  microsoftSettings: InstanceMicrosoftSettings;
}) {
  const t = useTranslations('god.authProvider');
  const tCommon = useTranslations('common');
  const google = useGodGoogleForm(googleSettings);
  const oidc = useGodOidcForm(oidcSettings);
  const microsoft = useGodMicrosoftForm(microsoftSettings);

  const dirty = google.dirty || oidc.dirty || microsoft.dirty;
  const saving = google.saving || oidc.saving || microsoft.saving;

  // Only the sections that changed are written, so saving one provider does not
  // resubmit the others' credentials.
  async function save() {
    try {
      if (google.dirty) await google.save();
      if (oidc.dirty) await oidc.save();
      if (microsoft.dirty) await microsoft.save();
      toast.success(t('saved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <GodSectionPage
      slug="auth-provider"
      actions={
        <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
          {saving ? tCommon('saving') : tCommon('save')}
        </Button>
      }
    >
      <div className="space-y-10">
        <GodOidcSettings form={oidc} />
        <GodGoogleSettings form={google} />
        <GodMicrosoftSettings form={microsoft} />
      </div>
    </GodSectionPage>
  );
}
