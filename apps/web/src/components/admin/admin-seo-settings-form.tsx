'use client';

import { Globe, Search, Share2, ShieldAlert } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import type { MarketingPageSeoKey } from '@/domain/seo-settings-types';
import { AdminFormLoadingPanel } from '@/components/admin/admin-form-loading-panel';
import { AdminSettingsHint, AdminSettingsLabel } from '@/components/admin/admin-settings-hint';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  DEFAULT_SITE_DESCRIPTION,
  MARKETING_PAGE_SEO_DEFAULTS,
  MARKETING_PAGE_SEO_KEYS,
  MARKETING_PAGE_SEO_LABELS,
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_KEYWORDS_MAX_LENGTH,
  SEO_OG_IMAGE_URL_MAX_LENGTH,
  SEO_TITLE_MAX_LENGTH,
} from '@/lib/seo/seo-defaults';

const SEO_SETTINGS_API_URL: string = buildApiUrl('/api/admin/seo-settings');

type PageSeoOverrideValues = {
  readonly title: string;
  readonly description: string;
};

type SettingsPayload = {
  readonly defaultMetaDescription: string;
  readonly defaultOgImageUrl: string;
  readonly defaultKeywords: string;
  readonly titleSeparator: string;
  readonly googleSiteVerification: string;
  readonly bingSiteVerification: string;
  readonly twitterHandle: string;
  readonly noIndexSiteWide: boolean;
  readonly pageOverrides: Readonly<Record<MarketingPageSeoKey, PageSeoOverrideValues>>;
};

export type AdminSeoSettingsFormState = {
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly isLoading: boolean;
};

export type AdminSeoSettingsFormHandle = {
  readonly save: () => Promise<void>;
  readonly reset: () => void;
};

type AdminSeoSettingsFormProps = {
  readonly formRef?: Ref<AdminSeoSettingsFormHandle>;
  readonly onStateChange?: (state: AdminSeoSettingsFormState) => void;
};

function emptyPageOverrides(): Record<MarketingPageSeoKey, PageSeoOverrideValues> {
  return {
    home: { title: '', description: '' },
    diagnostic: { title: '', description: '' },
    book: { title: '', description: '' },
    blog: { title: '', description: '' },
    privacyPolicy: { title: '', description: '' },
    termsOfUse: { title: '', description: '' },
  };
}

function arePageOverridesEqual(
  left: Readonly<Record<MarketingPageSeoKey, PageSeoOverrideValues>>,
  right: Readonly<Record<MarketingPageSeoKey, PageSeoOverrideValues>>,
): boolean {
  for (const key of MARKETING_PAGE_SEO_KEYS) {
    const leftOverride = left[key];
    const rightOverride = right[key];
    if (leftOverride.title !== rightOverride.title || leftOverride.description !== rightOverride.description) {
      return false;
    }
  }
  return true;
}

function areSettingsEqual(left: SettingsPayload, right: SettingsPayload): boolean {
  return (
    left.defaultMetaDescription === right.defaultMetaDescription &&
    left.defaultOgImageUrl === right.defaultOgImageUrl &&
    left.defaultKeywords === right.defaultKeywords &&
    left.titleSeparator === right.titleSeparator &&
    left.googleSiteVerification === right.googleSiteVerification &&
    left.bingSiteVerification === right.bingSiteVerification &&
    left.twitterHandle === right.twitterHandle &&
    left.noIndexSiteWide === right.noIndexSiteWide &&
    arePageOverridesEqual(left.pageOverrides, right.pageOverrides)
  );
}

function SettingsCard(props: {
  readonly icon: ReactElement;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs">
      <div className="flex gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
          {props.icon}
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-foreground">{props.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{props.description}</p>
        </div>
      </div>
      {props.children}
    </section>
  );
}

function AdminSeoSettingsFormInner(props: AdminSeoSettingsFormProps, ref: Ref<AdminSeoSettingsFormHandle>): ReactElement {
  const [defaultMetaDescription, setDefaultMetaDescription] = useState<string>('');
  const [defaultOgImageUrl, setDefaultOgImageUrl] = useState<string>('');
  const [defaultKeywords, setDefaultKeywords] = useState<string>('');
  const [titleSeparator, setTitleSeparator] = useState<string>('');
  const [googleSiteVerification, setGoogleSiteVerification] = useState<string>('');
  const [bingSiteVerification, setBingSiteVerification] = useState<string>('');
  const [twitterHandle, setTwitterHandle] = useState<string>('');
  const [noIndexSiteWide, setNoIndexSiteWide] = useState<boolean>(false);
  const [pageOverrides, setPageOverrides] = useState<Record<MarketingPageSeoKey, PageSeoOverrideValues>>(
    emptyPageOverrides,
  );
  const [savedSnapshot, setSavedSnapshot] = useState<SettingsPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const onStateChangeRef = useRef(props.onStateChange);
  useEffect(() => {
    onStateChangeRef.current = props.onStateChange;
  }, [props.onStateChange]);
  const currentPayload: SettingsPayload = useMemo(
    () => ({
      defaultMetaDescription,
      defaultOgImageUrl,
      defaultKeywords,
      titleSeparator,
      googleSiteVerification,
      bingSiteVerification,
      twitterHandle,
      noIndexSiteWide,
      pageOverrides,
    }),
    [
      defaultMetaDescription,
      defaultOgImageUrl,
      defaultKeywords,
      titleSeparator,
      googleSiteVerification,
      bingSiteVerification,
      twitterHandle,
      noIndexSiteWide,
      pageOverrides,
    ],
  );
  const isDirty = savedSnapshot !== null && !areSettingsEqual(currentPayload, savedSnapshot);
  useEffect(() => {
    onStateChangeRef.current?.({ isDirty, isSaving, isLoading });
  }, [isDirty, isLoading, isSaving]);
  const executeLoad = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await fetch(SEO_SETTINGS_API_URL, { credentials: 'same-origin' });
      const data = (await response.json()) as SettingsPayload & { readonly error?: string };
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load SEO settings.');
      }
      const snapshot: SettingsPayload = {
        defaultMetaDescription: typeof data.defaultMetaDescription === 'string' ? data.defaultMetaDescription : '',
        defaultOgImageUrl: typeof data.defaultOgImageUrl === 'string' ? data.defaultOgImageUrl : '',
        defaultKeywords: typeof data.defaultKeywords === 'string' ? data.defaultKeywords : '',
        titleSeparator: typeof data.titleSeparator === 'string' ? data.titleSeparator : '',
        googleSiteVerification: typeof data.googleSiteVerification === 'string' ? data.googleSiteVerification : '',
        bingSiteVerification: typeof data.bingSiteVerification === 'string' ? data.bingSiteVerification : '',
        twitterHandle: typeof data.twitterHandle === 'string' ? data.twitterHandle : '',
        noIndexSiteWide: data.noIndexSiteWide === true,
        pageOverrides: {
          ...emptyPageOverrides(),
          ...(data.pageOverrides ?? {}),
        },
      };
      setDefaultMetaDescription(snapshot.defaultMetaDescription);
      setDefaultOgImageUrl(snapshot.defaultOgImageUrl);
      setDefaultKeywords(snapshot.defaultKeywords);
      setTitleSeparator(snapshot.titleSeparator);
      setGoogleSiteVerification(snapshot.googleSiteVerification);
      setBingSiteVerification(snapshot.bingSiteVerification);
      setTwitterHandle(snapshot.twitterHandle);
      setNoIndexSiteWide(snapshot.noIndexSiteWide);
      setPageOverrides(snapshot.pageOverrides);
      setSavedSnapshot(snapshot);
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to load SEO settings.');
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    queueMicrotask(() => {
      void executeLoad();
    });
  }, [executeLoad]);
  const executeSave = useCallback(async (): Promise<void> => {
    setIsSaving(true);
    try {
      const response = await fetch(SEO_SETTINGS_API_URL, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentPayload),
      });
      const data = (await response.json()) as SettingsPayload & { readonly error?: string };
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save SEO settings.');
      }
      const snapshot: SettingsPayload = {
        defaultMetaDescription: data.defaultMetaDescription,
        defaultOgImageUrl: data.defaultOgImageUrl,
        defaultKeywords: data.defaultKeywords,
        titleSeparator: data.titleSeparator,
        googleSiteVerification: data.googleSiteVerification,
        bingSiteVerification: data.bingSiteVerification,
        twitterHandle: data.twitterHandle,
        noIndexSiteWide: data.noIndexSiteWide,
        pageOverrides: {
          ...emptyPageOverrides(),
          ...data.pageOverrides,
        },
      };
      setSavedSnapshot(snapshot);
      notifySuccess('SEO settings saved.');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  }, [currentPayload]);
  const executeReset = useCallback((): void => {
    if (savedSnapshot === null) {
      return;
    }
    setDefaultMetaDescription(savedSnapshot.defaultMetaDescription);
    setDefaultOgImageUrl(savedSnapshot.defaultOgImageUrl);
    setDefaultKeywords(savedSnapshot.defaultKeywords);
    setTitleSeparator(savedSnapshot.titleSeparator);
    setGoogleSiteVerification(savedSnapshot.googleSiteVerification);
    setBingSiteVerification(savedSnapshot.bingSiteVerification);
    setTwitterHandle(savedSnapshot.twitterHandle);
    setNoIndexSiteWide(savedSnapshot.noIndexSiteWide);
    setPageOverrides(savedSnapshot.pageOverrides);
  }, [savedSnapshot]);
  useImperativeHandle(
    ref,
    () => ({
      save: executeSave,
      reset: executeReset,
    }),
    [executeReset, executeSave],
  );
  const executeUpdatePageOverride = useCallback(
    (pageKey: MarketingPageSeoKey, field: keyof PageSeoOverrideValues, value: string): void => {
      setPageOverrides((previous) => ({
        ...previous,
        [pageKey]: {
          ...previous[pageKey],
          [field]: value,
        },
      }));
    },
    [],
  );
  if (isLoading) {
    return <AdminFormLoadingPanel label="Loading SEO settings…" />;
  }
  return (
    <div className="space-y-6">
      <SettingsCard
        icon={<Globe className="size-5" aria-hidden />}
        title="Site defaults"
        description="Fallback meta description, social image, and keywords used when a page does not specify its own values."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <AdminSettingsLabel htmlFor="seo-default-description">Default meta description</AdminSettingsLabel>
            <Textarea
              id="seo-default-description"
              value={defaultMetaDescription}
              onChange={(event) => setDefaultMetaDescription(event.target.value)}
              placeholder={DEFAULT_SITE_DESCRIPTION}
              maxLength={SEO_DESCRIPTION_MAX_LENGTH}
              rows={3}
              className="min-h-18 resize-y"
            />
            <AdminSettingsHint>Recommended up to ~160 characters. Used by the root layout and as a page fallback.</AdminSettingsHint>
          </div>
          <div className="space-y-2">
            <AdminSettingsLabel htmlFor="seo-default-og-image">Default OG image URL or path</AdminSettingsLabel>
            <Input
              id="seo-default-og-image"
              value={defaultOgImageUrl}
              onChange={(event) => setDefaultOgImageUrl(event.target.value)}
              placeholder="/brand/techmd-mark-512x512.png"
              maxLength={SEO_OG_IMAGE_URL_MAX_LENGTH}
              className="font-mono text-sm"
            />
            <AdminSettingsHint>Accepts a site path or full https URL for Open Graph and Twitter cards.</AdminSettingsHint>
          </div>
          <div className="space-y-2">
            <AdminSettingsLabel htmlFor="seo-default-keywords">Default keywords</AdminSettingsLabel>
            <Input
              id="seo-default-keywords"
              value={defaultKeywords}
              onChange={(event) => setDefaultKeywords(event.target.value)}
              placeholder="keyword one, keyword two"
              maxLength={SEO_KEYWORDS_MAX_LENGTH}
            />
            <AdminSettingsHint>Comma-separated keywords merged into indexable marketing pages.</AdminSettingsHint>
          </div>
          <div className="space-y-2">
            <AdminSettingsLabel htmlFor="seo-title-separator">Title separator</AdminSettingsLabel>
            <Input
              id="seo-title-separator"
              value={titleSeparator}
              onChange={(event) => setTitleSeparator(event.target.value)}
              placeholder=" — "
              maxLength={20}
            />
            <AdminSettingsHint>Reserved for future title templates. Stored for consistency across pages.</AdminSettingsHint>
          </div>
        </div>
      </SettingsCard>
      <SettingsCard
        icon={<Search className="size-5" aria-hidden />}
        title="Search & social verification"
        description="Verification tokens for search consoles and an optional Twitter handle for social cards."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <AdminSettingsLabel htmlFor="seo-google-verification">Google Search Console verification</AdminSettingsLabel>
            <Input
              id="seo-google-verification"
              value={googleSiteVerification}
              onChange={(event) => setGoogleSiteVerification(event.target.value)}
              placeholder="Verification token from Google Search Console"
              maxLength={256}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <AdminSettingsLabel htmlFor="seo-bing-verification">Bing Webmaster verification</AdminSettingsLabel>
            <Input
              id="seo-bing-verification"
              value={bingSiteVerification}
              onChange={(event) => setBingSiteVerification(event.target.value)}
              placeholder="msvalidate.01 token"
              maxLength={256}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <AdminSettingsLabel htmlFor="seo-twitter-handle">Twitter @handle</AdminSettingsLabel>
            <Input
              id="seo-twitter-handle"
              value={twitterHandle}
              onChange={(event) => setTwitterHandle(event.target.value.replace(/^@+/, ''))}
              placeholder="teqmd"
              maxLength={50}
            />
            <AdminSettingsHint>Sets twitter:site on marketing pages when provided (without the @ prefix).</AdminSettingsHint>
          </div>
        </div>
      </SettingsCard>
      <SettingsCard
        icon={<ShieldAlert className="size-5" aria-hidden />}
        title="Crawling"
        description="Control whether indexable marketing pages should discourage search engine indexing."
      >
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/20 p-4">
          <Checkbox
            checked={noIndexSiteWide}
            onCheckedChange={(checked) => setNoIndexSiteWide(checked === true)}
            aria-describedby="seo-noindex-hint"
          />
          <span className="space-y-1">
            <span className="block text-sm font-medium text-foreground">Discourage search indexing site-wide</span>
            <p id="seo-noindex-hint" className="text-xs leading-relaxed text-muted-foreground">
              Adds noindex to marketing pages. Useful for staging. Does not change robots.txt disallow rules for admin,
              API, or account routes.
            </p>
          </span>
        </label>
      </SettingsCard>
      <SettingsCard
        icon={<Share2 className="size-5" aria-hidden />}
        title="Per-page meta overrides"
        description="Override title and description for static marketing routes. Blog articles keep their own SEO fields in the blog editor."
      >
        <div className="space-y-6">
          {MARKETING_PAGE_SEO_KEYS.map((pageKey) => {
            const defaults = MARKETING_PAGE_SEO_DEFAULTS[pageKey];
            const override = pageOverrides[pageKey] ?? { title: '', description: '' };
            return (
              <div key={pageKey} className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-4">
                <h3 className="text-sm font-semibold text-foreground">{MARKETING_PAGE_SEO_LABELS[pageKey]}</h3>
                <div className="space-y-2">
                  <AdminSettingsLabel htmlFor={`seo-page-${pageKey}-title`}>Meta title</AdminSettingsLabel>
                  <Input
                    id={`seo-page-${pageKey}-title`}
                    value={override.title}
                    onChange={(event) => executeUpdatePageOverride(pageKey, 'title', event.target.value)}
                    placeholder={defaults.title}
                    maxLength={SEO_TITLE_MAX_LENGTH}
                  />
                </div>
                <div className="space-y-2">
                  <AdminSettingsLabel htmlFor={`seo-page-${pageKey}-description`}>Meta description</AdminSettingsLabel>
                  <Textarea
                    id={`seo-page-${pageKey}-description`}
                    value={override.description}
                    onChange={(event) => executeUpdatePageOverride(pageKey, 'description', event.target.value)}
                    placeholder={defaults.description}
                    maxLength={SEO_DESCRIPTION_MAX_LENGTH}
                    rows={2}
                    className="min-h-14 resize-y"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </SettingsCard>
    </div>
  );
}

export const AdminSeoSettingsForm = forwardRef(AdminSeoSettingsFormInner);
