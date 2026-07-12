"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { dashboardPath, useCurrentUser } from "@/lib/use-current-user";
import type { Product } from "@/types/api";

type Testimonial = {
  name: string;
  text: string;
  service: string;
};

type InfoModal = "about" | "terms" | null;

const faqs = [
  {
    q: "چه سرویس‌هایی قابل خرید هستند؟",
    a: "در حال حاضر فقط Gemini، ChatGPT، Claude، Grok و Spotify ارائه می‌شود تا موجودی، پشتیبانی و تمدید هر سفارش دقیق‌تر پیگیری شود.",
  },
  {
    q: "زمان تحویل چقدر است؟",
    a: "بعد از ثبت سفارش و تکمیل اطلاعات لازم، فعال‌سازی معمولا در همان بازه کاری انجام می‌شود. اگر سرویس نیاز به تایید یا اطلاعات تکمیلی داشته باشد، از طریق تیکت اطلاع داده می‌شود.",
  },
  {
    q: "اشتراک‌ها اختصاصی هستند یا اشتراکی؟",
    a: "نوع دسترسی بسته به سرویس و پلن سفارش متفاوت است. قبل از تحویل، جزئیات نحوه استفاده، محدودیت‌ها و شرایط تمدید در پنل یا تیکت سفارش اعلام می‌شود.",
  },
  {
    q: "اگر اکانت یا اشتراک مشکل داشت چه می‌شود؟",
    a: "در صورت بروز مشکل، پشتیبانی سفارش را بررسی می‌کند و تا رفع مشکل، اصلاح دسترسی یا ارائه راهکار جایگزین موضوع را پیگیری می‌کند.",
  },
  {
    q: "برای تمدید باید سفارش جدید ثبت کنم؟",
    a: "برای تمدید می‌توانید از طریق پنل کاربری یا تیکت درخواست بدهید. بهتر است تمدید را قبل از پایان اعتبار ثبت کنید تا دسترسی بدون وقفه ادامه پیدا کند.",
  },
  {
    q: "پرداخت و پیگیری سفارش چگونه انجام می‌شود؟",
    a: "بعد از ثبت پرداخت، وضعیت سفارش از پنل کاربری قابل پیگیری است. پیام‌های مهم، اطلاعات فعال‌سازی و پاسخ پشتیبانی از همان مسیر ارسال می‌شود.",
  },
  {
    q: "امکان خرید چند اکانت برای تیم وجود دارد؟",
    a: "بله، برای سفارش‌های چندتایی یا تیمی می‌توانید از طریق پشتیبانی هماهنگ کنید تا تحویل، تمدید و مدیریت سفارش‌ها یکپارچه انجام شود.",
  },
  {
    q: "اطلاعات تماس پشتیبانی چیست؟",
    a: "پشتیبانی از طریق تیکت پنل کاربری انجام می‌شود. آدرس: بلوار ابن سینا- ابن سینا 8 و تلفن تماس: 0936 803 1148.",
  },
];

const testimonials: Testimonial[] = [
  {
    name: "آراد",
    text: "تحویل ChatGPT خیلی سریع بود و راهنمای ورود کامل ارسال شد.",
    service: "ChatGPT",
  },
  {
    name: "نیلوفر",
    text: "برای تمدید Claude پیام دادم و پشتیبانی خیلی منظم پیگیری کرد.",
    service: "Claude",
  },
  {
    name: "مانی",
    text: "Spotify بدون تبلیغ فعال شد و مشکلی در ورود نداشتم.",
    service: "Spotify",
  },
  {
    name: "سارا",
    text: "اکانت Gemini سریع فعال شد و همه چیز شفاف توضیح داده شد.",
    service: "Gemini",
  },
  {
    name: "امیر",
    text: "برای خرید تیمی Grok هماهنگی خوبی انجام شد.",
    service: "Grok",
  },
  {
    name: "رها",
    text: "قیمت‌ها مناسب بود و وضعیت سفارش را راحت پیگیری کردم.",
    service: "ChatGPT",
  },
  {
    name: "کیان",
    text: "پشتیبانی بعد از خرید هم پاسخگو بود و مشکل ورود را حل کرد.",
    service: "Claude",
  },
  {
    name: "هستی",
    text: "فرآیند خرید ساده بود و اطلاعات اشتراک کامل ارسال شد.",
    service: "Spotify",
  },
  {
    name: "پارسا",
    text: "تمدید ماهانه بدون دردسر انجام شد و دسترسی قطع نشد.",
    service: "Gemini",
  },
  {
    name: "الناز",
    text: "پاسخگویی سریع بود و سفارش دقیقا مطابق توضیحات تحویل شد.",
    service: "Grok",
  },
];

const marqueeTestimonials = [...testimonials, ...testimonials, ...testimonials];

const formatPrice = (price: number) =>
  new Intl.NumberFormat("fa-IR").format(price);

export default function Home() {
  const [query, setQuery] = useState("");
  const [infoModal, setInfoModal] = useState<InfoModal>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);

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

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent text-gray-900 transition-colors duration-300 dark:text-gray-100">
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
        <Header />

        <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-70 [mask-image:radial-gradient(60%_60%_at_50%_0%,black,transparent)]">
          <div className="mx-auto h-72 max-w-6xl bg-gradient-to-b from-fuchsia-500/20 via-indigo-500/10 to-transparent blur-2xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pb-14 lg:pt-12">
          <h1 className="mx-auto max-w-3xl animate-in fade-in slide-in-from-bottom-2 text-center text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
            فروشگاه اشتراک‌های دیجیتال
            <span className="block text-white dark:text-gray-950">
              ایجاد قیمت ها متفاوته
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl animate-in fade-in slide-in-from-bottom-2 text-center text-sm/7 opacity-80 delay-100 sm:text-base/8">
            خرید و تمدید اشتراک Gemini، ChatGPT، Claude، Grok و Spotify با
            تحویل سریع، پشتیبانی قابل پیگیری و رابطی ساده برای انتخاب سرویس.
          </p>

          <div className="mx-auto mt-6 max-w-2xl animate-in fade-in slide-in-from-bottom-2 delay-150">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 opacity-50" />
              <Input
                aria-label="جست‌وجوی سرویس"
                className="h-auto w-full rounded-2xl border-gray-200/70 bg-white/90 px-12 py-4 text-sm text-gray-900 shadow-sm outline-none transition placeholder:opacity-60 focus:border-indigo-400 focus:bg-white focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-gray-800/70 dark:bg-gray-900/80 dark:text-gray-100 dark:focus:border-fuchsia-500 dark:focus:bg-gray-900 dark:focus-visible:ring-fuchsia-500"
                placeholder="نام سرویس را جست‌وجو کنید..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs opacity-80">
              <span>محبوب‌ها:</span>
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

          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
            <TrustItem icon={Zap} label="تحویل فوری" />
            <TrustItem icon={ShieldCheck} label="گارانتی سلامت اکانت" />
            <TrustItem icon={CreditCard} label="پرداخت امن" />
            <TrustItem icon={Headphones} label="پشتیبانی ۲۴/۷" />
          </div>
        </div>
      </section>

        <section id="services" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white dark:text-gray-100 sm:text-xl">خدمات محبوب</h2>
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
            سرویسی با این نام پیدا نشد.
          </Card>
        ) : null}
      </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-l from-indigo-500/10 via-fuchsia-500/10 to-transparent p-6 dark:border-fuchsia-500/20">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_100%_0%,rgba(99,102,241,0.15),transparent_60%)]" />
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h3 className="text-lg font-extrabold text-white">شروع سریع با تحویل خودکار</h3>
              <p className="mt-1 text-sm text-white/85">
                سرویس را انتخاب کنید و اطلاعات اشتراک را با پشتیبانی مرحله‌به‌مرحله دریافت کنید.
              </p>
            </div>
            <Button
              asChild
              className="rounded-2xl bg-gray-900 px-5 py-2.5 text-sm text-white shadow-md transition hover:opacity-90 dark:bg-white dark:text-gray-900"
            >
              <Link href="#services">انتخاب محصول</Link>
            </Button>
          </div>
        </div>
      </section>

        <section className="pb-16">
        <div className="mx-auto mb-6 flex max-w-7xl items-end justify-between px-4 sm:px-6 lg:px-8">
          <h2 className="text-lg font-bold text-white dark:text-gray-100 sm:text-xl">نظر کاربران</h2>
          <div className="text-xs text-white/75 dark:text-gray-100/70">امتیاز میانگین ۴.۹ از ۵</div>
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

        <section id="faq" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-lg font-bold text-white dark:text-gray-100 sm:text-xl">سوالات پرتکرار</h2>
        <div className="overflow-hidden rounded-3xl border border-gray-200/70 bg-white dark:border-gray-800/70 dark:bg-gray-900">
          <Accordion type="single" collapsible>
            {faqs.map((item, index) => (
              <AccordionItem
                key={item.q}
                className="border-gray-200 px-5 dark:border-gray-800"
                value={`item-${index}`}
              >
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm opacity-80">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

        <Footer onOpenInfo={setInfoModal} />
      </div>

      {infoModal ? (
        <InfoDialog type={infoModal} onClose={() => setInfoModal(null)} />
      ) : null}
    </main>
  );
}

function Header() {
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
            alt="ویکی اکانت"
            className="h-9 w-9 rounded-2xl object-contain shadow-lg transition-transform group-hover:scale-105"
            height={36}
            priority
            src="/wiki-high-resolution-logo-transparent.png"
            width={36}
          />
          <span className="text-lg font-bold tracking-tight">ویکی اکانت</span>
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

function InfoDialog({ type, onClose }: { type: Exclude<InfoModal, null>; onClose: () => void }) {
  const isAbout = type === "about";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <DialogOverlay
      ariaLabel={isAbout ? "درباره ویکی اکانت" : "قوانین و مقررات ویکی اکانت"}
      className="bg-gray-950/65"
      contentClassName="max-w-2xl"
      onClose={onClose}
    >
      <section
        dir="rtl"
        className="relative max-h-[calc(100dvh-2rem)] overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl shadow-gray-950/25 dark:border-white/10 dark:bg-gray-950"
      >
        <header className="flex items-start gap-4 border-b border-gray-200/80 bg-gradient-to-l from-indigo-500/10 via-fuchsia-500/5 to-transparent p-5 dark:border-gray-800/80 sm:p-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/20">
            {isAbout ? <Info className="size-5" /> : <ScrollText className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold sm:text-2xl">
              {isAbout ? "درباره ویکی اکانت" : "قوانین و مقررات"}
            </h2>
            <p className="mt-1 text-xs opacity-60">
              {isAbout ? "آشنایی با خدمات و تعهدهای ما" : "آخرین به‌روزرسانی: تیر ۱۴۰۵"}
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
          {isAbout ? <AboutContent /> : <TermsContent />}
        </div>
      </section>
    </DialogOverlay>
  );
}

function AboutContent() {
  return (
    <div className="space-y-5">
      <p className="text-base leading-8">
        ویکی اکانت یک فروشگاه آنلاین برای خرید و تمدید اشتراک سرویس‌های دیجیتال است. هدف ما این است که دسترسی به ابزارهایی مانند ChatGPT، Gemini، Claude، Grok و Spotify را با فرایندی ساده، شفاف و قابل پیگیری فراهم کنیم.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["تحویل سریع", "بررسی و فعال‌سازی سفارش‌ها در کوتاه‌ترین زمان ممکن"],
          ["خرید شفاف", "نمایش مشخصات، مبلغ و شرایط هر سرویس پیش از پرداخت"],
          ["پشتیبانی واقعی", "پیگیری سفارش و مشکلات دسترسی از طریق تیکت پنل"],
        ].map(([title, description]) => (
          <div key={title} className="rounded-2xl border border-gray-200/80 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="font-bold">{title}</h3>
            <p className="mt-1 text-xs leading-6 opacity-70">{description}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/5">
        <h3 className="font-bold">تعهد ما به شما</h3>
        <p className="mt-1 opacity-80">
          اطلاعات هر محصول، نوع دسترسی و شرایط تمدید را تا حد ممکن روشن اعلام می‌کنیم و پس از خرید نیز تا پایان فرایند تحویل همراه شما هستیم. اگر مشکلی در سفارش ایجاد شود، تیم پشتیبانی موضوع را بررسی و راهکار مناسب را ارائه می‌کند.
        </p>
      </div>
      <p className="opacity-75">
        برای ارتباط با ما می‌توانید از بخش تیکت در پنل کاربری استفاده کنید یا با شماره ۰۹۳۶۸۰۳۱۱۴۸ تماس بگیرید.
      </p>
    </div>
  );
}

function TermsContent() {
  const terms = [
    ["۱. ثبت سفارش", "کاربر موظف است پیش از پرداخت، مشخصات محصول، نوع اشتراک، مدت اعتبار و اطلاعات موردنیاز برای فعال‌سازی را بررسی کند. مسئولیت صحت اطلاعات ثبت‌شده بر عهده کاربر است."],
    ["۲. پرداخت و قیمت", "مبلغ نهایی هر سفارش پیش از پرداخت نمایش داده می‌شود. ثبت سفارش تنها پس از پرداخت موفق و دریافت کد پیگیری قطعی است. تغییر قیمت‌ها روی سفارش‌های پرداخت‌شده اثر ندارد."],
    ["۳. تحویل سرویس", "زمان تحویل بسته به نوع سرویس و نیاز به تأیید اطلاعات متفاوت است. در صورت نیاز به اطلاعات تکمیلی، موضوع از طریق تیکت یا راه ارتباطی ثبت‌شده به کاربر اطلاع داده می‌شود."],
    ["۴. لغو و بازگشت وجه", "تا پیش از شروع فرایند فعال‌سازی، امکان درخواست لغو سفارش وجود دارد. پس از تحویل یا فعال‌شدن اشتراک، به دلیل ماهیت دیجیتال محصول، بازگشت وجه تنها در صورت نقص تأییدشده و حل‌نشدن مشکل توسط پشتیبانی انجام می‌شود."],
    ["۵. پشتیبانی و ضمانت", "در صورت بروز مشکل در بازه ضمانت اعلام‌شده برای محصول، کاربر باید از طریق تیکت اطلاع دهد. ضمانت شامل ایرادهای ناشی از استفاده نادرست، تغییر اطلاعات دسترسی بدون هماهنگی یا نقض قوانین سرویس‌دهنده اصلی نیست."],
    ["۶. نحوه استفاده", "کاربر متعهد است از سرویس خریداری‌شده مطابق قوانین سرویس‌دهنده اصلی استفاده کند و از واگذاری غیرمجاز، فعالیت خلاف قانون، ارسال هرزنامه یا اقداماتی که باعث مسدودشدن حساب می‌شود خودداری کند."],
    ["۷. حریم خصوصی", "اطلاعات کاربران فقط برای پردازش سفارش، ارائه پشتیبانی و انجام تعهدات فروشگاه استفاده می‌شود و جز در موارد الزام قانونی یا ضرورت ارائه خدمت، در اختیار اشخاص دیگر قرار نمی‌گیرد."],
    ["۸. تغییر شرایط", "ممکن است این مقررات برای هماهنگی با تغییر خدمات یا الزامات قانونی به‌روزرسانی شود. نسخه منتشرشده در همین صفحه، مبنای استفاده از خدمات ویکی اکانت خواهد بود."],
  ];

  return (
    <div className="space-y-5">
      <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-7">
        ثبت سفارش در ویکی اکانت به معنی مطالعه و پذیرش این شرایط است. لطفاً پیش از خرید، موارد زیر را با دقت بخوانید.
      </p>
      <div className="space-y-4">
        {terms.map(([title, description]) => (
          <article key={title}>
            <h3 className="font-bold">{title}</h3>
            <p className="mt-1 opacity-75">{description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function EnamadSeal() {
  const [loaded, setLoaded] = useState(false);

  return (
    <a
      referrerPolicy="origin"
      target="_blank"
      rel="noopener"
      href="https://trustseal.enamad.ir/?id=644002&Code=frDMiNn3bP7yVs4bFGR06i7W9nu4zxhe"
      className="inline-flex rounded-2xl border border-gray-200/70 bg-white p-3 shadow-sm transition hover:shadow-md dark:border-gray-800/70 dark:bg-gray-900"
      aria-label="نماد اعتماد الکترونیکی"
    >
      <span
        className={`grid h-24 w-24 place-items-center rounded-xl bg-gray-100 text-center text-xs leading-5 text-gray-500 dark:bg-gray-800 dark:text-gray-400 ${
          loaded ? "hidden" : ""
        }`}
      >
        نماد اعتماد
        <span className="mt-1 block h-2 w-14 animate-pulse rounded-full bg-gray-300 dark:bg-gray-700" />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        referrerPolicy="origin"
        src="https://trustseal.enamad.ir/logo.aspx?id=644002&Code=frDMiNn3bP7yVs4bFGR06i7W9nu4zxhe"
        alt="نماد اعتماد الکترونیکی"
        className={`h-24 w-24 object-contain ${loaded ? "block" : "hidden"}`}
        width="96"
        height="96"
        style={{ cursor: "pointer" }}
        onLoad={() => setLoaded(true)}
      />
    </a>
  );
}

function Footer({ onOpenInfo }: { onOpenInfo: (type: Exclude<InfoModal, null>) => void }) {
  return (
    <footer id="contact" className="border-t border-gray-200/70 bg-white py-10 text-sm dark:border-gray-800/70 dark:bg-gray-950">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_1fr_0.8fr] lg:px-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2">
            <Image
              alt="ویکی اکانت"
              className="h-9 w-9 rounded-2xl object-contain shadow-lg"
              height={36}
              src="/wiki-high-resolution-logo-transparent.png"
              width={36}
            />
            <span className="text-base font-extrabold">ویکی اکانت</span>
          </div>
          <p className="opacity-70">
            فروشگاه آنلاین خرید اشتراک سرویس‌های دیجیتال با تحویل سریع و پشتیبانی حرفه‌ای.
          </p>
        </div>

        <div>
          <div className="mb-3 font-bold">صفحات</div>
          <ul className="space-y-2 opacity-80">
            <li>
              <Link className="hover:opacity-100" href="/store">
                فروشگاه
              </Link>
            </li>
            <li>
              <Link className="hover:opacity-100" href="#services">
                خدمات
              </Link>
            </li>
            <li>
              <Link className="hover:opacity-100" href="#faq">
                سوالات
              </Link>
            </li>
            <li>
              <button
                className="transition hover:opacity-100"
                type="button"
                onClick={() => onOpenInfo("about")}
              >
                درباره ما
              </button>
            </li>
            <li>
              <button
                className="transition hover:opacity-100"
                type="button"
                onClick={() => onOpenInfo("terms")}
              >
                قوانین و مقررات
              </button>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-3 font-bold">پشتیبانی</div>
          <ul className="space-y-2 opacity-80">
            <li>تیکت در پنل کاربری</li>
            <li>آدرس : بلوار ابن سینا- ابن سینا 8</li>
            <li>
              تلفن: <span dir="ltr" className="inline-block">0936 803 1148</span>
            </li>
          </ul>
        </div>

        <div>
          <div className="mb-3 font-bold">نماد اعتماد</div>
          <EnamadSeal />
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-7xl px-4 text-center opacity-60 sm:px-6 lg:px-8">
        © {new Date().getFullYear()} ویکی اکانت - تمامی حقوق محفوظ است.
      </div>
    </footer>
  );
}
