import type { Metadata } from "next";

import { StorefrontClient } from "@/components/store/storefront-client";

export const metadata: Metadata = {
  title: "فروشگاه | ویکی اکانت",
};

export default function StorePage() {
  return <StorefrontClient />;
}
