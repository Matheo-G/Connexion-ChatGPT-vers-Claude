/**
 * @file Links found in free text (the user's message to ChatGPT), so they
 * can be forwarded to the target AI even when the answer does not repeat them.
 */

/** http(s) URLs, stopping at whitespace and characters that cannot end a URL in prose. */
const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
/** Punctuation that usually belongs to the sentence, not to the URL. */
const TRAILING = /[.,;:!?»”’)\]}]+$/;

/**
 * @param {string} text
 * @returns {string[]} Unique URLs, in order of appearance.
 */
export function extractUrls(text) {
  const urls = String(text ?? '').match(URL_PATTERN) ?? [];
  const clean = urls.map((url) => {
    let result = url;
    // Keep a closing parenthesis that matches one inside the URL (Wikipedia-style links).
    while (TRAILING.test(result)) {
      const last = result.at(-1);
      if (last === ')' && (result.match(/\(/g)?.length ?? 0) >= (result.match(/\)/g)?.length ?? 0)) break;
      result = result.slice(0, -1);
    }
    return result;
  });
  return [...new Set(clean)].filter((url) => isValidUrl(url));
}

function isValidUrl(url) {
  try {
    return Boolean(new URL(url).hostname.includes('.'));
  } catch {
    return false;
  }
}

/**
 * Link to a Figma document (design, FigJam board, prototype, Make, Slides).
 * @param {string} url
 */
export function isFigmaUrl(url) {
  try {
    const { hostname, pathname } = new URL(url);
    const figmaHost = hostname === 'figma.com' || hostname.endsWith('.figma.com');
    return figmaHost && /^\/(design|file|proto|board|make|slides)\//.test(pathname);
  } catch {
    return false;
  }
}
