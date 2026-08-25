import { CustomTheme } from '@/styles/themes';
import { CustomFont } from '@/styles/fonts';
import { CustomTexture } from '@/styles/textures';
import { HighlightColor, HighlightStyle, UserHighlightColor, ViewSettings } from './book';
import { OPDSCatalog } from './opds';
import { ABSServer } from './audiobookshelf';
import type { AISettings } from '@/services/ai/types';
import type { NotebookTab } from '@/store/notebookStore';
import type { DictionarySettings, ImportedDictionary } from '@/services/dictionaries/types';

export type ThemeType = 'light' | 'dark' | 'auto';
export type LibraryViewModeType = 'grid' | 'list';
export const LibrarySortByType = {
  Title: 'title',
  Author: 'author',
  Updated: 'updated',
  Created: 'created',
  Series: 'series',
  Size: 'size',
  Format: 'format',
  Published: 'published',
  Progress: 'progress',
  TimeRemaining: 'timeRemaining',
} as const;

export type LibrarySortByType = (typeof LibrarySortByType)[keyof typeof LibrarySortByType];

/**
 * Secondary sort key. Same options as the primary sort key plus `'none'` which
 * disables the secondary sort. When set to `'none'` and a smart default applies
 * (e.g. groupBy=Author -> series), the resolver in `libraryUtils` substitutes
 * the implicit default at sort time without persisting it. See
 * `resolveEffectiveSecondarySort`.
 */
export type LibrarySecondarySortByType = LibrarySortByType | 'none';

export type LibraryCoverFitType = 'crop' | 'fit';

export const LibraryGroupByType = {
  None: 'none',
  Group: 'group',
  Series: 'series',
  Author: 'author',
  Tag: 'tag',
  Subject: 'subject',
} as const;

export type LibraryGroupByType = (typeof LibraryGroupByType)[keyof typeof LibraryGroupByType];

export type KOSyncChecksumMethod = 'binary' | 'filename';
export type KOSyncStrategy = 'prompt' | 'silent' | 'send' | 'receive';

export interface ReadSettings {
  sideBarWidth: string;
  isSideBarPinned: boolean;
  notebookWidth: string;
  isNotebookPinned: boolean;
  notebookActiveTab: NotebookTab;
  translationProvider: string;
  translateTargetLang: string;
  /**
   * Global Word Lens toggle: auto-download a gloss pack on demand when the
   * pair isn't cached locally. When off, the reader never fetches packs
   * silently; users download them explicitly from the Word Lens sub-page.
   */
  wordLensAutoDownload: boolean;
  highlightStyle: HighlightStyle;
  highlightStyles: Record<HighlightStyle, HighlightColor>;

  customHighlightColors: Record<HighlightColor, string>;
  userHighlightColors: UserHighlightColor[];
  defaultHighlightLabels: Partial<Record<HighlightColor, string>>;
  customTtsHighlightColors: string[];
  customThemes: CustomTheme[];
}

export interface KOSyncSettings {
  enabled: boolean;
  serverUrl: string;
  username: string;
  userkey: string;
  password?: string;
  deviceId: string;
  deviceName: string;
  checksumMethod: KOSyncChecksumMethod;
  strategy: KOSyncStrategy;
  customHeaders?: Record<string, string>;
  /**
   * Include the book's filename, title and authors in progress uploads, in the
   * optional `metadata` field KOReader 2026.05+ sends when "Send document
   * metadata" is enabled. The official sync server ignores it; custom
   * KOSync-compatible servers may use it to identify what is being read.
   * Off by default, matching KOReader.
   */
  sendMetadata?: boolean;
}

export interface BookOrbitSettings {
  enabled: boolean;
  /** Base server origin, e.g. https://books.example.com (no /api/v1/koreader suffix). */
  serverUrl: string;
  username: string;
  userkey: string;
  password?: string;
  deviceId: string;
  deviceName: string;
  strategy: KOSyncStrategy;
  syncProgress: boolean;
  /** Annotations and bookmarks. */
  syncNotes: boolean;
  syncStats: boolean;
  syncBookStates: boolean;
  customHeaders?: Record<string, string>;
}

export interface ReadwiseSettings {
  enabled: boolean;
  accessToken: string;
  lastSyncedAt: number;
  /**
   * Send the book cover with pushed highlights (image_url). Optional so
   * settings persisted before this option existed default to enabled.
   */
  includeCoverImage?: boolean;
  /**
   * Advanced: override the Readwise API base URL (e.g. for a self-hosted,
   * Readwise-compatible receiver). When unset or blank, the official
   * `READWISE_API_BASE_URL` is used.
   */
  baseUrl?: string;
}

export interface HardcoverSettings {
  enabled: boolean;
  accessToken: string;
  lastSyncedAt: number;
  // When true, progress + notes are pushed to Hardcover automatically as the
  // user reads (debounced) instead of only via the reader menu. Default OFF;
  // existing connected users (undefined) stay manual until they opt in.
  autoSync?: boolean;
}

/**
 * Google Drive file-sync settings. Sharing the same engine, sub-toggles,
 * and strategy vocabulary. Drive has no URL / credentials / root path (it
 * is OAuth + a fixed `/Readest` namespace under the `drive.file` scope),
 * and no BYO client. The OAuth token is NOT stored here — it lives in the
 * OS keychain. `deviceId` and `lastSyncedAt` are device-local (excluded
 * from cross-device restore).
 */
export interface GoogleDriveSettings {
  enabled: boolean;
  /** Connected account's email (or display name), shown in the settings UI. */
  accountLabel?: string;
  syncProgress?: boolean;
  syncNotes?: boolean;
  syncBooks?: boolean;
  fullSync?: boolean;
  strategy?: KOSyncStrategy;
  deviceId?: string;
  lastSyncedAt?: number;
  /**
   * Device-local wall-clock millis of when this provider was made the
   * selected cloud sync backend on THIS device. Anchors the mixed-fleet
   * detection probe: any native /api/sync row newer than this means
   * another device is still writing the gated channels.
   */
  providerSelectedAt?: number;
}

/**
 * User-facing sync categories. 'progress' gates the existing book-config
 * (reading progress) sync, 'note' gates annotations, 'book' gates book
 * binaries + metadata, 'dictionary' gates the imported-dictionary replica
 * sync. 'credentials' is a meta-toggle that gates the encrypted-credential
 * fields (OPDS username/password, KOSync credentials, Readwise / Hardcover
 * tokens) across whichever replica kinds carry them. Adding a new replica
 * kind extends this union.
 */
export type SyncCategory =
  | 'book'
  | 'progress'
  | 'note'
  | 'dictionary'
  | 'font'
  | 'texture'
  | 'opds_catalog'
  | 'abs_server'
  | 'settings'
  | 'credentials'
  | 'stats';

export const SYNC_CATEGORIES: readonly SyncCategory[] = [
  'book',
  'progress',
  'note',
  'dictionary',
  'font',
  'texture',
  'opds_catalog',
  'abs_server',
  'settings',
  'stats',
  'credentials',
] as const;

export interface KeyBinding {
  /** `native` = media keys forwarded by the OS bridge; `dom` = keyboard/D-pad keys. */
  source: 'native' | 'dom';
  /** Native key name (e.g. `MediaNext`) or DOM `event.code` (e.g. `ArrowLeft`). */
  id: string;
  /** Human-readable label shown in settings. */
  label: string;
  /** DOM modifier state. Optional so persisted single-key bindings remain valid. */
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  altGraphKey?: boolean;
}

export interface HardwarePageTurnerSettings {
  enabled: boolean;
  bindings: {
    pagePrev: KeyBinding | null;
    pageNext: KeyBinding | null;
    sectionPrev: KeyBinding | null;
    sectionNext: KeyBinding | null;
    /** E-ink full screen refresh (clears ghosting). Optional: absent on settings persisted before the feature existed. */
    refresh?: KeyBinding | null;
  };
}

export interface SystemSettings {
  version: number;
  migrationVersion: number;
  localBooksDir: string;
  customRootDir?: string;
  /**
   * Absolute paths the user has registered as "external library folders" —
   * directories managed by the user (or another reader app, e.g. Duokan,
   * Calibre, Moon+ Reader) that Readest should read in place instead of
   * copying into Books/<hash>/. Each entry must be an absolute path; entries
   * are matched as path-prefix roots when ingesting a file. Device-local
   * (path is meaningful only on this filesystem) and excluded from cloud
   * settings backups via `BACKUP_SETTINGS_BLACKLIST`.
   */
  externalLibraryFolders?: string[];
  /**
   * Absolute paths of the external library folders the user has opted into
   * auto-import for. On library open and whenever the app regains focus,
   * Readest re-scans each of these and imports any newly-added book files.
   * A subset of {@link externalLibraryFolders} (auto-import requires the
   * folder to be read in place). Set per-folder from the Import-from-Folder
   * dialog. Desktop + Android only. Device-local (paths are meaningful only
   * on this filesystem) and excluded from cloud settings backups via
   * `BACKUP_SETTINGS_BLACKLIST`.
   */
  autoImportFolders?: string[];
  /**
   * The subset of {@link autoImportFolders} the user imported with "Import all
   * into library" (flatten). Auto-imported books from those folders go straight
   * to the library root; every other watched folder mirrors its subfolders as
   * groups, matching the dialog's default "Create groups from subfolders" —
   * which is also what a folder watched before this list existed falls back to.
   * Device-local, and excluded from cloud settings backups alongside
   * {@link autoImportFolders}.
   */
  autoImportFlattenFolders?: string[];

  keepLogin: boolean;
  alwaysOnTop: boolean;
  openBookInNewWindow: boolean;
  autoCheckUpdates: boolean;
  updateChannel: 'stable' | 'nightly';
  screenWakeLock: boolean;
  autohideCursor: boolean;
  screenBrightness: number;
  autoScreenBrightness: boolean;
  swipeBrightnessGesture: boolean;
  hardwarePageTurner: HardwarePageTurnerSettings;
  alwaysShowStatusBar: boolean;
  openLastBooks: boolean;
  lastOpenBooks: string[];
  autoImportBooksOnOpen: boolean;
  savedBookCoverForLockScreen: string;
  savedBookCoverForLockScreenPath: string;
  telemetryEnabled: boolean;
  discordRichPresenceEnabled: boolean;
  libraryViewMode: LibraryViewModeType;
  librarySortBy: LibrarySortByType;
  librarySortAscending: boolean;
  /**
   * Whether the primary sort uses a smart default derived from `libraryGroupBy`.
   * When `true` and grouping by Series, the effective primary sort becomes
   * Series at sort time (the stored `librarySortBy` is left unchanged so users
   * who later turn auto off keep their previous explicit pick). Flipped to
   * `false` the moment the user picks any primary sort in the menu.
   */
  librarySortByAuto: boolean;
  libraryThenSortBy: LibrarySecondarySortByType;
  /** Sort order of the secondary ("Then by") key, independent of `librarySortAscending` (#5119). */
  libraryThenSortAscending: boolean;
  libraryGroupBy: LibraryGroupByType;
  libraryCoverFit: LibraryCoverFitType;
  libraryAutoColumns: boolean;
  libraryColumns: number;
  librarySkeuomorphicCovers: boolean;
  /**
   * When true, the library hides real cover images and shows a plain
   * title/author panel instead. Privacy escape hatch for when the shelf is
   * visible to others.
   */
  libraryHideCovers: boolean;
  /** Show the recently-read carousel at the top of the library (issue #3797). */
  libraryRecentShelfEnabled: boolean;
  /**
   * Library page background texture, configured independently from the reader
   * background (issue #4743). When any of these is undefined the library
   * inherits the corresponding `globalViewSettings.background*` value, so an
   * existing user's bookshelf looks unchanged until they pick a library
   * texture. Device-local (the texture *selection* never syncs, matching the
   * reader's `backgroundTextureId`); only the imported image binaries sync via
   * the `texture` replica kind. Resolved by `getLibraryViewSettings`.
   */
  libraryBackgroundTextureId?: string;
  libraryBackgroundOpacity?: number;
  libraryBackgroundSize?: string;
  customFonts: CustomFont[];
  customTextures: CustomTexture[];
  customDictionaries: ImportedDictionary[];
  dictionarySettings: DictionarySettings;
  opdsCatalogs: OPDSCatalog[];
  absServers: ABSServer[];
  metadataSeriesCollapsed: boolean;
  metadataOthersCollapsed: boolean;
  metadataDescriptionCollapsed: boolean;
  lastSyncedAtBooks: number;
  lastSyncedAtConfigs: number;
  lastSyncedAtNotes: number;

  /**
   * App-lock PIN. When `pinCodeEnabled` is true, the user must enter
   * a 4-digit PIN before the library/reader is rendered on app launch.
   * `pinCodeHash` is `bytesToHex(PBKDF2-SHA256(pin, hexToBytes(pinCodeSalt)))`,
   * never the plaintext PIN. Cleared together with `pinCodeEnabled = false`
   * when the user disables the lock.
   */
  pinCodeEnabled?: boolean;
  pinCodeHash?: string;
  pinCodeSalt?: string;
  /**
   * Mobile-only. When true AND a PIN lock is configured AND the device
   * has enrolled biometrics, the app-lock screen prompts for biometrics
   * (fingerprint / Face ID) first and falls back to the PIN. No effect on
   * desktop/web (no biometric plugin). `undefined` is treated as `false`
   * so existing PIN users are never silently switched to biometric.
   */
  biometricUnlockEnabled?: boolean;

  kosync: KOSyncSettings;
  bookorbit: BookOrbitSettings;
  readwise: ReadwiseSettings;
  hardcover: HardcoverSettings;
  googleDrive: GoogleDriveSettings;

  aiSettings: AISettings;
  /**
   * Per-device id used as the deviceId portion of every HLC this device
   * mints. Lazy-generated on first sync init via uuidv4 (mirrors
   * kosync.deviceId). Independent from kosync — the two services have
   * distinct identifier semantics and rotation policies.
   */
  replicaDeviceId?: string;
  /**
   * Per-kind cursor for replica sync. Stores the HLC string of the last
   * pulled row per kind. Absent kinds pull from the beginning.
   */
  lastSyncedAtReplicas?: Record<string, string>;
  /**
   * Per-category sync toggles. Missing keys default to ON. The
   * 'progress' category gates the existing book-config (reading
   * progress) sync; 'note' gates annotation sync; 'book' gates book
   * binary + metadata sync; 'dictionary' gates the imported-dictionary
   * replica sync. Future replica kinds add new SyncCategory members.
   */
  syncCategories?: Partial<Record<SyncCategory, boolean>>;

  // Global read settings that apply to the reader page
  globalReadSettings: ReadSettings;
  // Global view settings that apply to all books, and can be overridden by book-specific view settings
  globalViewSettings: ViewSettings;
}
