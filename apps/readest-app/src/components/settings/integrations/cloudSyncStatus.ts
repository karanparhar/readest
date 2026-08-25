import type { TranslationFunc } from '@/hooks/useTranslation';

/**
 * Status-line derivation for the Cloud Sync chooser rows. Pure functions so
 * the full row-state matrix is unit-tested and every user-visible string is
 * enumerated here (one place for the /i18n extraction), never improvised at
 * the call site.
 */

export interface ThirdPartyRowInputs {
  enabled: boolean;
  configured: boolean;
  syncing: boolean;
  /** Last terminal sync error, from fileSyncStore. */
  lastError: string | null | undefined;
  /** This provider's Upload Book Files toggle. */
  syncBooks: boolean;
  /**
   * Enabled, but its short-lived web OAuth token is gone/expired, so it cannot
   * actually sync until the user reconnects (web Google Drive; the token lives
   * in sessionStorage and is dropped when the tab closes). Without this the row
   * would show "Active" while silently syncing nothing.
   */
  needsReauth?: boolean;
}

export interface CanToggleCloudProviderInputs {
  isConfigured: boolean;
  isEnabled: boolean;
}

/**
 * Whether the Google Drive row's checkbox can be toggled inline. Turning the
 * provider ON requires it to be configured (an account linked); turning an
 * already-enabled provider OFF is always allowed, so a user who disconnects
 * from Drive is never trapped with the toggle stuck on.
 */
export const canToggleCloudProvider = (s: CanToggleCloudProviderInputs): boolean =>
  s.isConfigured || s.isEnabled;

export const getThirdPartyRowStatus = (_: TranslationFunc, s: ThirdPartyRowInputs): string => {
  if (!s.enabled) return s.configured ? _('Configured') : _('Not connected');
  // Enabled but the web token is gone — it silently syncs nothing until the user
  // reconnects, so the row must not claim it is active.
  if (s.needsReauth) return _('Reconnect required');
  if (s.syncing) return _('Syncing…');
  if (s.lastError) return _('Sync failed');
  if (!s.syncBooks) {
    // Books back up NOWHERE in this state — the row must say so.
    return _('Active · Book file uploads off');
  }
  return _('Active');
};
