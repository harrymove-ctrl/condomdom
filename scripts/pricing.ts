// What it costs, read from what a page says about itself. Shared by pnpm inbox and pnpm enrich.
export type Pricing = "free" | "freemium" | "paid" | "unknown";

const PAID = /\b(buy now|buy|purchase|get (?:all[- ]access|pro|lifetime|access)|lifetime (?:access|deal|license)|all[- ]access|upgrade to pro|go pro|pro plan|one[- ]time (?:payment|purchase)|per month|\/mo\b|\/month|commercial license|unlock (?:all|pro))\b|[$€£]\s?\d{1,4}\b/i;
const FREE = /\b(open[- ]source|mit licen[cs]e|100% free|free forever|completely free|free to use|free and open|copy (?:and|&) paste|copy[- ]paste|free components?)\b/i;

/** Pricing from what the page says about itself. Repos are free; a ".pro" site or a "-pro" page is paid. */
export function pricingOf(url: string, text: string): Pricing {
  const host = new URL(url).hostname;
  if (/(^|\.)(github|gitlab)\.com$/.test(host) || host.endsWith("github.io")) return "free";
  const proHint = /\.pro$/.test(host) || /[-/]pro(\b|$)/.test(new URL(url).pathname);
  const paid = proHint || PAID.test(text), free = FREE.test(text);
  return paid && free ? "freemium" : paid ? "paid" : free ? "free" : "unknown";
}

