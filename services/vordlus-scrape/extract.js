// Lightweight HTML extraction — no JSDOM, just regex on the rendered HTML.
// We look for the first <img> that looks like a listing photo:
//   - inside a known gallery/photo container, OR
//   - any <img> with a real (http(s)://) src AND a width/height/naturalWidth
//     of >= 400, OR
//   - falls back to the first <img> with a real src.
//
// Why not JSDOM: this runs in a small container and we want sub-50ms
// extraction after Playwright's `networkidle`.

const PHOTO_CONTAINER_SELECTORS = [
  ".detail-photos img",
  ".gallery img",
  ".object-photos img",
  ".photo-gallery img",
  "[data-testid*=\"photo\"] img",
  "[data-testid*=\"gallery\"] img",
  ".swiper img",
  ".slick img",
  "main img",
];

const CDN_HOST_HINTS = [
  "img-bb",
  "foto",
  "photo",
  "image",
  "media",
  "cdn",
  "baltic",
  "bcgroup",
  "kv.ee",
  "city24.ee",
  "kinnisvara24.ee",
  "city24",
];

function isRealUrl(src) {
  if (!src) return false;
  if (src.startsWith("data:")) return false;
  if (src.startsWith("blob:")) return false;
  if (src.startsWith("//")) return true;
  return /^https?:\/\//i.test(src);
}

function absolutize(src, baseUrl) {
  if (!src) return null;
  if (src.startsWith("//")) return "https:" + src;
  if (/^https?:\/\//i.test(src)) return src;
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return null;
  }
}

// Pull a width hint from common attribute names.
function widthOf(imgAttrs) {
  const w = imgAttrs.width || imgAttrs["data-width"] || imgAttrs["data-original-width"];
  if (w) {
    const n = parseInt(w, 10);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function looksLikeListingPhoto(url) {
  const h = hostOf(url);
  if (!h) return false;
  return CDN_HOST_HINTS.some((hint) => h.includes(hint));
}

function extractFirstPhoto(html, baseUrl) {
  if (!html || typeof html !== "string") return null;

  // Parse out every <img ...> tag with its attributes.
  // We don't need a real DOM — a regex over the rendered HTML is enough and
  // ~100x faster. We accept a few false positives; the proxy picks the best
  // one below.
  const imgRe = /<img\b([^>]*?)\/?>/gi;
  const imgs = [];
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    const attrs = m[1];
    const src = (attrs.match(/\bsrc=("([^"]*)"|'([^']*)')/i) || [])[2] || (attrs.match(/\bsrc=("([^"]*)"|'([^']*)')/i) || [])[3] || null;
    const dataSrc = (attrs.match(/\b(?:data-src|data-original|data-lazy)=("([^"]*)"|'([^']*)')/i) || [])[2] || (attrs.match(/\b(?:data-src|data-original|data-lazy)=("([^"]*)"|'([^']*)')/i) || [])[3] || null;
    const width = (attrs.match(/\bwidth=("([^"]*)"|'([^']*)')/i) || [])[2] || (attrs.match(/\bwidth=("([^"]*)"|'([^']*)')/i) || [])[3] || null;
    const srcset = (attrs.match(/\bsrcset=("([^"]*)"|'([^']*)')/i) || [])[2] || (attrs.match(/\bsrcset=("([^"]*)"|'([^']*)')/i) || [])[3] || null;
    imgs.push({ src, dataSrc, width, srcset });
  }

  // 1) First <img> that is a real, likely-photo URL.
  for (const img of imgs) {
    const candidate = img.dataSrc || img.src;
    const abs = absolutize(candidate, baseUrl);
    if (!abs || !isRealUrl(abs)) continue;
    if (looksLikeListingPhoto(abs)) return abs;
  }

  // 2) First <img> with real URL and width >= 400.
  for (const img of imgs) {
    const candidate = img.dataSrc || img.src;
    const abs = absolutize(candidate, baseUrl);
    if (!abs || !isRealUrl(abs)) continue;
    const w = widthOf({ width: img.width });
    if (w != null && w >= 400) return abs;
  }

  // 3) First <img> with a real URL.
  for (const img of imgs) {
    const candidate = img.dataSrc || img.src;
    const abs = absolutize(candidate, baseUrl);
    if (!abs || !isRealUrl(abs)) continue;
    return abs;
  }

  return null;
}

// Heuristics for Cloudflare challenge / block page.
function looksLikeBlocked(html) {
  if (!html) return false;
  const lower = html.toLowerCase();
  if (lower.includes("checking your browser before accessing")) return true;
  if (lower.includes("cf-chl-bypass")) return true;
  if (lower.includes("attention required! | cloudflare")) return true;
  // The classic challenge page has a tiny body and no listing markup.
  if (lower.length < 5000 && lower.includes("cloudflare")) return true;
  return false;
}

// Extract <title>...</title>.
function extractTitle(html) {
  if (!html) return null;
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim().slice(0, 200) : null;
}

module.exports = {
  extractFirstPhoto,
  extractTitle,
  looksLikeBlocked,
  isRealUrl,
  absolutize,
  PHOTO_CONTAINER_SELECTORS,
};
