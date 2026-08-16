import sanitizeHtml from "sanitize-html";
import type { Html } from "../shared/types.ts";

/**
 * Sanitization policy for rich text fields (task/subtask descriptions and
 * comment bodies) received over the API.
 *
 * The allowlist is tuned to the output of Quill.js, the editor used by the UI
 * (blockquotes, lists, code blocks, inline formatting, links, images and
 * inline styles), while still stripping scripts, event handlers, `iframe`s and
 * any other dangerous content.
 */
const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "hr",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "strike",
    "sub",
    "sup",
    "ol",
    "ul",
    "li",
    "blockquote",
    "pre",
    "code",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "span",
    "div",
    "a",
    "img",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel", "title"],
    img: ["src", "alt", "title", "width", "height"],
    // Quill uses classes such as `ql-align-center`, `ql-indent-1` and inline
    // styles for colors, fonts and sizes.
    span: ["style", "class"],
    p: ["style", "class"],
    div: ["style", "class"],
    li: ["class"],
    ol: ["class"],
    ul: ["class"],
    pre: ["class"],
    code: ["class"],
    h1: ["class"],
    h2: ["class"],
    h3: ["class"],
    h4: ["class"],
    h5: ["class"],
    h6: ["class"],
  },
  allowedStyles: {
    "*": {
      color: [
        /^#(0x)?[0-9a-f]+$/i,
        /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/,
        /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[0-9.]+\)$/,
      ],
      "background-color": [
        /^#(0x)?[0-9a-f]+$/i,
        /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/,
        /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[0-9.]+\)$/,
      ],
      "font-family": [/^[a-zA-Z0-9\s,'"-]+$/],
      "font-size": [/^\d+(\.\d+)?(px|em|rem|%)$/],
      "text-align": [/^(left|right|center|justify)$/],
    },
  },
  allowedSchemes: ["http", "https", "ftp", "mailto", "tel"],
  // Quill embeds pasted images as base64 data URIs.
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
  },
};

/** Sanitize untrusted rich text (HTML) received over the API. */
export function sanitizeRichText(html: Html): Html {
  return sanitizeHtml(html, RICH_TEXT_OPTIONS);
}
