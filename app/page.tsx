"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  CheckCircle,
  ChevronLeft,
  CreditCard,
  Headphones,
  Info,
  Menu,
  Search,
  ShieldCheck,
  ScrollText,
  Star,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import Grainient from "@/components/Grainient";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DialogOverlay } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { DEFAULT_SITE_CONTENT, formatCopyright } from "@/lib/site-content";
import { dashboardPath, useCurrentUser } from "@/lib/use-current-user";
import type { Product, SiteContent } from "@/types/api";

type Testimonial = SiteContent["testimonials"]["items"][number];

type InfoModal = "about" | "terms" | null;

const CMS_SECTIONS = [
  "hero",
  "trust",
  "services",
  "cta",
  "testimonials",
  "faq",
  "footer",
  "about",
  "terms",
] as const;

type CmsSection = (typeof CMS_SECTIONS)[number];

const trustIcons = [Zap, ShieldCheck, CreditCard, Headphones] as const;

function isCmsSection(value: unknown): value is CmsSection {
  return typeof value === "string" && CMS_SECTIONS.some((section) => section === value);
}

function cmsSectionClass(isPreview: boolean, isSelected: boolean) {
  if (!isPreview) return "";
  return isSelected
    ? "relative cursor-pointer ring-4 ring-fuchsia-500 ring-inset"
    : "relative cursor-pointer outline outline-2 outline-dashed outline-indigo-400/60 outline-offset-[-2px]";
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("fa-IR").format(price);

export default function Home() {
  const [query, setQuery] = useState("");
  const [infoModal, setInfoModal] = useState<InfoModal>(null);
  const [siteContent, setSiteContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [cmsPreview, setCmsPreview] = useState(false);
  const [selectedSection, setSelectedSection] = useState<CmsSection | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const previewContentReceived = useRef(false);

  useEffect(() => {
    let active = true;
    const previewMode = new URLSearchParams(window.location.search).get("cmsPreview") === "1";
    const previewFrame = window.requestAnimationFrame(() => {
      if (active) setCmsPreview(previewMode);
    });

    function handlePreviewMessage(event: MessageEvent) {
      if (
        !previewMode ||
        event.origin !== window.location.origin ||
        event.source !== window.parent ||
        typeof event.data !== "object" ||
        event.data === null ||
        event.data.type !== "wikiacc:cms-preview" ||
        typeof event.data.content !== "object" ||
        event.data.content === null
      ) {
        return;
      }

      previewContentReceived.current = true;
      setSiteContent(event.data.content as SiteContent);

      const section = isCmsSection(event.data.selectedSection)
        ? event.data.selectedSection
        : null;
      setSelectedSection(section);
      setInfoModal(section === "about" || section === "terms" ? section : null);
    }

    if (previewMode) {
      window.addEventListener("message", handlePreviewMessage);
    }

    api.siteContent
      .get()
      .then((result) => {
        if (active && !previewContentReceived.current) {
          setSiteContent(result.content);
        }
      })
      .catch(() => {
        // The public page intentionally keeps the bundled defaults when content is unavailable.
      });

    return () => {
      active = false;
      window.cancelAnimationFrame(previewFrame);
      window.removeEventListener("message", handlePreviewMessage);
    };
  }, []);

  useEffect(() => {
    let active = true;

    api.catalog
      .products()
      .then((result) => {
        if (active) setProducts(result.products);
      })
      .catch(() => {
        if (active) setProductsError("دریافت محصولات انجام نشد. لطفاً دوباره تلاش کنید.");
      })
      .finally(() => {
        if (active) setProductsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadVersion]);

  function retryProducts() {
    setProductsLoading(true);
    setProductsError("");
    setLoadVersion((value) => value + 1);
  }

  function handleCmsClickCapture(event: ReactMouseEvent<HTMLElement>) {
    if (!cmsPreview) return;

    event.preventDefault();
    event.stopPropagation();

    const target = event.target;
    const sectionElement =
      target instanceof Element
        ? target.closest<HTMLElement>("[data-cms-section]")
        : null;
    const section = sectionElement?.dataset.cmsSection;
    if (!isCmsSection(section)) return;

    setSelectedSection(section);
    setInfoModal(section === "about" || section === "terms" ? section : null);
    window.parent.postMessage(
      { type: "wikiacc:cms-select", section },
      window.location.origin,
    );
  }

  const filteredProducts = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return products;
    }

    return products.filter(
      (product) =>
        product.title.toLowerCase().includes(value) ||
        product.description?.toLowerCase().includes(value) ||
        product.features?.some((feature) =>
          feature.title.toLowerCase().includes(value),
        ),
    );
  }, [products, query]);

  const marqueeTestimonials = useMemo(
    () => [
      ...siteContent.testimonials.items,
      ...siteContent.testimonials.items,
      ...siteContent.testimonials.items,
    ],
    [siteContent.testimonials.items],
  );

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-transparent text-gray-900 transition-colors duration-300 dark:text-gray-100"
      onClickCapture={handleCmsClickCapture}
    >
      {cmsPreview ? (
        <div className="pointer-events-none fixed left-3 top-3 z-[150] rounded-full border border-fuchsia-300/60 bg-gray-950/90 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur">
          حالت ویرایش
        </div>
      ) : null}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-100">
        <Grainient
          className="relative h-full min-h-dvh w-full overflow-hidden"
          color1="#ff9ffc"
          color2="#5227ff"
          color3="#030712"
          colorBalance={-0.08}
          grainAmount={0.14}
          grainAnimated
          noiseScale={3.25}
          saturation={1.35}
          timeSpeed={1.1}
          warpFrequency={5.8}
          warpStrength={0.82}
          zoom={0.78}
        />
      </div>
      <div className="pointer-events-none fixed inset-0 z-[1] bg-gray-50/20 dark:bg-gray-950/[0.18]" />
      <div className="relative z-10 pt-24">
        <Header brandName={siteContent.footer.brandName} />

        <section
          className={`relative ${cmsSectionClass(cmsPreview, selectedSection === "hero")}`}
          data-cms-section="hero"
        >
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-70 [mask-image:radial-gradient(60%_60%_at_50%_0%,black,transparent)]">
          <div className="mx-auto h-72 max-w-6xl bg-gradient-to-b from-fuchsia-500/20 via-indigo-500/10 to-transparent blur-2xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pb-14 lg:pt-12">
          <h1 className="mx-auto max-w-3xl animate-in fade-in slide-in-from-bottom-2 text-center text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
            {siteContent.hero.title}
            <span className="block text-white dark:text-gray-950">
              {siteContent.hero.highlight}
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl animate-in fade-in slide-in-from-bottom-2 text-center text-sm/7 opacity-80 delay-100 sm:text-base/8">
            {siteContent.hero.description}
          </p>

          <div className="mx-auto mt-6 max-w-2xl animate-in fade-in slide-in-from-bottom-2 delay-150">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 opacity-50" />
              <Input
                aria-label="جست‌وجوی سرویس"
                className="h-auto w-full rounded-2xl border-gray-200/70 bg-white/90 px-12 py-4 text-sm text-gray-900 shadow-sm outline-none transition placeholder:opacity-60 focus:border-indigo-400 focus:bg-white focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-gray-800/70 dark:bg-gray-900/80 dark:text-gray-100 dark:focus:border-fuchsia-500 dark:focus:bg-gray-900 dark:focus-visible:ring-fuchsia-500"
                placeholder={siteContent.hero.searchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs opacity-80">
              <span>{siteContent.hero.popularLabel}</span>
              {products.slice(0, 5).map((product) => (
                <button
                  key={product.id}
                  className="rounded-full border border-white/[0.55] bg-white/[0.65] px-3 py-1 text-gray-900 shadow-sm shadow-black/5 backdrop-blur-md transition hover:bg-white/[0.85] dark:border-white/15 dark:bg-white/[0.15] dark:text-white dark:hover:bg-white/25"
                  type="button"
                  onClick={() => setQuery(product.title)}
                >
                  {product.title}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4 ${cmsSectionClass(cmsPreview, selectedSection === "trust")}`}
            data-cms-section="trust"
          >
            {siteContent.trust.items.map((label, index) => {
              const Icon = trustIcons[index] ?? CheckCircle;
              return <TrustItem icon={Icon} key={`${label}-${index}`} label={label} />;
            })}
          </div>
        </div>
      </section>

        <section
          id="services"
          className={`mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 ${cmsSectionClass(cmsPreview, selectedSection === "services")}`}
          data-cms-section="services"
        >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white dark:text-gray-100 sm:text-xl">{siteContent.services.title}</h2>
          <span className="text-xs opacity-60">
            {productsLoading ? "در حال به‌روزرسانی" : `${new Intl.NumberFormat("fa-IR").format(products.length)} سرویس فعال`}
          </span>
        </div>
        {productsLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <ServiceCardSkeleton key={index} />
            ))}
          </div>
        ) : productsError ? (
          <Card className="rounded-3xl border-rose-200/70 bg-white/90 p-6 text-center text-sm shadow-sm dark:border-rose-900/70 dark:bg-gray-900/90">
            <p>{productsError}</p>
            <Button className="mt-4 rounded-2xl" type="button" variant="outline" onClick={retryProducts}>
              تلاش دوباره
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product, index) => (
              <ServiceCard key={product.id} product={product} index={index} />
            ))}
          </div>
        )}
        {!productsLoading && !productsError && filteredProducts.length === 0 ? (
          <Card className="mt-4 rounded-3xl border-gray-200/70 bg-white p-6 text-center text-sm shadow-sm dark:border-gray-800/70 dark:bg-gray-900">
            {siteContent.services.emptyMessage}
          </Card>
        ) : null}
      </section>

        <section
          className={`mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 ${cmsSectionClass(cmsPreview, selectedSection === "cta")}`}
          data-cms-section="cta"
        >
        <div className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-l from-indigo-500/10 via-fuchsia-500/10 to-transparent p-6 dark:border-fuchsia-500/20">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_100%_0%,rgba(99,102,241,0.15),transparent_60%)]" />
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h3 className="text-lg font-extrabold text-white">{siteContent.cta.title}</h3>
              <p className="mt-1 text-sm text-white/85">
                {siteContent.cta.description}
              </p>
            </div>
            <Button
              asChild
              className="rounded-2xl bg-gray-900 px-5 py-2.5 text-sm text-white shadow-md transition hover:opacity-90 dark:bg-white dark:text-gray-900"
            >
              <Link href="#services">{siteContent.cta.buttonLabel}</Link>
            </Button>
          </div>
        </div>
      </section>

        <section
          className={`pb-16 ${cmsSectionClass(cmsPreview, selectedSection === "testimonials")}`}
          data-cms-section="testimonials"
        >
        <div className="mx-auto mb-6 flex max-w-7xl items-end justify-between px-4 sm:px-6 lg:px-8">
          <h2 className="text-lg font-bold text-white dark:text-gray-100 sm:text-xl">{siteContent.testimonials.title}</h2>
          <div className="text-xs text-white/75 dark:text-gray-100/70">{siteContent.testimonials.ratingLabel}</div>
        </div>
        <div dir="ltr" className="marquee-shell relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-gray-50 to-transparent dark:from-gray-950" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-gray-50 to-transparent dark:from-gray-950" />
          <div className="marquee-track flex w-max min-w-full gap-4 px-4">
            {marqueeTestimonials.map((item, index) => (
              <TestimonialCard
                key={`${item.name}-${item.service}-${index}`}
                item={item}
              />
            ))}
          </div>
        </div>
      </section>

        <section
          id="faq"
          className={`mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8 ${cmsSectionClass(cmsPreview, selectedSection === "faq")}`}
          data-cms-section="faq"
        >
        <h2 className="mb-6 text-lg font-bold text-white dark:text-gray-100 sm:text-xl">{siteContent.faq.title}</h2>
        <div className="overflow-hidden rounded-3xl border border-gray-200/70 bg-white dark:border-gray-800/70 dark:bg-gray-900">
          <Accordion type="single" collapsible>
            {siteContent.faq.items.map((item, index) => (
              <AccordionItem
                key={`${item.question}-${index}`}
                className="border-gray-200 px-5 dark:border-gray-800"
                value={`item-${index}`}
              >
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent className="text-sm opacity-80">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

        <Footer
          cmsPreview={cmsPreview}
          content={siteContent}
          selectedSection={selectedSection}
          onOpenInfo={setInfoModal}
        />
      </div>

      {infoModal ? (
        <InfoDialog
          cmsPreview={cmsPreview}
          content={siteContent}
          selectedSection={selectedSection}
          type={infoModal}
          onClose={() => setInfoModal(null)}
        />
      ) : null}
    </main>
  );
}

function Header({ brandName }: { brandName: string }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { loading: authLoading, user } = useCurrentUser();
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const accountHref = user ? dashboardPath(user) : "/login";
  const accountLabel = user ? "داشبورد" : "ورود / ثبت‌نام";

  return (
    <header className="fixed inset-x-0 top-3 z-50 px-3 sm:px-6">
      <div className="relative mx-auto flex max-w-7xl items-center justify-between rounded-3xl border border-white/50 bg-white/70 px-4 py-3 shadow-lg shadow-gray-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-gray-950/60 dark:shadow-black/20 sm:px-6 lg:px-8">
        <Link className="group inline-flex items-center gap-3" href="#">
          <Image
            alt={brandName}
            className="h-9 w-9 rounded-2xl object-contain shadow-lg transition-transform group-hover:scale-105"
            height={36}
            priority
            src="/wiki-high-resolution-logo-transparent.png"
            width={36}
          />
          <span className="text-lg font-bold tracking-tight">{brandName}</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link className="text-sm opacity-80 transition hover:opacity-100" href="#services">
            خرید
          </Link>
          <Link className="text-sm opacity-80 transition hover:opacity-100" href="#services">
            خدمات
          </Link>
          <Link className="text-sm opacity-80 transition hover:opacity-100" href="#faq">
            سوالات
          </Link>
          <Link className="text-sm opacity-80 transition hover:opacity-100" href="#contact">
            تماس
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            aria-expanded={mobileMenuOpen}
            aria-label="باز کردن منو"
            className="size-10 rounded-xl border border-white/50 bg-white/70 text-gray-900 shadow-sm backdrop-blur-md transition hover:bg-white/90 md:hidden dark:border-white/10 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/20"
            size="icon"
            type="button"
            variant="outline"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </Button>
          {authLoading ? (
            <div
              aria-hidden="true"
              className="hidden h-10 w-28 animate-pulse rounded-2xl bg-gray-900/15 md:block dark:bg-white/15"
            />
          ) : (
            <Button
              asChild
              className="hidden rounded-2xl bg-gray-900 px-4 py-2 text-sm text-white shadow-sm transition hover:opacity-90 md:inline-flex dark:bg-white dark:text-gray-900"
            >
              <Link href={accountHref}>{accountLabel}</Link>
            </Button>
          )}
        </div>

        {mobileMenuOpen ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-50 rounded-3xl border border-white/60 bg-white/[0.94] p-2 shadow-2xl shadow-gray-950/10 backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-gray-950/[0.94] dark:shadow-black/30">
            <nav className="grid gap-1 text-sm font-medium">
              <Link
                className="rounded-2xl px-4 py-3 transition hover:bg-gray-900/5 dark:hover:bg-white/10"
                href="#services"
                onClick={closeMobileMenu}
              >
                خرید
              </Link>
              <Link
                className="rounded-2xl px-4 py-3 transition hover:bg-gray-900/5 dark:hover:bg-white/10"
                href="#services"
                onClick={closeMobileMenu}
              >
                خدمات
              </Link>
              <Link
                className="rounded-2xl px-4 py-3 transition hover:bg-gray-900/5 dark:hover:bg-white/10"
                href="#faq"
                onClick={closeMobileMenu}
              >
                سوالات
              </Link>
              <Link
                className="rounded-2xl px-4 py-3 transition hover:bg-gray-900/5 dark:hover:bg-white/10"
                href="#contact"
                onClick={closeMobileMenu}
              >
                تماس
              </Link>
              {authLoading ? (
                <div className="animate-pulse rounded-2xl bg-gray-900/10 px-4 py-3 text-center text-transparent dark:bg-white/10">
                  در حال بررسی
                </div>
              ) : (
                <Link
                  className="rounded-2xl bg-gray-900 px-4 py-3 text-center text-white shadow-sm transition hover:opacity-90 dark:bg-white dark:text-gray-900"
                  href={accountHref}
                  onClick={closeMobileMenu}
                >
                  {accountLabel}
                </Link>
              )}
            </nav>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function TrustItem({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-gray-200/60 bg-white/70 px-4 py-3 text-sm shadow-sm animate-in fade-in slide-in-from-bottom-2 dark:border-gray-800/60 dark:bg-gray-900/60">
      <span className="text-indigo-500 dark:text-fuchsia-400">
        <Icon className="size-5" />
      </span>
      <span>{label}</span>
    </div>
  );
}

function productInitials(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  return words.length > 1
    ? words.slice(0, 2).map((word) => word[0]).join("").toUpperCase()
    : title.slice(0, 2).toUpperCase();
}

function ServiceCard({ product, index }: { product: Product; index: number }) {
  return (
    <article
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-gray-200/70 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md animate-in fade-in slide-in-from-bottom-2 dark:border-gray-800/70 dark:bg-gray-900"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-bold">{product.title}</h3>
          {product.description ? (
            <p className="mt-1 line-clamp-2 text-xs/5 opacity-70">
              {product.description}
            </p>
          ) : null}
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow">
          <span className="text-xs font-bold">{productInitials(product.title)}</span>
        </div>
      </div>
      <ul className="mb-auto space-y-2 text-sm/6">
        {product.features?.map((feature) => (
          <li key={feature.id} className="flex items-center gap-2">
            <CheckCircle className="size-4 shrink-0 text-indigo-500 dark:text-fuchsia-400" />
            <span className="opacity-90">{feature.title}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <div className="text-xs opacity-60">شروع قیمت از</div>
          <div className="mt-1 whitespace-nowrap text-2xl font-extrabold">
            {formatPrice(product.price)}
            <span className="me-1 text-sm font-medium opacity-70"> تومان</span>
          </div>
        </div>
        <Button
          asChild
          className="rounded-2xl bg-gray-900 px-4 py-2 text-sm text-white shadow-sm transition hover:opacity-90 dark:bg-white dark:text-gray-900"
        >
          <Link href={`/store?product=${encodeURIComponent(product.slug)}`}>
            ثبت سفارش
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 w-full origin-left scale-x-0 bg-gradient-to-l from-fuchsia-500 to-indigo-500 transition-transform duration-300 group-hover:scale-x-100" />
    </article>
  );
}

function ServiceCardSkeleton() {
  return (
    <Card
      aria-hidden="true"
      className="min-h-64 animate-pulse rounded-3xl border-gray-200/70 bg-white/90 p-5 shadow-sm dark:border-gray-800/70 dark:bg-gray-900/90"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="h-5 w-28 rounded-full bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-3/4 rounded-full bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="size-10 rounded-2xl bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="flex items-center gap-2" key={index}>
            <div className="size-4 rounded-full bg-gray-200 dark:bg-gray-800" />
            <div className="h-3 w-36 rounded-full bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </div>
      <div className="mt-7 flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-20 rounded-full bg-gray-200 dark:bg-gray-800" />
          <div className="h-7 w-32 rounded-full bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="h-10 w-28 rounded-2xl bg-gray-200 dark:bg-gray-800" />
      </div>
    </Card>
  );
}

function TestimonialCard({ item }: { item: Testimonial }) {
  return (
    <Card
      dir="rtl"
      className="w-[285px] shrink-0 rounded-3xl border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800/70 dark:bg-gray-900 sm:w-[340px]"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 text-amber-500">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star key={index} className="size-4 fill-current" />
          ))}
        </div>
        <span className="rounded-full border border-indigo-500/20 px-2 py-0.5 text-[11px] text-indigo-500 dark:text-fuchsia-400">
          {item.service}
        </span>
      </div>
      <p className="min-h-14 text-sm leading-7 opacity-90">{item.text}</p>
      <div className="mt-4 text-xs opacity-70">{item.name}</div>
    </Card>
  );
}

function InfoDialog({
  cmsPreview,
  content,
  selectedSection,
  type,
  onClose,
}: {
  cmsPreview: boolean;
  content: SiteContent;
  selectedSection: CmsSection | null;
  type: Exclude<InfoModal, null>;
  onClose: () => void;
}) {
  const isAbout = type === "about";
  const modalContent = isAbout ? content.about : content.terms;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!cmsPreview && event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cmsPreview, onClose]);

  return (
    <DialogOverlay
      ariaLabel={modalContent.title}
      className="bg-gray-950/65"
      contentClassName="max-w-2xl"
      onClose={onClose}
    >
      <section
        dir="rtl"
        className={`relative max-h-[calc(100dvh-2rem)] overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl shadow-gray-950/25 dark:border-white/10 dark:bg-gray-950 ${cmsSectionClass(cmsPreview, selectedSection === type)}`}
        data-cms-section={type}
      >
        <header className="flex items-start gap-4 border-b border-gray-200/80 bg-gradient-to-l from-indigo-500/10 via-fuchsia-500/5 to-transparent p-5 dark:border-gray-800/80 sm:p-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/20">
            {isAbout ? <Info className="size-5" /> : <ScrollText className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold sm:text-2xl">
              {modalContent.title}
            </h2>
            <p className="mt-1 text-xs opacity-60">
              {modalContent.subtitle}
            </p>
          </div>
          <Button
            autoFocus
            aria-label="بستن پنجره"
            className="size-10 shrink-0 rounded-xl"
            size="icon"
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            <X className="size-5" />
          </Button>
        </header>

        <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto p-5 text-sm leading-8 sm:p-6">
          {isAbout ? (
            <AboutContent content={content.about} />
          ) : (
            <TermsContent content={content.terms} />
          )}
        </div>
      </section>
    </DialogOverlay>
  );
}

function AboutContent({ content }: { content: SiteContent["about"] }) {
  return (
    <div className="space-y-5">
      <p className="text-base leading-8">{content.intro}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {content.highlights.map((highlight, index) => (
          <div key={`${highlight.title}-${index}`} className="rounded-2xl border border-gray-200/80 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="font-bold">{highlight.title}</h3>
            <p className="mt-1 text-xs leading-6 opacity-70">{highlight.description}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/5">
        <h3 className="font-bold">{content.commitmentTitle}</h3>
        <p className="mt-1 opacity-80">{content.commitmentText}</p>
      </div>
      <p className="opacity-75">{content.contactText}</p>
    </div>
  );
}

function TermsContent({ content }: { content: SiteContent["terms"] }) {
  return (
    <div className="space-y-5">
      <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-7">
        {content.intro}
      </p>
      <div className="space-y-4">
        {content.items.map((item, index) => (
          <article key={`${item.title}-${index}`}>
            <h3 className="font-bold">{item.title}</h3>
            <p className="mt-1 opacity-75">{item.description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function EnamadSeal({ label }: { label: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <a
      referrerPolicy="origin"
      target="_blank"
      rel="noopener"
      href="https://trustseal.enamad.ir/?id=644002&Code=frDMiNn3bP7yVs4bFGR06i7W9nu4zxhe"
      className="inline-flex rounded-2xl border border-gray-200/70 bg-white p-3 shadow-sm transition hover:shadow-md dark:border-gray-800/70 dark:bg-gray-900"
      aria-label={label}
    >
      <span
        className={`grid h-24 w-24 place-items-center rounded-xl bg-gray-100 text-center text-xs leading-5 text-gray-500 dark:bg-gray-800 dark:text-gray-400 ${
          loaded ? "hidden" : ""
        }`}
      >
        {label}
        <span className="mt-1 block h-2 w-14 animate-pulse rounded-full bg-gray-300 dark:bg-gray-700" />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        referrerPolicy="origin"
        src="https://trustseal.enamad.ir/logo.aspx?id=644002&Code=frDMiNn3bP7yVs4bFGR06i7W9nu4zxhe"
        alt={label}
        className={`h-24 w-24 object-contain ${loaded ? "block" : "hidden"}`}
        width="96"
        height="96"
        style={{ cursor: "pointer" }}
        onLoad={() => setLoaded(true)}
      />
    </a>
  );
}

function Footer({
  cmsPreview,
  content,
  selectedSection,
  onOpenInfo,
}: {
  cmsPreview: boolean;
  content: SiteContent;
  selectedSection: CmsSection | null;
  onOpenInfo: (type: Exclude<InfoModal, null>) => void;
}) {
  const footer = content.footer;

  return (
    <footer
      id="contact"
      className={`border-t border-gray-200/70 bg-white py-10 text-sm dark:border-gray-800/70 dark:bg-gray-950 ${cmsSectionClass(cmsPreview, selectedSection === "footer")}`}
      data-cms-section="footer"
    >
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_1fr_0.8fr] lg:px-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2">
            <Image
              alt={footer.brandName}
              className="h-9 w-9 rounded-2xl object-contain shadow-lg"
              height={36}
              src="/wiki-high-resolution-logo-transparent.png"
              width={36}
            />
            <span className="text-base font-extrabold">{footer.brandName}</span>
          </div>
          <p className="opacity-70">{footer.description}</p>
        </div>

        <div>
          <div className="mb-3 font-bold">{footer.pagesTitle}</div>
          <ul className="space-y-2 opacity-80">
            <li>
              <Link className="hover:opacity-100" href="/store">
                فروشگاه
              </Link>
            </li>
            <li>
              <Link className="hover:opacity-100" href="#services">
                {content.services.title}
              </Link>
            </li>
            <li>
              <Link className="hover:opacity-100" href="#faq">
                {content.faq.title}
              </Link>
            </li>
            <li>
              <button
                className="transition hover:opacity-100"
                data-cms-section="about"
                type="button"
                onClick={() => onOpenInfo("about")}
              >
                {content.about.title}
              </button>
            </li>
            <li>
              <button
                className="transition hover:opacity-100"
                data-cms-section="terms"
                type="button"
                onClick={() => onOpenInfo("terms")}
              >
                {content.terms.title}
              </button>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-3 font-bold">{footer.supportTitle}</div>
          <ul className="space-y-2 opacity-80">
            <li>{footer.supportTicket}</li>
            <li>آدرس : {footer.address}</li>
            <li>
              تلفن: <span dir="ltr" className="inline-block">{footer.phone}</span>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-3 font-bold">{footer.trustTitle}</div>
          <EnamadSeal label={footer.trustTitle} />
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-7xl px-4 text-center opacity-60 sm:px-6 lg:px-8">
        {formatCopyright(footer.copyright)}
      </div>
    </footer>
  );
}
