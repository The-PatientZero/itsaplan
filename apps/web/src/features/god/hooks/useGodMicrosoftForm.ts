'use client';

import { useState } from 'react';
import type { InstanceMicrosoftSettings } from '@/lib/api/endpoints/god';
import { useUpdateInstanceMicrosoftSettings } from '../services/god.service';

export interface GodMicrosoftForm {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  tenantId: string;
  setTenantId: (v: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  clientSecret: string;
  setClientSecret: (v: string) => void;
  // Counts a stored secret the user has not retyped. The switch stays off without
  // credentials: the API refuses it.
  hasCredentials: boolean;
  settings: InstanceMicrosoftSettings;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

// The secret starts blank and an empty field on save keeps the stored one.
export function useGodMicrosoftForm(settings: InstanceMicrosoftSettings): GodMicrosoftForm {
  const update = useUpdateInstanceMicrosoftSettings();

  const [enabled, setEnabled] = useState(settings.enabled);
  const [tenantId, setTenantId] = useState(settings.tenantId);
  const [clientId, setClientId] = useState(settings.clientId);
  const [clientSecret, setClientSecret] = useState('');

  const hasCredentials =
    tenantId.trim().length > 0 &&
    clientId.trim().length > 0 &&
    (settings.hasClientSecret || clientSecret.length > 0);
  const dirty =
    enabled !== settings.enabled ||
    tenantId !== settings.tenantId ||
    clientId !== settings.clientId ||
    clientSecret.length > 0;

  async function save() {
    await update.mutateAsync({
      enabled: enabled && hasCredentials,
      tenantId: tenantId.trim(),
      clientId: clientId.trim(),
      ...(clientSecret.length > 0 ? { clientSecret } : {}),
    });
    setClientSecret('');
  }

  return {
    enabled,
    setEnabled,
    tenantId,
    setTenantId,
    clientId,
    setClientId,
    clientSecret,
    setClientSecret,
    hasCredentials,
    settings,
    dirty,
    saving: update.isPending,
    save,
  };
}
