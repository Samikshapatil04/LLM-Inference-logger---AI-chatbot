/**
 * Lightweight markdown → HTML renderer (no heavy deps).
 * Handles: code blocks, inline code, bold, italic, headings, lists, paragraphs.
 */
export function renderMarkdown(text) {
  if (!text) return '';

  // 1. Escape HTML
  let s = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Fenced code blocks
  s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code class="lang-${lang || 'text'}">${code.trim()}</code></pre>`
  );

  // 3. Inline code
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // 4. Bold / italic
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g,         '<em>$1</em>');
  s = s.replace(/___(.+?)___/g,       '<strong><em>$1</em></strong>');
  s = s.replace(/__(.+?)__/g,         '<strong>$1</strong>');
  s = s.replace(/_(.+?)_/g,           '<em>$1</em>');

  // 5. Headings
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  s = s.replace(/^# (.+)$/gm,   '<h1>$1</h1>');

  // 6. Horizontal rule
  s = s.replace(/^---+$/gm, '<hr/>');

  // 7. List items → wrap in <ul>
  s = s.replace(/((?:^[ \t]*[-*+] .+\n?)+)/gm, block => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[ \t]*[-*+] /, '').trim()}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // 8. Ordered list
  s = s.replace(/((?:^\d+\. .+\n?)+)/gm, block => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '').trim()}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  // 9. Paragraph wrapping (skip block-level tags)
  const BLOCK = /^<(pre|ul|ol|h[1-6]|hr|blockquote)/;
  s = s.split(/\n{2,}/).map(para => {
    para = para.trim();
    if (!para) return '';
    if (BLOCK.test(para)) return para;
    return `<p>${para.replace(/\n/g, '<br/>')}</p>`;
  }).join('\n');

  return s;
}
