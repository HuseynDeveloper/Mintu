/**
 * Safe, zero-dependency Markdown & Code Renderer for Mintu
 * Strictly sanitizes HTML to prevent XSS.
 * Renders headings, lists, inline code, and fenced code blocks with Copy buttons.
 */

export class MarkdownRenderer {
  /**
   * Escape raw HTML entities to prevent any injection
   */
  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Render markdown string to sanitized HTML
   */
  public static render(markdown: string): string {
    if (!markdown) return "";

    // 1. Extract fenced code blocks to protect them from inline markdown parsing
    const codeBlocks: string[] = [];
    let processed = markdown.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
      const escapedCode = this.escapeHtml(code.trimEnd());
      const safeLang = lang ? this.escapeHtml(lang.trim()) : "text";
      const index = codeBlocks.length;

      const blockHtml = `
        <div class="mintu-code-block" data-code-index="${index}">
          <div class="code-block-header">
            <span class="code-lang-tag">${safeLang}</span>
            <button class="code-copy-btn" title="Copy code" onclick="window.__mintuCopyCode?.(this)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copy</span>
            </button>
          </div>
          <pre><code class="language-${safeLang}">${escapedCode}</code></pre>
        </div>
      `.trim();

      codeBlocks.push(blockHtml);
      return `%%MINTU_CODE_BLOCK_${index}%%`;
    });

    // 2. Escape remaining HTML
    processed = this.escapeHtml(processed);

    // 3. Headings (# H1, ## H2, ### H3)
    processed = processed.replace(/^### (.*$)/gim, '<h3 class="mintu-md-h3">$1</h3>');
    processed = processed.replace(/^## (.*$)/gim, '<h2 class="mintu-md-h2">$1</h2>');
    processed = processed.replace(/^# (.*$)/gim, '<h1 class="mintu-md-h1">$1</h1>');

    // 4. Blockquotes (> quote)
    processed = processed.replace(/^\> (.*$)/gim, '<blockquote class="mintu-md-quote">$1</blockquote>');

    // 5. Bold & Italic
    processed = processed.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
    processed = processed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    processed = processed.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // 6. Inline code (`code`)
    processed = processed.replace(/`([^`]+)`/g, '<code class="mintu-inline-code">$1</code>');

    // 7. Markdown links [text](url) - only http/https allowed
    processed = processed.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="mintu-md-link">$1</a>'
    );

    // 8. Lists (- item or * item)
    processed = processed.replace(/^\s*[-*]\s+(.*)$/gim, '<li class="mintu-md-li">$1</li>');
    // Group adjacent <li> into <ul>
    processed = processed.replace(/(<li class="mintu-md-li">[\s\S]*?<\/li>)+/g, '<ul class="mintu-md-ul">$&</ul>');

    // 9. Numbered lists (1. item)
    processed = processed.replace(/^\s*(\d+)\.\s+(.*)$/gim, '<li class="mintu-md-oli">$2</li>');
    // Group adjacent <li class="mintu-md-oli"> into <ol>
    processed = processed.replace(/(<li class="mintu-md-oli">[\s\S]*?<\/li>)+/g, '<ol class="mintu-md-ol">$&</ol>');

    // 10. Paragraphs & Line Breaks
    // Replace double newlines with paragraph separators
    const paragraphs = processed.split(/\n\n+/);
    processed = paragraphs
      .map((p) => {
        p = p.trim();
        if (!p) return "";
        // Don't wrap if it's already a block tag
        if (
          p.startsWith("<h") ||
          p.startsWith("<ul") ||
          p.startsWith("<ol") ||
          p.startsWith("<blockquote") ||
          p.startsWith("%%MINTU_CODE_BLOCK_")
        ) {
          return p;
        }
        return `<p class="mintu-md-p">${p.replace(/\n/g, "<br/>")}</p>`;
      })
      .filter(Boolean)
      .join("\n");

    // 11. Restore code blocks
    processed = processed.replace(/%%MINTU_CODE_BLOCK_(\d+)%%/g, (_m, idx) => {
      return codeBlocks[parseInt(idx, 10)] || "";
    });

    return processed;
  }
}

// Global copy button handler for code fences
if (typeof window !== "undefined") {
  (window as any).__mintuCopyCode = (btn: HTMLElement) => {
    const codeBlock = btn.closest(".mintu-code-block");
    if (!codeBlock) return;
    const codeEl = codeBlock.querySelector("code");
    if (!codeEl) return;

    const textToCopy = codeEl.textContent || "";
    navigator.clipboard.writeText(textToCopy).then(() => {
      const span = btn.querySelector("span");
      if (span) {
        const orig = span.textContent;
        span.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(() => {
          span.textContent = orig;
          btn.classList.remove("copied");
        }, 2000);
      }
    });
  };
}
