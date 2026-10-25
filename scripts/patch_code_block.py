"""Patch body_setup.py to fix code_block function with proper HTML escaping."""
import re

path = '/home/z/my-project/scripts/body_setup.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the code_block function and replace it entirely
new_func = '''def code_block(text, story):
    """Append a code block with light card background and accent left border.

    Splits long code (>30 lines) into multiple chunks so each fits on a page.
    Uses html.escape for safe entity handling; non-breaking spaces preserve
    indentation in the rendered Paragraph.
    """
    import html as _html
    import re as _re
    lines = text.split('\\n')
    MAX_LINES = 30
    if len(lines) <= MAX_LINES:
        chunks = [lines]
    else:
        chunks = [lines[i:i + MAX_LINES] for i in range(0, len(lines), MAX_LINES)]

    story.append(Spacer(1, 6))
    for idx, chunk in enumerate(chunks):
        chunk_text = '\\n'.join(chunk)
        safe = _html.escape(chunk_text, quote=False)
        safe = safe.replace('\\n', '<br/>')
        # Preserve indentation: convert runs of 2+ spaces to non-breaking spaces
        safe = _re.sub(r' {2,}', lambda m: '\\u00a0' * len(m.group()), safe)
        # Single leading space after a <br/> tag -> nbsp (preserves one-space indent)
        safe = _re.sub(r'(<br/>) ', r'\\1\\u00a0', safe)
        p = Paragraph(safe, CODE_STYLE)

        tbl = Table([[p]], colWidths=[AVAILABLE_WIDTH], hAlign='CENTER')
        tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
            ('LINEBEFORE', (0, 0), (0, -1), 2, ACCENT),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(tbl)
        if idx < len(chunks) - 1:
            story.append(Spacer(1, 2))
    story.append(Spacer(1, 12))'''

# Match the existing code_block function (between 'def code_block' and the next '\ndef ' or end)
pattern = re.compile(r'def code_block\(text, story\):.*?(?=\ndef |\Z)', re.DOTALL)
new_content = pattern.sub(new_func + '\n\n', content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

# Verify
with open(path, 'r', encoding='utf-8') as f:
    verify = f.read()
print('Patched. code_block now contains html.escape:', '_html.escape' in verify)
print('MAX_LINES = 30 in code:', 'MAX_LINES = 30' in verify)
