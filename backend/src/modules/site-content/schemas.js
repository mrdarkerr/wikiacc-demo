import { z } from "zod";

function plainText(max, min = 1) {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !/[<>]/.test(value), {
      message: "HTML markup is not allowed",
    });
}

const label = (max = 160) => plainText(max);
const body = (max = 4_000) => plainText(max);

const testimonialSchema = z
  .object({
    name: label(100),
    service: label(100),
    text: body(1_500),
  })
  .strict();

const faqItemSchema = z
  .object({
    question: label(300),
    answer: body(4_000),
  })
  .strict();

const titledBodySchema = z
  .object({
    title: label(240),
    description: body(8_000),
  })
  .strict();

export const siteContentDocumentSchema = z
  .object({
    hero: z
      .object({
        title: label(180),
        highlight: label(180),
        description: body(1_500),
        searchPlaceholder: label(180),
        popularLabel: label(100),
      })
      .strict(),
    trust: z
      .object({
        items: z.array(label(120)).min(1).max(8),
      })
      .strict(),
    services: z
      .object({
        title: label(160),
        emptyMessage: body(500),
      })
      .strict(),
    cta: z
      .object({
        title: label(180),
        description: body(1_500),
        buttonLabel: label(100),
      })
      .strict(),
    testimonials: z
      .object({
        title: label(160),
        ratingLabel: label(120),
        items: z.array(testimonialSchema).max(24),
      })
      .strict(),
    faq: z
      .object({
        title: label(160),
        items: z.array(faqItemSchema).max(40),
      })
      .strict(),
    footer: z
      .object({
        brandName: label(160),
        description: body(1_500),
        pagesTitle: label(120),
        supportTitle: label(120),
        supportTicket: body(500),
        address: body(700),
        phone: label(80),
        trustTitle: label(120),
        copyright: body(400),
      })
      .strict(),
    about: z
      .object({
        title: label(180),
        subtitle: body(500),
        intro: body(6_000),
        highlights: z.array(titledBodySchema).max(12),
        commitmentTitle: label(180),
        commitmentText: body(6_000),
        contactText: body(4_000),
      })
      .strict(),
    terms: z
      .object({
        title: label(180),
        subtitle: body(500),
        intro: body(5_000),
        items: z.array(titledBodySchema).min(1).max(40),
      })
      .strict(),
  })
  .strict();

const expectedVersionSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);

export const saveSiteContentDraftSchema = z
  .object({
    content: siteContentDocumentSchema,
    expectedVersion: expectedVersionSchema,
  })
  .strict();

export const siteContentVersionSchema = z
  .object({
    expectedVersion: expectedVersionSchema,
  })
  .strict();
