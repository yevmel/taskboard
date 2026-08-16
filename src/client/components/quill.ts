import { Directive, directive } from "lit-html/directive.js";
import { nothing } from "lit-html";
import type { ElementPart } from "lit-html";
import Quill from "quill";
import "quill/dist/quill.snow.css";

/**
 * Quill rich text editor managed as a lit-html directive.
 *
 * `quillEditor(value, key)` is used on an empty `<div>`:
 *
 * ```ts
 * html`<div ${quillEditor(htmlString, "desc-1")}></div>`
 * ```
 *
 * The directive keeps a single Quill instance alive across re-renders (lit-html
 * reuses the same element and part, so typing is never interrupted). Content is
 * only replaced when the bound `value` changed from outside while the editor is
 * not focused, or when `key` changes — keys identify the logical owner of the
 * editor (e.g. `desc-<taskId>` or `comment-<taskId>-<commentCount>`, where the
 * count bumps after posting, which clears the editor).
 */

type ToolbarEntry = string[] | Array<string | Record<string, unknown>>;

const TOOLBAR: ToolbarEntry[] = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["blockquote", "code-block"],
  ["link", "image"],
  [{ color: [] }, { background: [] }],
  ["clean"],
];

const editors = new Map<string, Quill>();

/**
 * Read the current HTML content of the editor registered under `key`.
 * Returns "" when the editor is empty (or unknown).
 */
export function getEditorHtml(key: string): string {
  const quill = editors.get(key);
  if (!quill) return "";
  return quill.getText().trim().length === 0 ? "" : quill.root.innerHTML;
}

class QuillEditorDirective extends Directive {
  private quill: Quill | null = null;
  private currentKey: string | null = null;
  private lastValue = "";

  override render(_value: string, _key: string): typeof nothing {
    return nothing;
  }

  override update(part: ElementPart, [value, key]: [string, string]): typeof nothing {
    const element = part.element;
    // The directive must be used in element position (`<div ${quillEditor(...)}></div>`),
    // so the part is an ElementPart whose `.element` hosts the editor.
    if (!(element instanceof HTMLElement)) {
      throw new Error('quillEditor must be used on an element: html`<div ${quillEditor(value, key)}></div>`');
    }

    if (this.quill === null) {
      this.quill = new Quill(element, {
        theme: "snow",
        modules: { toolbar: TOOLBAR },
        placeholder: "Write something…",
      });
      editors.set(key, this.quill);
      this.currentKey = key;
      this.setValue(value);
    } else if (key !== this.currentKey) {
      // The same DOM node now belongs to a different owner (task switched, or a
      // comment was posted): replace the content.
      if (this.currentKey !== null) editors.delete(this.currentKey);
      editors.set(key, this.quill);
      this.currentKey = key;
      this.setValue(value);
    } else if (value !== this.lastValue && document.activeElement !== this.quill.root) {
      // Content changed from outside (e.g. after a save) while not typing.
      this.setValue(value);
    }

    return nothing;
  }

  private setValue(html: string): void {
    this.quill!.clipboard.dangerouslyPasteHTML(html);
    this.lastValue = html;
  }
}

export const quillEditor = directive(QuillEditorDirective);
