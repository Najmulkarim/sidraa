import { describe, expect, it } from 'vitest';
import { descriptionToHtml } from '@/lib/description-html';

describe('descriptionToHtml', () => {
  it('shows headings, bold and each list style', () => {
    expect(descriptionToHtml('# Title\n## Key features\n- **Soft** lining\n• Dot\n➤ Arrow\n1. One\n2. Two\n\nMaterial: PU\nSecond line')).toBe(
      '<h1>Title</h1><h2>Key features</h2><ul data-kind="check"><li><b>Soft</b> lining</li></ul><ul data-kind="dot"><li>Dot</li></ul>'
      + '<ul data-kind="arrow"><li>Arrow</li></ul><ol><li>One</li><li>Two</li></ol><p>Material: PU<br>Second line</p>',
    );
  });
  it('escapes HTML typed as text', () => {
    expect(descriptionToHtml('<script>x</script> & "y"')).toBe('<p>&lt;script&gt;x&lt;/script&gt; &amp; &quot;y&quot;</p>');
  });
  it('shows pictures', () => {
    expect(descriptionToHtml('![a "b"](https://x.co/p.jpg)')).toBe('<p><img src="https://x.co/p.jpg" alt="a &quot;b&quot;"></p>');
  });
  it('is empty for no description', () => {
    expect(descriptionToHtml(null)).toBe('');
  });
});
