'use client';

import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import GodAuthProviderForm from './components/auth-provider/GodAuthProviderForm';
import GodSectionPage from './components/GodSectionPage';
import {
  useInstanceGoogleSettingsQuery,
  useInstanceMicrosoftSettingsQuery,
  useInstanceOidcSettingsQuery,
} from './services/god.service';

// The sign-in providers: Google, Microsoft and the instance's own OIDC server. One
// settings row each, so this page loads all three before the form can compare against
// them. GodSettingsGate takes a single query, which is why the gate is spelled out.
export default function GodAuthProviderPage() {
  const google = useInstanceGoogleSettingsQuery();
  const oidc = useInstanceOidcSettingsQuery();
  const microsoft = useInstanceMicrosoftSettingsQuery();

  if (!google.data || !oidc.data || !microsoft.data) {
    return (
      <GodSectionPage slug="auth-provider">
        <ListSkeleton rows={5} rowClassName="h-12" />
      </GodSectionPage>
    );
  }

  // Keyed on the loaded state: a save replaces the cache entries, so the form
  // remounts with fresh initial values instead of a stale "dirty" comparison.
  return (
    <GodAuthProviderForm
      key={`${JSON.stringify(google.data)}|${JSON.stringify(oidc.data)}|${JSON.stringify(microsoft.data)}`}
      googleSettings={google.data}
      oidcSettings={oidc.data}
      microsoftSettings={microsoft.data}
    />
  );
}
