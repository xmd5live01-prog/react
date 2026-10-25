import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "a", "blockquote", "br", "div", "em", "h2", "h3", "h4", "hr", "li",
  "ol", "p", "s", "span", "strong", "u", "ul",
];
const SAFE_COLOR_NAMES = new Set([
  "black", "blue", "gray", "green", "maroon", "navy", "olive", "purple",
  "red", "silver", "teal", "white", "yellow",
]);
const SAFE_STYLE_PROPERTIES = new Set([
  "background-color", "color", "font-size", "font-style", "font-weight",
  "text-align", "text-decoration", "white-space",
]);

function isSafeColor(value) {
  return /^#[\da-f]{3,8}$/i.test(value)
    || /^rgba?\([\d\s.,%]+\)$/i.test(value)
    || SAFE_COLOR_NAMES.has(value.toLowerCase());
}

function isSafeStyleValue(property, value) {
  if (property === "color" || property === "background-color") return isSafeColor(value);
  if (property === "font-size") {
    return /^(?:xx-small|x-small|small|medium|large|x-large|xx-large|larger|smaller|\d+(?:\.\d+)?(?:px|pt|em|rem|%))$/i.test(value);
  }
  if (property === "font-style") return /^(?:normal|italic|oblique)$/i.test(value);
  if (property === "font-weight") return /^(?:normal|bold|[1-9]00)$/i.test(value);
  if (property === "text-align") return /^(?:left|right|center|justify|start|end)$/i.test(value);
  if (property === "text-decoration") return /^(?:none|underline|line-through|overline|underline line-through)$/i.test(value);
  if (property === "white-space") return /^(?:normal|pre|pre-wrap|pre-line|nowrap)$/i.test(value);
  return false;
}

export function sanitizeRichText(value) {
  if (typeof value !== "string" || !value) return "";

  const purified = DOMPurify.sanitize(value, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "rel", "target", "style"],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
  const parsed = new DOMParser().parseFromString(purified, "text/html");

  for (const element of parsed.body.querySelectorAll("*")) {
    const style = element.getAttribute("style");
    if (style) {
      const safeDeclarations = [];
      for (const declaration of style.split(";")) {
        const separator = declaration.indexOf(":");
        if (separator < 0) continue;
        const property = declaration.slice(0, separator).trim().toLowerCase();
        const value = declaration.slice(separator + 1).trim();
        if (SAFE_STYLE_PROPERTIES.has(property) && isSafeStyleValue(property, value)) {
          safeDeclarations.push(`${property}: ${value}`);
        }
      }
      if (safeDeclarations.length) element.setAttribute("style", safeDeclarations.join("; "));
      else element.removeAttribute("style");
    }

    if (element.tagName === "A") {
      const href = element.getAttribute("href");
      if (href) {
        try {
          const parsedUrl = new URL(href, window.location.origin);
          if (!["http:", "https:", "mailto:"].includes(parsedUrl.protocol)) element.removeAttribute("href");
        } catch {
          element.removeAttribute("href");
        }
      }
      if (element.getAttribute("target") === "_blank") element.setAttribute("rel", "noopener noreferrer");
      else element.removeAttribute("target");
    }
  }

  return parsed.body.innerHTML;
}
