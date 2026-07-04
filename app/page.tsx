"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CheckCircle,
  ChevronLeft,
  CreditCard,
  Headphones,
  Menu,
  Search,
  ShieldCheck,
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
import { Input } from "@/components/ui/input";

type Service = {
  id: string;
  name: string;
  tagline: string;
  price: number;
  short: string;
  features: string[];
};

type Testimonial = {
  name: string;
  text: string;
  service: string;
};

const services: Service[] = [
  {
    id: "gemini",
    name: "Gemini",
    tagline: "دستیار گوگل برای متن، تصویر و ایده‌پردازی",
    price: 390000,
    short: "Ge",
    features: ["فعال‌سازی سریع", "مناسب تولید محتوا", "پشتیبانی تمدید"],
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    tagline: "مکالمه، تحلیل، کدنویسی و تولید محتوا",
    price: 690000,
    short: "Ch",
    features: ["اکانت پایدار", "راهنمای شروع", "تحویل مرحله‌به‌مرحله"],
  },
  {
    id: "claude",
    name: "Claude",
    tagline: "نوشتن، خلاصه‌سازی و تحلیل متن‌های بلند",
    price: 620000,
    short: "Cl",
    features: ["مناسب متن‌های بلند", "تحویل امن", "پشتیبانی استفاده"],
  },
  {
    id: "grok",
    name: "Grok",
    tagline: "دسترسی سریع به هوش مصنوعی xAI",
    price: 540000,
    short: "Gr",
    features: ["فعال‌سازی اکانت", "تمدید ماهانه", "پیگیری وضعیت"],
  },
  {
    id: "spotify",
    name: "Spotify",
    tagline: "موسیقی بدون تبلیغ و دانلود آفلاین",
    price: 149000,
    short: "Sp",
    features: ["بدون تبلیغ", "دانلود آفلاین", "پلن فردی و خانوادگی"],
  },
];

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

  const filteredServices = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return services;
    }

    return services.filter(
      (service) =>
        service.name.toLowerCase().includes(value) ||
        service.tagline.toLowerCase().includes(value),
    );
  }, [query]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent text-gray-900 transition-colors duration-300 dark:text-gray-100">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-100">
        <Grainient
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
              {services.map((service) => (
                <button
                  key={service.id}
                  className="rounded-full border border-white/[0.55] bg-white/[0.65] px-3 py-1 text-gray-900 shadow-sm shadow-black/5 backdrop-blur-md transition hover:bg-white/[0.85] dark:border-white/15 dark:bg-white/[0.15] dark:text-white dark:hover:bg-white/25"
                  type="button"
                  onClick={() => setQuery(service.name)}
                >
                  {service.name}
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
          <span className="text-xs opacity-60">فقط ۵ سرویس فعال</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {filteredServices.map((service, index) => (
            <ServiceCard key={service.id} service={service} index={index} />
          ))}
        </div>
        {filteredServices.length === 0 ? (
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
              <Link href="#contact">ثبت سفارش</Link>
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

        <Footer />
      </div>
    </main>
  );
}

function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobileMenu = () => setMobileMenuOpen(false);

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
          <Button
            asChild
            className="hidden rounded-2xl bg-gray-900 px-4 py-2 text-sm text-white shadow-sm transition hover:opacity-90 md:inline-flex dark:bg-white dark:text-gray-900"
          >
            <Link href="#contact">ورود / ثبت‌نام</Link>
          </Button>
        </div>

        {mobileMenuOpen ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-50 rounded-3xl border border-white/50 bg-white/[0.82] p-2 shadow-2xl shadow-gray-950/10 backdrop-blur-2xl md:hidden dark:border-white/10 dark:bg-gray-950/[0.82] dark:shadow-black/30">
            <nav className="grid gap-1 text-sm font-medium">
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
              <Link
                className="rounded-2xl bg-gray-900 px-4 py-3 text-center text-white shadow-sm transition hover:opacity-90 dark:bg-white dark:text-gray-900"
                href="#contact"
                onClick={closeMobileMenu}
              >
                ورود / ثبت‌نام
              </Link>
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

function ServiceCard({ service, index }: { service: Service; index: number }) {
  return (
    <article
      className={`group relative overflow-hidden rounded-3xl border border-gray-200/70 bg-white p-5 shadow-sm transition hover:shadow-md animate-in fade-in slide-in-from-bottom-2 dark:border-gray-800/70 dark:bg-gray-900 lg:col-span-2 ${
        index === 3 ? "lg:col-start-2" : ""
      }`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold">{service.name}</h3>
          <p className="mt-1 text-xs opacity-70">{service.tagline}</p>
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow">
          <span className="text-xs font-bold">{service.short}</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm/6">
        {service.features.map((feature) => (
          <li key={feature} className="flex items-center gap-2">
            <CheckCircle className="size-4 text-indigo-500 dark:text-fuchsia-400" />
            <span className="opacity-90">{feature}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <div className="text-xs opacity-60">شروع قیمت از</div>
          <div className="mt-1 whitespace-nowrap text-2xl font-extrabold">
            {formatPrice(service.price)}
            <span className="me-1 text-sm font-medium opacity-70"> تومان</span>
          </div>
        </div>
        <Button
          asChild
          className="rounded-2xl bg-gray-900 px-4 py-2 text-sm text-white shadow-sm transition hover:opacity-90 dark:bg-white dark:text-gray-900"
        >
          <Link href="#contact">
            ثبت سفارش
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 w-full origin-left scale-x-0 bg-gradient-to-l from-fuchsia-500 to-indigo-500 transition-transform duration-300 group-hover:scale-x-100" />
    </article>
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

function Footer() {
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
              <Link className="hover:opacity-100" href="#">
                قوانین و مقررات
              </Link>
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
