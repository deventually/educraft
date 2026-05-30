import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

/**
 * Shared react-markdown plugin config so every Markdown surface (chat thread,
 * result panel, saved projects) renders identically: GFM tables/strikethrough
 * plus highlight.js syntax highlighting for fenced code blocks. `detect`
 * highlights blocks even when the model omits a language tag; `ignoreMissing`
 * keeps unknown languages (e.g. ```mermaid) from throwing.
 */
export const remarkPlugins = [remarkGfm];

// react-markdown's plugin tuple typing is stricter than the runtime needs.
export const rehypePlugins = [[rehypeHighlight, { detect: true, ignoreMissing: true }]] as never;
