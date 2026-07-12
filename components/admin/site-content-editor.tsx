"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  Home,
  Info,
  Loader2,
  MapPin,
  Megaphone,
  MessageSquareQuote,
  Monitor,
  Plus,
  Rocket,
  RotateCcw,
  Save,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Tablet,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { AdminState } from "@/components/admin/admin-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AdminSiteContentState, SiteContent } from "@/types/api";

type SectionKey =
  | "hero"
  | "trust"
  | "services"
  | "cta"
  | "testimonials"
  | "faq"
  | "footer"
  | "about"
  | "terms";

type Viewport = "desktop" | "tablet" | "mobile";

type Notice = {
  tone: "success" | "danger" | "muted";
  text: string;
};

const sections: Array<{
  key: SectionKey;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { key: "hero", label: "تیتر اصلی", description: "عنوان، توضیح و جست‌وجو", icon: Home },
  { key: "trust", label: "مزیت‌ها", description: "چهار ویژگی زیر تیتر", icon: ShieldCheck },
  { key: "services", label: "محصولات", description: "عنوان و پیام خالی", icon: ShoppingBag },
  { key: "cta", label: "دعوت به خرید", description: "بنر میانی صفحه", icon: Megaphone },
  { key: "testimonials", label: "نظر کاربران", description: "عنوان، امتیاز و نظرها", icon: MessageSquareQuote },
  { key: "faq", label: "سوالات متداول", description: "پرسش‌ها و پاسخ‌ها", icon: CircleHelp },
  { key: "footer", label: "فوتر و تماس", description: "آدرس، تلفن و کپی‌رایت", icon: MapPin },
  { key: "about", label: "درباره ما", description: "معرفی و تعهدها", icon: Info },
  { key: "terms", label: "قوانین", description: "مقدمه و بندهای قوانین", icon: ScrollText },
];

const viewports: Array<{
  key: Viewport;
  label: string;
  icon: LucideIcon;
  width: number;
  height: number;
}> = [
  { key: "desktop", label: "دسکتاپ", icon: Monitor, width: 1440, height: 900 },
  { key: "tablet", label: "تبلت", icon: Tablet, width: 768, height: 1024 },
  { key: "mobile", label: "موبایل", icon: Smartphone, width: 390, height: 844 },
];

const sectionKeys = new Set<SectionKey>(sections.map((section) => section.key));

function cloneContent(content: SiteContent) {
  return structuredClone(content);
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return "نسخه محتوا در پنجره دیگری تغییر کرده است. صفحه را دوباره بارگذاری کنید.";
    }
    if (error.status === 401 || error.status === 403) {
      return "برای مدیریت محتوا باید با حساب مدیر وارد شوید.";
    }
    return error.message;
  }
  return "ارتباط با سرور انجام نشد. دوباره تلاش کنید.";
}

function formatDate(value: string | null) {
  if (!value) return "هنوز منتشر نشده";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SiteContentEditor() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const [serverState, setServerState] = useState<AdminSiteContentState | null>(null);
  const [draft, setDraft] = useState<SiteContent | null>(null);
  const [selectedSection, setSelectedSection] = useState<SectionKey>("hero");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [previewAreaWidth, setPreviewAreaWidth] = useState(640);
  const [loading, setLoading] = useState(true);
  const [iframeReady, setIframeReady] = useState(false);
  const [busy, setBusy] = useState<"save" | "publish" | "reset" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const dirty = useMemo(
    () =>
      Boolean(
        draft &&
          serverState &&
          JSON.stringify(draft) !== JSON.stringify(serverState.content),
      ),
    [draft, serverState],
  );

  const hasPendingPublication = Boolean(
    dirty || serverState?.hasUnpublishedChanges,
  );

  const activeViewport =
    viewports.find((item) => item.key === viewport) ?? viewports[0];
  const previewScale = Math.min(
    1,
    previewAreaWidth / activeViewport.width,
    620 / activeViewport.height,
  );
  const scaledPreviewWidth = Math.round(activeViewport.width * previewScale);
  const scaledPreviewHeight = Math.round(activeViewport.height * previewScale);

  const loadContent = useCallback(async () => {
    try {
      const result = await api.admin.siteContent.get();
      setServerState(result);
      setDraft(cloneContent(result.content));
    } catch (error) {
      setNotice({ tone: "danger", text: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    api.admin.siteContent
      .get()
      .then((result) => {
        if (!active) return;
        setServerState(result);
        setDraft(cloneContent(result.content));
      })
      .catch((error) => {
        if (active) setNotice({ tone: "danger", text: errorMessage(error) });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;

    const confirmInternalNavigation = (event: MouseEvent) => {
      const target = event.target;
      const anchor =
        target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hash) return;
      if (
        !window.confirm(
          "تغییرات این صفحه هنوز ذخیره نشده‌اند. بدون ذخیره از صفحه خارج می‌شوید؟",
        )
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    document.addEventListener("click", confirmInternalNavigation, true);
    return () => document.removeEventListener("click", confirmInternalNavigation, true);
  }, [dirty]);

  useEffect(() => {
    const previewArea = previewAreaRef.current;
    if (!previewArea || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setPreviewAreaWidth(entry.contentRect.width);
    });
    observer.observe(previewArea);
    return () => observer.disconnect();
  }, []);

  const sendPreview = useCallback(() => {
    if (!draft || !iframeReady) return;
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "wikiacc:cms-preview",
        content: draft,
        selectedSection,
      },
      window.location.origin,
    );
  }, [draft, iframeReady, selectedSection]);

  useEffect(() => {
    sendPreview();
  }, [sendPreview]);

  useEffect(() => {
    const receiveSelection = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== iframeRef.current?.contentWindow ||
        event.data?.type !== "wikiacc:cms-select"
      ) {
        return;
      }
      const section = event.data.section as SectionKey;
      if (sectionKeys.has(section)) setSelectedSection(section);
    };

    window.addEventListener("message", receiveSelection);
    return () => window.removeEventListener("message", receiveSelection);
  }, []);

  function updateDraft(mutator: (content: SiteContent) => void) {
    setDraft((current) => {
      if (!current) return current;
      const next = cloneContent(current);
      mutator(next);
      return next;
    });
    setNotice(null);
  }

  async function saveCurrentDraft(options?: { silent?: boolean }) {
    if (!draft || !serverState) return null;
    const saved = await api.admin.siteContent.saveDraft({
      content: draft,
      expectedVersion: serverState.draftVersion,
    });
    setServerState(saved);
    setDraft(cloneContent(saved.content));
    if (!options?.silent) {
      setNotice({ tone: "success", text: "پیش‌نویس ذخیره شد." });
    }
    return saved;
  }

  async function handleSave() {
    if (!dirty) {
      setNotice({ tone: "muted", text: "تغییر تازه‌ای برای ذخیره وجود ندارد." });
      return;
    }
    setBusy("save");
    setNotice(null);
    try {
      await saveCurrentDraft();
    } catch (error) {
      setNotice({ tone: "danger", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function handlePublish() {
    if (!draft || !serverState) return;
    setBusy("publish");
    setNotice(null);
    try {
      let current = serverState;
      if (dirty) {
        const saved = await saveCurrentDraft({ silent: true });
        if (!saved) return;
        current = saved;
      }
      if (!current.hasUnpublishedChanges) {
        setNotice({ tone: "muted", text: "نسخه منتشرشده همین محتوا را دارد." });
        return;
      }
      const published = await api.admin.siteContent.publish({
        expectedVersion: current.draftVersion,
      });
      setServerState(published);
      setDraft(cloneContent(published.content));
      setNotice({ tone: "success", text: "تغییرات روی سایت منتشر شد." });
    } catch (error) {
      setNotice({ tone: "danger", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function handleReset() {
    if (!serverState) return;
    const confirmed = window.confirm(
      "پیش‌نویس و تغییرات ذخیره‌نشده حذف شوند و نسخه منتشرشده برگردد؟",
    );
    if (!confirmed) return;

    setBusy("reset");
    setNotice(null);
    try {
      const reset = await api.admin.siteContent.resetDraft({
        expectedVersion: serverState.draftVersion,
      });
      setServerState(reset);
      setDraft(cloneContent(reset.content));
      setNotice({ tone: "success", text: "نسخه منتشرشده به پیش‌نویس برگشت." });
    } catch (error) {
      setNotice({ tone: "danger", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[55vh] place-items-center rounded-xl border border-border bg-card">
        <div className="text-center">
          <Loader2 className="mx-auto size-7 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">در حال آماده‌سازی ویرایشگر سایت...</p>
        </div>
      </div>
    );
  }

  if (!draft || !serverState) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <AlertCircle className="mx-auto size-8 text-rose-500" />
        <AdminState tone="danger">
          {notice?.text ?? "محتوای سایت دریافت نشد."}
        </AdminState>
        <Button
          className="mt-4"
          type="button"
          onClick={() => {
            setLoading(true);
            setNotice(null);
            void loadContent();
          }}
        >
          تلاش دوباره
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="sticky top-16 z-20 rounded-xl border border-border bg-background/95 p-3 shadow-sm backdrop-blur sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold">ویرایشگر بصری سایت</h2>
              <Badge
                className={cn(
                  hasPendingPublication
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                )}
                variant="outline"
              >
                {dirty
                  ? "ذخیره‌نشده"
                  : serverState.hasUnpublishedChanges
                    ? "پیش‌نویس آماده انتشار"
                    : "همگام با سایت"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              آخرین انتشار: {formatDate(serverState.publishedAt)} · نسخه پیش‌نویس {new Intl.NumberFormat("fa-IR").format(serverState.draftVersion)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={Boolean(busy) || !hasPendingPublication}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => void handleReset()}
            >
              {busy === "reset" ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              بازگشت
            </Button>
            <Button
              disabled={Boolean(busy) || !dirty}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => void handleSave()}
            >
              {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />}
              ذخیره پیش‌نویس
            </Button>
            <Button
              disabled={Boolean(busy) || !hasPendingPublication}
              size="sm"
              type="button"
              onClick={() => void handlePublish()}
            >
              {busy === "publish" ? <Loader2 className="animate-spin" /> : <Rocket />}
              انتشار روی سایت
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/" target="_blank">
                مشاهده سایت
                <ExternalLink />
              </Link>
            </Button>
          </div>
        </div>

        {notice ? (
          <div
            className={cn(
              "mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
              notice.tone === "success" &&
                "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              notice.tone === "danger" &&
                "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
              notice.tone === "muted" && "border-border bg-muted text-muted-foreground",
            )}
          >
            {notice.tone === "success" ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : notice.tone === "danger" ? (
              <AlertCircle className="size-4 shrink-0" />
            ) : null}
            {notice.text}
          </div>
        ) : null}
      </header>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[190px_minmax(0,1fr)_360px]">
        <aside className="min-w-0 rounded-xl border border-border bg-card p-2 xl:sticky xl:top-44 xl:h-fit">
          <p className="px-2 pb-2 pt-1 text-xs font-medium text-muted-foreground">بخش‌های قابل ویرایش</p>
          <nav className="grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-1">
            {sections.map((section) => {
              const Icon = section.icon;
              const active = selectedSection === section.key;
              return (
                <button
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-lg px-3 py-2.5 text-right transition",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  key={section.key}
                  type="button"
                  onClick={() => setSelectedSection(section.key)}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold">{section.label}</span>
                    <span className={cn("mt-0.5 hidden truncate text-[10px] xl:block", active ? "opacity-75" : "opacity-70")}>
                      {section.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-muted/40">
          <div className="flex flex-col gap-2 border-b border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold">پیش‌نمایش زنده</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">روی هر قسمت سایت کلیک کنید تا فرم همان بخش باز شود.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-[10px] text-muted-foreground" aria-live="polite">
                {new Intl.NumberFormat("fa-IR").format(activeViewport.width)} × {new Intl.NumberFormat("fa-IR").format(activeViewport.height)} · مقیاس {new Intl.NumberFormat("fa-IR").format(Math.round(previewScale * 100))}٪
              </span>
              <div className="flex rounded-lg border border-border bg-background p-1">
                {viewports.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      aria-label={item.label}
                      className={cn(
                        "grid size-8 place-items-center rounded-md transition",
                        viewport === item.key
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      key={item.key}
                      title={item.label}
                      type="button"
                      onClick={() => setViewport(item.key)}
                    >
                      <Icon className="size-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            className="min-h-[420px] overflow-auto p-3 sm:p-5"
            dir="ltr"
            ref={previewAreaRef}
          >
            <div
              className="relative mx-auto overflow-hidden rounded-xl border border-border bg-white shadow-xl transition-[width,height] duration-300"
              style={{
                height: scaledPreviewHeight,
                width: scaledPreviewWidth,
              }}
            >
              <iframe
                className="absolute left-0 top-0 border-0 bg-white"
                ref={iframeRef}
                src="/?cmsPreview=1"
                style={{
                  height: activeViewport.height,
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top left",
                  width: activeViewport.width,
                }}
                title="پیش‌نمایش قابل ویرایش سایت"
                onLoad={() => setIframeReady(true)}
              />
            </div>
          </div>
        </section>

        <aside className="min-w-0 rounded-xl border border-border bg-card xl:sticky xl:top-44 xl:max-h-[calc(100dvh-12rem)] xl:overflow-y-auto">
          <div className="sticky top-0 z-10 border-b border-border bg-card p-4">
            <h3 className="font-bold">{sections.find((section) => section.key === selectedSection)?.label}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              تغییرات هم‌زمان در پیش‌نمایش دیده می‌شوند.
            </p>
          </div>
          <fieldset className="min-w-0 border-0 p-4 disabled:opacity-70" disabled={Boolean(busy)}>
            <SectionInspector content={draft} section={selectedSection} update={updateDraft} />
          </fieldset>
        </aside>
      </div>
    </div>
  );
}

function EditorField({
  label,
  value,
  onChange,
  multiline = false,
  hint,
  dir,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  hint?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium">{label}</span>
      {multiline ? (
        <textarea
          className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          dir={dir}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input dir={dir} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
      {hint ? <span className="block text-[11px] leading-5 text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function RepeaterCard({
  children,
  index,
  count,
  title,
  onDelete,
  onMove,
  disableDelete = false,
}: {
  children: ReactNode;
  index: number;
  count: number;
  title: string;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  disableDelete?: boolean;
}) {
  return (
    <article className="space-y-3 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold">{title}</span>
        <div className="flex items-center gap-1">
          <Button aria-label="انتقال به بالا" disabled={index === 0} size="icon" type="button" variant="ghost" onClick={() => onMove(-1)}>
            <ArrowUp />
          </Button>
          <Button aria-label="انتقال به پایین" disabled={index === count - 1} size="icon" type="button" variant="ghost" onClick={() => onMove(1)}>
            <ArrowDown />
          </Button>
          <Button aria-label="حذف" disabled={disableDelete} size="icon" type="button" variant="ghost" onClick={onDelete}>
            <Trash2 className="text-rose-500" />
          </Button>
        </div>
      </div>
      {children}
    </article>
  );
}

function AddButton({
  children,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button className="w-full" disabled={disabled} type="button" variant="outline" onClick={onClick}>
      <Plus />
      {children}
    </Button>
  );
}

function SectionInspector({
  content,
  section,
  update,
}: {
  content: SiteContent;
  section: SectionKey;
  update: (mutator: (content: SiteContent) => void) => void;
}) {
  if (section === "hero") {
    return (
      <div className="space-y-4">
        <EditorField label="عنوان اصلی" value={content.hero.title} onChange={(value) => update((next) => { next.hero.title = value; })} />
        <EditorField label="عبارت برجسته" value={content.hero.highlight} onChange={(value) => update((next) => { next.hero.highlight = value; })} />
        <EditorField multiline label="توضیح کوتاه" value={content.hero.description} onChange={(value) => update((next) => { next.hero.description = value; })} />
        <EditorField label="متن داخل جست‌وجو" value={content.hero.searchPlaceholder} onChange={(value) => update((next) => { next.hero.searchPlaceholder = value; })} />
        <EditorField label="برچسب محصولات محبوب" value={content.hero.popularLabel} onChange={(value) => update((next) => { next.hero.popularLabel = value; })} />
      </div>
    );
  }

  if (section === "trust") {
    return (
      <div className="space-y-4">
        <p className="text-xs leading-6 text-muted-foreground">این چهار متن کنار آیکن‌های ثابت نمایش داده می‌شوند.</p>
        {content.trust.items.map((item, index) => (
          <EditorField
            key={index}
            label={`مزیت ${new Intl.NumberFormat("fa-IR").format(index + 1)}`}
            value={item}
            onChange={(value) => update((next) => { next.trust.items[index] = value; })}
          />
        ))}
      </div>
    );
  }

  if (section === "services") {
    return (
      <div className="space-y-4">
        <EditorField label="عنوان بخش" value={content.services.title} onChange={(value) => update((next) => { next.services.title = value; })} />
        <EditorField multiline label="پیام نتیجه خالی" value={content.services.emptyMessage} onChange={(value) => update((next) => { next.services.emptyMessage = value; })} />
        <div className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 p-3 text-xs leading-6 text-muted-foreground">
          نام، قیمت و توضیح کارت‌های محصول از بخش محصولات مدیریت می‌شود.
          <Button asChild className="mt-2 px-0" size="sm" variant="link">
            <Link href="/admin/products">رفتن به مدیریت محصولات</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (section === "cta") {
    return (
      <div className="space-y-4">
        <EditorField label="عنوان بنر" value={content.cta.title} onChange={(value) => update((next) => { next.cta.title = value; })} />
        <EditorField multiline label="توضیح بنر" value={content.cta.description} onChange={(value) => update((next) => { next.cta.description = value; })} />
        <EditorField label="متن دکمه" value={content.cta.buttonLabel} onChange={(value) => update((next) => { next.cta.buttonLabel = value; })} />
      </div>
    );
  }

  if (section === "testimonials") {
    return (
      <div className="space-y-4">
        <EditorField label="عنوان بخش" value={content.testimonials.title} onChange={(value) => update((next) => { next.testimonials.title = value; })} />
        <EditorField label="متن امتیاز" value={content.testimonials.ratingLabel} onChange={(value) => update((next) => { next.testimonials.ratingLabel = value; })} />
        <div className="space-y-3">
          {content.testimonials.items.map((item, index) => (
            <RepeaterCard
              count={content.testimonials.items.length}
              index={index}
              key={index}
              title={`نظر ${new Intl.NumberFormat("fa-IR").format(index + 1)}`}
              onDelete={() => update((next) => { next.testimonials.items.splice(index, 1); })}
              onMove={(direction) => update((next) => { next.testimonials.items = moveItem(next.testimonials.items, index, direction); })}
            >
              <EditorField label="نام" value={item.name} onChange={(value) => update((next) => { next.testimonials.items[index].name = value; })} />
              <EditorField label="سرویس" value={item.service} onChange={(value) => update((next) => { next.testimonials.items[index].service = value; })} />
              <EditorField multiline label="متن نظر" value={item.text} onChange={(value) => update((next) => { next.testimonials.items[index].text = value; })} />
            </RepeaterCard>
          ))}
        </div>
        <AddButton disabled={content.testimonials.items.length >= 24} onClick={() => update((next) => { next.testimonials.items.push({ name: "نام مشتری", service: "نام سرویس", text: "متن نظر مشتری" }); })}>
          افزودن نظر
        </AddButton>
      </div>
    );
  }

  if (section === "faq") {
    return (
      <div className="space-y-4">
        <EditorField label="عنوان بخش" value={content.faq.title} onChange={(value) => update((next) => { next.faq.title = value; })} />
        <div className="space-y-3">
          {content.faq.items.map((item, index) => (
            <RepeaterCard
              count={content.faq.items.length}
              index={index}
              key={index}
              title={`سوال ${new Intl.NumberFormat("fa-IR").format(index + 1)}`}
              onDelete={() => update((next) => { next.faq.items.splice(index, 1); })}
              onMove={(direction) => update((next) => { next.faq.items = moveItem(next.faq.items, index, direction); })}
            >
              <EditorField label="پرسش" value={item.question} onChange={(value) => update((next) => { next.faq.items[index].question = value; })} />
              <EditorField multiline label="پاسخ" value={item.answer} onChange={(value) => update((next) => { next.faq.items[index].answer = value; })} />
            </RepeaterCard>
          ))}
        </div>
        <AddButton disabled={content.faq.items.length >= 40} onClick={() => update((next) => { next.faq.items.push({ question: "سوال جدید", answer: "پاسخ سوال جدید" }); })}>
          افزودن سوال
        </AddButton>
      </div>
    );
  }

  if (section === "footer") {
    return (
      <div className="space-y-4">
        <EditorField label="نام برند" value={content.footer.brandName} onChange={(value) => update((next) => { next.footer.brandName = value; })} />
        <EditorField multiline label="توضیح برند" value={content.footer.description} onChange={(value) => update((next) => { next.footer.description = value; })} />
        <EditorField label="عنوان ستون صفحات" value={content.footer.pagesTitle} onChange={(value) => update((next) => { next.footer.pagesTitle = value; })} />
        <EditorField label="عنوان ستون پشتیبانی" value={content.footer.supportTitle} onChange={(value) => update((next) => { next.footer.supportTitle = value; })} />
        <EditorField label="متن تیکت" value={content.footer.supportTicket} onChange={(value) => update((next) => { next.footer.supportTicket = value; })} />
        <EditorField multiline label="آدرس" value={content.footer.address} onChange={(value) => update((next) => { next.footer.address = value; })} />
        <EditorField dir="ltr" label="شماره تلفن" value={content.footer.phone} onChange={(value) => update((next) => { next.footer.phone = value; })} />
        <EditorField label="عنوان نماد اعتماد" value={content.footer.trustTitle} onChange={(value) => update((next) => { next.footer.trustTitle = value; })} />
        <EditorField hint="برای سال جاری از {year} استفاده کنید." label="کپی‌رایت" value={content.footer.copyright} onChange={(value) => update((next) => { next.footer.copyright = value; })} />
      </div>
    );
  }

  if (section === "about") {
    return (
      <div className="space-y-4">
        <EditorField label="عنوان" value={content.about.title} onChange={(value) => update((next) => { next.about.title = value; })} />
        <EditorField label="زیرعنوان" value={content.about.subtitle} onChange={(value) => update((next) => { next.about.subtitle = value; })} />
        <EditorField multiline label="متن معرفی" value={content.about.intro} onChange={(value) => update((next) => { next.about.intro = value; })} />
        <div className="space-y-3">
          {content.about.highlights.map((item, index) => (
            <RepeaterCard
              count={content.about.highlights.length}
              index={index}
              key={index}
              title={`ویژگی ${new Intl.NumberFormat("fa-IR").format(index + 1)}`}
              onDelete={() => update((next) => { next.about.highlights.splice(index, 1); })}
              onMove={(direction) => update((next) => { next.about.highlights = moveItem(next.about.highlights, index, direction); })}
            >
              <EditorField label="عنوان ویژگی" value={item.title} onChange={(value) => update((next) => { next.about.highlights[index].title = value; })} />
              <EditorField multiline label="توضیح ویژگی" value={item.description} onChange={(value) => update((next) => { next.about.highlights[index].description = value; })} />
            </RepeaterCard>
          ))}
        </div>
        <AddButton disabled={content.about.highlights.length >= 12} onClick={() => update((next) => { next.about.highlights.push({ title: "ویژگی جدید", description: "توضیح ویژگی جدید" }); })}>
          افزودن ویژگی
        </AddButton>
        <EditorField label="عنوان تعهد" value={content.about.commitmentTitle} onChange={(value) => update((next) => { next.about.commitmentTitle = value; })} />
        <EditorField multiline label="متن تعهد" value={content.about.commitmentText} onChange={(value) => update((next) => { next.about.commitmentText = value; })} />
        <EditorField multiline label="متن تماس" value={content.about.contactText} onChange={(value) => update((next) => { next.about.contactText = value; })} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <EditorField label="عنوان" value={content.terms.title} onChange={(value) => update((next) => { next.terms.title = value; })} />
      <EditorField label="متن تاریخ/زیرعنوان" value={content.terms.subtitle} onChange={(value) => update((next) => { next.terms.subtitle = value; })} />
      <EditorField multiline label="مقدمه قوانین" value={content.terms.intro} onChange={(value) => update((next) => { next.terms.intro = value; })} />
      <div className="space-y-3">
        {content.terms.items.map((item, index) => (
          <RepeaterCard
            count={content.terms.items.length}
            index={index}
            key={index}
            title={`بند ${new Intl.NumberFormat("fa-IR").format(index + 1)}`}
            disableDelete={content.terms.items.length <= 1}
            onDelete={() => update((next) => { next.terms.items.splice(index, 1); })}
            onMove={(direction) => update((next) => { next.terms.items = moveItem(next.terms.items, index, direction); })}
          >
            <EditorField label="عنوان بند" value={item.title} onChange={(value) => update((next) => { next.terms.items[index].title = value; })} />
            <EditorField multiline label="متن بند" value={item.description} onChange={(value) => update((next) => { next.terms.items[index].description = value; })} />
          </RepeaterCard>
        ))}
      </div>
      <AddButton disabled={content.terms.items.length >= 40} onClick={() => update((next) => { next.terms.items.push({ title: "بند جدید", description: "متن بند جدید" }); })}>
        افزودن بند
      </AddButton>
    </div>
  );
}
