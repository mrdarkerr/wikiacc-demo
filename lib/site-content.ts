import {
  cloneDefaultSiteContent as cloneDefaultContent,
  defaultSiteContent,
} from "@/shared/default-site-content";
import type { SiteContent } from "@/types/api";

export const DEFAULT_SITE_CONTENT = defaultSiteContent as SiteContent;

export function cloneDefaultSiteContent(): SiteContent {
  return cloneDefaultContent() as SiteContent;
}

export function formatCopyright(template: string, year = new Date().getFullYear()) {
  return template.replaceAll("{year}", new Intl.NumberFormat("fa-IR", {
    useGrouping: false,
  }).format(year));
}
