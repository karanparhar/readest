import clsx from 'clsx';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MdChevronRight } from 'react-icons/md';
import {
  RiBookOpenLine,
  RiPlanetLine,
  RiRssLine,
  RiBookReadLine,
  RiBook3Line,
  RiDiscordLine,
  RiSendPlaneLine,
  RiWifiLine,
  RiGoogleLine,
  RiHeadphoneLine,
} from 'react-icons/ri';
import { useEnv } from '@/context/EnvContext';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useKeyDownActions } from '@/hooks/useKeyDownActions';
import { useSettingsStore } from '@/store/settingsStore';
import { useCustomOPDSStore } from '@/store/customOPDSStore';
import { useABSServerStore } from '@/store/absServerStore';
import { useFileSyncStore } from '@/store/fileSyncStore';
import { CatalogManager } from '@/app/opds/components/CatalogManager';
import { saveSysSettings } from '@/helpers/settings';
import { isTauriAppPlatform, isWebAppPlatform } from '@/services/environment';
import { isLocalSendEnabled } from '@/services/localsend/devicePrefs';
import { getGoogleWebClientId } from '@/services/sync/providers/gdrive/buildGoogleDriveProvider';
import { navigateToLogin } from '@/utils/nav';
import ABSForm from './integrations/ABSForm';
import BookOrbitForm from './integrations/BookOrbitForm';
import KOSyncForm from './integrations/KOSyncForm';
import ReadwiseForm from './integrations/ReadwiseForm';
import HardcoverForm from './integrations/HardcoverForm';
import SendToReadestForm from './integrations/SendToReadestForm';
import LocalSendForm from './integrations/LocalSendForm';
import GoogleDriveForm from './integrations/GoogleDriveForm';
import { persistCloudProviderEnabled } from './integrations/cloudSync';
import { canToggleCloudProvider, getThirdPartyRowStatus } from './integrations/cloudSyncStatus';
import type { CloudSyncProviderKind } from '@/services/sync/cloudSyncProvider';
import { canBackendRun } from '@/services/sync/file/runLibrarySync';
import SubPageHeader from './SubPageHeader';
import { SectionTitle, SettingLabel, Tips } from './primitives';

type SubPage =
  | 'kosync'
  | 'bookorbit'
  | 'gdrive'
  | 'readwise'
  | 'hardcover'
  | 'opds'
  | 'audiobookshelf'
  | 'send'
  | 'localsend'
  | null;

/**
 * Integrations panel — single point of discovery for external service config:
 * KOReader Sync, Readwise, Hardcover, and OPDS Catalogs.
 *
 * Pattern: boxed list of NavigationRows. Each row pushes the panel into an
 * inline sub-page (with breadcrumb back-navigation matching the Dictionaries
 * pattern) — no nested modals.
 *
 * TODO(design-system): Once we extract BoxedList / NavigationRow primitives,
 * this panel and CustomDictionaries should both consume them instead of
 * inlining the chassis.
 */
const IntegrationsPanel: React.FC = () => {
  const _ = useTranslation();
  const router = useRouter();
  const { envConfig, appService } = useEnv();
  const { user } = useAuth();
  const { settings, requestedSubPage, setRequestedSubPage } = useSettingsStore();
  const opdsCatalogs = useCustomOPDSStore((s) => s.catalogs);
  const opdsCount = opdsCatalogs.filter((c) => !c.deletedAt).length;
  const absServers = useABSServerStore((s) => s.servers);
  const absCount = absServers.filter((s) => !s.deletedAt).length;
  const isGDriveSyncing = useFileSyncStore((s) => s.byKind.gdrive?.isSyncing ?? false);
  const gdriveLastError = useFileSyncStore((s) => s.lastErrorByKind.gdrive);

  const [subPage, setSubPage] = useState<SubPage>(null);

  // Hydrate the OPDS store from settings so the row's catalog count is
  // accurate on first open. Without this the store starts empty and the
  // count reads zero until the user drills into the OPDS sub-page (where
  // CatalogManager loads it). Loading happens once per mount; the store
  // handles backfilling contentId for legacy entries.
  useEffect(() => {
    void useCustomOPDSStore.getState().loadCustomOPDSCatalogs(envConfig);
  }, [envConfig]);

  // Same hydration as above, for the Audiobookshelf server list — keeps the
  // Content Sources row's server count accurate on first open.
  useEffect(() => {
    void useABSServerStore.getState().loadABSServers(envConfig);
  }, [envConfig]);

  // Android Back / Esc: when any integrations sub-page (KOSync, WebDAV,
  // Readwise, Hardcover, OPDS, Send-to-Readest) is open, intercept and
  // step back to the integrations list instead of letting <Dialog>'s
  // listener close the whole Settings dialog. The hook registers its
  // sync `native-key-down` listener *after* <Dialog>'s, and
  // `dispatchSync` walks listeners LIFO — so this one claims Back first
  // when enabled and `return true` consumes the event. When subPage is
  // null the hook is disabled and Back falls through to close the dialog
  // as before.
  useKeyDownActions({
    enabled: subPage !== null,
    onCancel: () => setSubPage(null),
  });

  const toggleDiscordPresence = () => {
    const discordRichPresenceEnabled = !settings.discordRichPresenceEnabled;
    saveSysSettings(envConfig, 'discordRichPresenceEnabled', discordRichPresenceEnabled);
    if (discordRichPresenceEnabled && !user) {
      navigateToLogin(router);
    }
  };

  // Deep-link consumption: when a caller (e.g. OPDS browser close handler)
  // sets `requestedSubPage` in the store before opening the dialog, drill
  // straight into that sub-page on mount and clear the request so it doesn't
  // stick to the next open. Recognised values match the SubPage union.
  useEffect(() => {
    if (!requestedSubPage) return;
    if (
      requestedSubPage === 'kosync' ||
      requestedSubPage === 'bookorbit' ||
      requestedSubPage === 'gdrive' ||
      requestedSubPage === 'readwise' ||
      requestedSubPage === 'hardcover' ||
      requestedSubPage === 'opds' ||
      requestedSubPage === 'audiobookshelf' ||
      requestedSubPage === 'send' ||
      requestedSubPage === 'localsend'
    ) {
      setSubPage(requestedSubPage);
    } else if (requestedSubPage === 'cloudsync') {
      // Back-compat with the brief unified "Cloud Sync" page.
      setSubPage('gdrive');
    }
    setRequestedSubPage(null);
  }, [requestedSubPage, setRequestedSubPage]);

  // Sub-page wrapper matches the list-view's `my-4 w-full` so the
  // SubPageHeader's "Integrations" label lands at the exact same Y position
  // as the list-view's h2 — clicking a row reads as a navigation morph
  // rather than a layout shift.
  if (subPage === 'kosync')
    return (
      <div className='my-4 w-full'>
        <KOSyncForm onBack={() => setSubPage(null)} />
      </div>
    );
  if (subPage === 'localsend')
    return (
      <div className='my-4 w-full'>
        <LocalSendForm onBack={() => setSubPage(null)} />
      </div>
    );
  if (subPage === 'bookorbit')
    return (
      <div className='my-4 w-full'>
        <BookOrbitForm onBack={() => setSubPage(null)} />
      </div>
    );
  if (subPage === 'gdrive')
    return (
      <div className='my-4 w-full'>
        <SubPageHeader
          parentLabel={_('Integrations')}
          currentLabel={_('Google Drive')}
          description={_(
            'Sync your library, reading progress, and highlights with your Google Drive.',
          )}
          onBack={() => setSubPage(null)}
        />
        <GoogleDriveForm />
        {settings.googleDrive?.enabled && (
          <div className='mt-5'>
            <Tips>
              <li>
                {_('{{provider}} keeps a full copy of your books, progress, and annotations.', {
                  provider: _('Google Drive'),
                })}
              </li>
              <li>
                {_(
                  'App settings, reading statistics, and dictionaries still sync through your Readest account while signed in.',
                )}
              </li>
            </Tips>
          </div>
        )}
      </div>
    );
  if (subPage === 'readwise')
    return (
      <div className='my-4 w-full'>
        <ReadwiseForm onBack={() => setSubPage(null)} />
      </div>
    );
  if (subPage === 'hardcover')
    return (
      <div className='my-4 w-full'>
        <HardcoverForm onBack={() => setSubPage(null)} />
      </div>
    );
  if (subPage === 'opds')
    return (
      <div className='my-4 w-full'>
        <SubPageHeader
          parentLabel={_('Integrations')}
          currentLabel={_('OPDS Catalogs')}
          description={_('Browse and download books from online catalogs.')}
          onBack={() => setSubPage(null)}
        />
        <CatalogManager inSubPage />
      </div>
    );
  if (subPage === 'audiobookshelf')
    return (
      <div className='my-4 w-full'>
        <ABSForm onBack={() => setSubPage(null)} />
      </div>
    );
  if (subPage === 'send')
    return (
      <div className='my-4 w-full'>
        <SendToReadestForm onBack={() => setSubPage(null)} />
      </div>
    );

  const koSyncStatus = settings.kosync?.enabled
    ? settings.kosync.username
      ? _('Connected as {{user}}', { user: settings.kosync.username })
      : _('Connected')
    : _('Not connected');

  const bookOrbitStatus = settings.bookorbit?.enabled
    ? settings.bookorbit.username
      ? _('Connected as {{user}}', { user: settings.bookorbit.username })
      : _('Connected')
    : _('Not connected');

  const readwiseStatus = settings.readwise?.enabled ? _('Connected') : _('Not connected');
  const hardcoverStatus = settings.hardcover?.enabled ? _('Connected') : _('Not connected');

  // Google Drive is the only third-party cloud sync provider. "Configured" =
  // the user has at least one Drive account linked (accountLabel stored).
  const gdriveConfigured = !!settings.googleDrive?.accountLabel;
  const gdriveStatus = getThirdPartyRowStatus(_, {
    enabled: !!settings.googleDrive?.enabled,
    configured: gdriveConfigured,
    syncing: isGDriveSyncing,
    lastError: gdriveLastError,
    syncBooks: settings.googleDrive?.syncBooks ?? false,
    // Web Google Drive with a gone/expired token can't sync until reconnected.
    needsReauth: !canBackendRun('gdrive'),
  });

  const toggleCloudProvider = async (kind: CloudSyncProviderKind, next: boolean) => {
    await persistCloudProviderEnabled(envConfig, kind, next);
  };

  const opdsStatus =
    opdsCount > 0 ? _('{{count}} catalog', { count: opdsCount }) : _('No catalogs');
  const absStatus = absCount > 0 ? _('{{count}} server', { count: absCount }) : _('No servers');

  return (
    <div className='my-4 w-full space-y-6'>
      <div className='w-full px-4'>
        <h2 className='mb-1.5 text-lg font-semibold tracking-tight'>{_('Integrations')}</h2>
        <p className='text-base-content/70 text-sm leading-relaxed'>
          {_('Connect Readest to external services for sync, highlights, and catalogs.')}
        </p>
      </div>

      <div className='w-full' data-setting-id='settings.integrations.sync'>
        <SectionTitle className='mb-2'>{_('Reading Sync')}</SectionTitle>
        <div className='card eink-bordered border-base-200 bg-base-100 overflow-hidden border'>
          <div className='divide-base-200 divide-y'>
            <IntegrationRow
              icon={RiBookOpenLine}
              title={_('KOReader')}
              status={koSyncStatus}
              onClick={() => setSubPage('kosync')}
            />
            <IntegrationRow
              icon={RiPlanetLine}
              title={_('BookOrbit')}
              status={bookOrbitStatus}
              onClick={() => setSubPage('bookorbit')}
            />
            <IntegrationRow
              icon={RiBookReadLine}
              title={_('Readwise')}
              status={readwiseStatus}
              onClick={() => setSubPage('readwise')}
            />
            <IntegrationRow
              icon={RiBook3Line}
              title={_('Hardcover')}
              status={hardcoverStatus}
              onClick={() => setSubPage('hardcover')}
            />
          </div>
        </div>
      </div>

      <div className='w-full' data-setting-id='settings.integrations.cloudSync'>
        <SectionTitle className='mb-2'>{_('Cloud Sync')}</SectionTitle>
        <div className='card eink-bordered border-base-200 bg-base-100 overflow-hidden border'>
          <div
            className='divide-base-200 divide-y'
            role='group'
            aria-label={_('Cloud sync providers')}
          >
            {(appService?.isDesktopApp ||
              appService?.isAndroidApp ||
              appService?.isIOSApp ||
              // Web: only when a Web-type GIS client id is configured for this build.
              (isWebAppPlatform() && !!getGoogleWebClientId())) && (
              <CloudProviderRow
                icon={RiGoogleLine}
                title={_('Google Drive')}
                status={gdriveStatus}
                checked={!!settings.googleDrive?.enabled}
                canToggle={canToggleCloudProvider({
                  isConfigured: gdriveConfigured,
                  isEnabled: !!settings.googleDrive?.enabled,
                })}
                onToggle={(next) => toggleCloudProvider('gdrive', next)}
                onOpen={() => setSubPage('gdrive')}
                toggleLabel={_('Sync with Google Drive')}
              />
            )}
          </div>
        </div>
      </div>

      <div className='w-full' data-setting-id='settings.integrations.catalogs'>
        <SectionTitle className='mb-2'>{_('Content Sources')}</SectionTitle>
        <div className='card eink-bordered border-base-200 bg-base-100 overflow-hidden border'>
          <div className='divide-base-200 divide-y'>
            <IntegrationRow
              icon={RiRssLine}
              title={_('OPDS Catalogs')}
              status={opdsStatus}
              onClick={() => setSubPage('opds')}
            />
            <IntegrationRow
              icon={RiHeadphoneLine}
              title={_('Audiobookshelf')}
              status={absStatus}
              onClick={() => setSubPage('audiobookshelf')}
            />
            <IntegrationRow
              icon={RiSendPlaneLine}
              title={_('Send to Readest')}
              status={_('Email books to your library')}
              onClick={() => setSubPage('send')}
            />
            {isTauriAppPlatform() && (
              <IntegrationRow
                icon={RiWifiLine}
                title={_('LocalSend')}
                status={isLocalSendEnabled() ? _('On') : _('Off')}
                onClick={() => setSubPage('localsend')}
              />
            )}
          </div>
        </div>
      </div>

      {appService?.isDesktopApp && (
        <div className='w-full' data-setting-id='settings.integrations.discord'>
          <SectionTitle className='mb-2'>{_('Discord')}</SectionTitle>
          <div className='card eink-bordered border-base-200 bg-base-100 overflow-hidden border'>
            <div className='divide-base-200 divide-y'>
              <IntegrationToggleRow
                icon={RiDiscordLine}
                title={_('Show on Discord')}
                description={_("Display what I'm reading on Discord")}
                checked={settings.discordRichPresenceEnabled}
                onChange={toggleDiscordPresence}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface IntegrationRowProps {
  icon: React.ElementType;
  title: string;
  status: string;
  onClick: () => void;
}

const IntegrationRow: React.FC<IntegrationRowProps> = ({ icon: Icon, title, status, onClick }) => {
  return (
    <button
      type='button'
      onClick={onClick}
      className={clsx(
        'group flex w-full items-center gap-3 px-4 py-3 text-left',
        'transition-colors duration-150',
        'focus-visible:ring-base-content/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
      )}
    >
      <span
        className={clsx(
          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
          'bg-base-200 text-base-content/70',
          'transition-colors duration-150',
          'group-hover:bg-base-300/70',
        )}
      >
        <Icon className='h-5 w-5' />
      </span>
      <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <SettingLabel>{title}</SettingLabel>
        <span className='text-base-content/65 truncate text-[0.85em]'>{status}</span>
      </div>
      <MdChevronRight className='text-base-content/50 h-5 w-5 flex-shrink-0' />
    </button>
  );
};

interface CloudProviderRowProps {
  icon: React.ElementType;
  title: string;
  status: string;
  /** This provider syncs the library. */
  checked: boolean;
  /** Can be toggled inline (configured, and allowed by the plan). */
  canToggle: boolean;
  onToggle: (next: boolean) => void;
  onOpen: () => void;
  /** Accessible label for the checkbox (e.g. "Sync with WebDAV"). */
  toggleLabel: string;
  /** End-aligned tier chip (e.g. "Premium") — uniform column before the checkbox. */
  badge?: string;
}

/**
 * A cloud-sync provider row. Two controls: a trailing checkbox that turns
 * this provider's library sync on or off (several may be on at once) —
 * enabled only when it's already configured — and the row body / chevron
 * that opens its config sub-page (connect, sync options, disconnect).
 */
const CloudProviderRow: React.FC<CloudProviderRowProps> = ({
  icon: Icon,
  title,
  status,
  checked,
  canToggle,
  onToggle,
  onOpen,
  toggleLabel,
  badge,
}) => {
  return (
    <div className='group flex w-full items-center gap-3 px-4 py-3'>
      <button
        type='button'
        onClick={onOpen}
        className={clsx(
          'flex min-w-0 flex-1 items-center gap-3 text-left',
          'focus-visible:ring-base-content/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
        )}
      >
        <span
          className={clsx(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
            'bg-base-200 text-base-content/70',
            'transition-colors duration-150',
            'group-hover:bg-base-300/70',
          )}
        >
          <Icon className='h-5 w-5' />
        </span>
        <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
          <SettingLabel>{title}</SettingLabel>
          <span className='text-base-content/65 truncate text-[0.85em]'>{status}</span>
        </div>
      </button>
      {badge && <span className='badge badge-sm badge-ghost shrink-0'>{badge}</span>}
      <input
        type='checkbox'
        className='checkbox checkbox-sm flex-shrink-0'
        checked={checked}
        disabled={!canToggle}
        onChange={(e) => onToggle(e.target.checked)}
        aria-label={toggleLabel}
        title={toggleLabel}
      />
      <button
        type='button'
        onClick={onOpen}
        aria-label={title}
        className={clsx(
          'text-base-content/50 hover:text-base-content/80 flex-shrink-0 rounded',
          'focus-visible:ring-base-content/15 focus-visible:outline-none focus-visible:ring-2',
        )}
      >
        <MdChevronRight className='h-5 w-5' />
      </button>
    </div>
  );
};

interface IntegrationToggleRowProps {
  icon: React.ElementType;
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

/**
 * Sibling of IntegrationRow for settings that are a simple on/off toggle
 * (no sub-page). Keeps the same circular-badge chassis so toggle and
 * navigation rows read as one consistent list.
 */
const IntegrationToggleRow: React.FC<IntegrationToggleRowProps> = ({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}) => {
  return (
    <label className='flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left'>
      <span
        className={clsx(
          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
          'bg-base-200 text-base-content/70',
        )}
      >
        <Icon className='h-5 w-5' />
      </span>
      <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <SettingLabel>{title}</SettingLabel>
        <span className='text-base-content/65 truncate text-[0.85em]'>{description}</span>
      </div>
      <input
        type='checkbox'
        className='toggle flex-shrink-0'
        checked={checked}
        onChange={onChange}
      />
    </label>
  );
};

export default IntegrationsPanel;
