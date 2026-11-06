import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

async function render(sharebox = true) {
  const { DeliveryContentList } = await import("../components/order-delivery-content");
  return renderToStaticMarkup(createElement(DeliveryContentList, { deliveries: [{
    id: "fixture", contentSnapshot: "fixture-only",
    ...(sharebox ? { sharebox: { licenseKey: "fixture-only", expiresAt: "2027-01-01T00:00:00Z", validityDays: 30 } } : {}),
  }] }));
}
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it("delivers current Android and Windows releases from WikiAcc", async () => {
  vi.stubEnv("NEXT_PUBLIC_SHAREBOX_ANDROID_DOWNLOAD_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SHAREBOX_WINDOWS_DOWNLOAD_URL", "");
  const html = await render();
  expect(html).toContain('href="https://wikiacc.ir/dl/sharebox-android-v0.8.0-release.apk"');
  expect(html).toContain('href="https://wikiacc.ir/dl/ShareBox-0.2.5-x64-Setup.exe"');
});
it("preserves explicit deployment download overrides", async () => {
  vi.stubEnv("NEXT_PUBLIC_SHAREBOX_ANDROID_DOWNLOAD_URL", " https://example.com/app.apk ");
  vi.stubEnv("NEXT_PUBLIC_SHAREBOX_WINDOWS_DOWNLOAD_URL", " https://example.com/app.exe ");
  const html = await render();
  expect(html).toContain('href="https://example.com/app.apk"');
  expect(html).toContain('href="https://example.com/app.exe"');
});
it("does not add app download links to unrelated deliveries", async () => {
  const html = await render(false);
  expect(html).not.toContain("اپلیکیشن اندروید");
  expect(html).not.toContain("اپلیکیشن ویندوز");
});
