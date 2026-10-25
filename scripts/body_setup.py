"""
Jashore Blood Network — Architecture & Foundation Plan
Body PDF generation script (ReportLab).

Pipeline:
  1. Register fonts (English-only: FreeSerif body, SarasaMonoSC code, DejaVuSans symbols)
  2. Install font fallback (handles any incidental CJK / symbol glyphs)
  3. Apply cascade palette (auto-generated, no hardcoded hex)
  4. Build TocDocTemplate with custom page templates:
        - frontmatter (Roman page numbers, used for TOC)
        - body (Arabic page numbers, resets to 1)
  5. multiBuild() to populate TOC
  6. Output: /home/z/my-project/scripts/body.pdf (cover merged later via pypdf)

Output target: ~60-90 pages, single PDF, English only.
"""

import os
import sys
import hashlib

# ---------------------------------------------------------------------------
# Path setup — make pdf skill scripts importable for install_font_fallback()
# ---------------------------------------------------------------------------
PDF_SKILL_DIR = "/home/z/my-project/skills/pdf"
_scripts = os.path.join(PDF_SKILL_DIR, "scripts")
if _scripts not in sys.path:
    sys.path.insert(0, _scripts)

# ---------------------------------------------------------------------------
# ReportLab imports
# ---------------------------------------------------------------------------
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm, cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate, BaseDocTemplate, PageTemplate, Frame,
    Paragraph, Spacer, PageBreak, CondPageBreak,
    Table, TableStyle, Image, KeepTogether, HRFlowable, NextPageTemplate,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ---------------------------------------------------------------------------
# Font registration — English-only document
# FreeSerif for body/headings, SarasaMonoSC for code, DejaVuSans for symbols
# ---------------------------------------------------------------------------
FONT_DIR = '/usr/share/fonts'

pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))

pdfmetrics.registerFont(TTFont('FreeSans', f'{FONT_DIR}/truetype/freefont/FreeSans.ttf'))
pdfmetrics.registerFont(TTFont('FreeSans-Bold', f'{FONT_DIR}/truetype/freefont/FreeSansBold.ttf'))

pdfmetrics.registerFont(TTFont('SarasaMonoSC', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Regular.ttf'))

pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))

# Register CJK fallback fonts (used by install_font_fallback for any incidental glyphs)
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))

# Link font families — enables <b>, <i>, <super>, <sub> tags
registerFontFamily('FreeSerif',
    normal='FreeSerif', bold='FreeSerif-Bold',
    italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('FreeSans', normal='FreeSans', bold='FreeSans-Bold')
registerFontFamily('SarasaMonoSC', normal='SarasaMonoSC', bold='SarasaMonoSC')
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')

# Install font fallback — handles any incidental non-Latin glyph
from pdf import install_font_fallback
install_font_fallback()

# ---------------------------------------------------------------------------
# Cascade palette — auto-generated, NEVER hardcode hex values
# Source: pdf.py palette.cascade --title "Jashore Blood Network Architecture Plan" --mode minimal
# ---------------------------------------------------------------------------
PAGE_BG       = colors.HexColor('#f5f5f5')
SECTION_BG    = colors.HexColor('#ececea')
CARD_BG       = colors.HexColor('#f0efeb')
TABLE_STRIPE  = colors.HexColor('#f1f1ef')
HEADER_FILL   = colors.HexColor('#645c44')
COVER_BLOCK   = colors.HexColor('#5b5546')
BORDER        = colors.HexColor('#c3bfb3')
ICON          = colors.HexColor('#836f32')
ACCENT        = colors.HexColor('#93761e')
ACCENT_2      = colors.HexColor('#6744cf')
TEXT_PRIMARY  = colors.HexColor('#161514')
TEXT_MUTED    = colors.HexColor('#7a7871')
SEM_SUCCESS   = colors.HexColor('#457856')
SEM_WARNING   = colors.HexColor('#af8c45')
SEM_ERROR     = colors.HexColor('#994a42')
SEM_INFO      = colors.HexColor('#4c7dae')

# Table colors (derived from cascade tiers — NOT from ACCENT)
TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ---------------------------------------------------------------------------
# Page geometry
# ---------------------------------------------------------------------------
PAGE_W, PAGE_H = A4   # 595.28 × 841.89 pt
MARGIN_LR = 0.85 * inch   # symmetric left/right
MARGIN_TB = 0.85 * inch
AVAILABLE_WIDTH = PAGE_W - 2 * MARGIN_LR   # ≈ 472.7 pt
AVAILABLE_HEIGHT = PAGE_H - 2 * MARGIN_TB

# ---------------------------------------------------------------------------
# Paragraph styles
# ---------------------------------------------------------------------------
STYLES = getSampleStyleSheet()

H1_STYLE = ParagraphStyle(
    'H1', fontName='FreeSerif-Bold', fontSize=20, leading=26,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    spaceBefore=20, spaceAfter=8,
)

H1_KICKER_STYLE = ParagraphStyle(
    'H1Kicker', fontName='FreeSans', fontSize=9, leading=12,
    textColor=ACCENT, alignment=TA_LEFT,
    spaceBefore=0, spaceAfter=2,
)

H2_STYLE = ParagraphStyle(
    'H2', fontName='FreeSerif-Bold', fontSize=14, leading=20,
    textColor=HEADER_FILL, alignment=TA_LEFT,
    spaceBefore=16, spaceAfter=6,
)

H3_STYLE = ParagraphStyle(
    'H3', fontName='FreeSerif-Bold', fontSize=11.5, leading=16,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    spaceBefore=12, spaceAfter=4,
)

BODY_STYLE = ParagraphStyle(
    'Body', fontName='FreeSerif', fontSize=10.5, leading=16,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY,
    spaceBefore=0, spaceAfter=8,
    firstLineIndent=0,
)

BODY_INDENT_STYLE = ParagraphStyle(
    'BodyIndent', parent=BODY_STYLE,
    firstLineIndent=14,
)

BULLET_STYLE = ParagraphStyle(
    'Bullet', fontName='FreeSerif', fontSize=10.5, leading=16,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    leftIndent=18, firstLineIndent=-12,
    spaceBefore=0, spaceAfter=4,
    bulletIndent=4,
)

NUMBERED_STYLE = ParagraphStyle(
    'Numbered', fontName='FreeSerif', fontSize=10.5, leading=16,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    leftIndent=22, firstLineIndent=-16,
    spaceBefore=0, spaceAfter=4,
)

CAPTION_STYLE = ParagraphStyle(
    'Caption', fontName='FreeSerif-Italic', fontSize=9, leading=12,
    textColor=TEXT_MUTED, alignment=TA_CENTER,
    spaceBefore=4, spaceAfter=14,
)

CODE_STYLE = ParagraphStyle(
    'Code', fontName='SarasaMonoSC', fontSize=7.5, leading=10.5,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    leftIndent=10, rightIndent=10,
    spaceBefore=4, spaceAfter=6,
    backColor=CARD_BG, borderColor=ACCENT, borderWidth=0,
    borderPadding=6,
)

TABLE_HEADER_STYLE = ParagraphStyle(
    'TableHeader', fontName='FreeSerif-Bold', fontSize=9.5, leading=12,
    textColor=colors.white, alignment=TA_LEFT,
)

TABLE_CELL_STYLE = ParagraphStyle(
    'TableCell', fontName='FreeSerif', fontSize=9, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
)

TABLE_CELL_CENTER_STYLE = ParagraphStyle(
    'TableCellCenter', fontName='FreeSerif', fontSize=9, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER,
)

CALLOUT_TITLE_STYLE = ParagraphStyle(
    'CalloutTitle', fontName='FreeSerif-Bold', fontSize=10, leading=14,
    textColor=ACCENT, alignment=TA_LEFT,
    spaceBefore=0, spaceAfter=4,
)

CALLOUT_BODY_STYLE = ParagraphStyle(
    'CalloutBody', fontName='FreeSerif', fontSize=9.5, leading=14,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    spaceBefore=0, spaceAfter=0,
)

TOC_TITLE_STYLE = ParagraphStyle(
    'TocTitle', fontName='FreeSerif-Bold', fontSize=22, leading=28,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    spaceBefore=0, spaceAfter=20,
)

TOC_L0_STYLE = ParagraphStyle(
    'TocL0', fontName='FreeSerif-Bold', fontSize=11, leading=20,
    textColor=TEXT_PRIMARY, leftIndent=0, rightIndent=20,
    spaceBefore=4, spaceAfter=0,
)

TOC_L1_STYLE = ParagraphStyle(
    'TocL1', fontName='FreeSerif', fontSize=10, leading=16,
    textColor=TEXT_MUTED, leftIndent=20, rightIndent=20,
    spaceBefore=0, spaceAfter=0,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def add_heading(text, style, level=0, story=None):
    """Add a heading with TOC bookmark and return the Paragraph flowable."""
    key = 'h_' + hashlib.md5(text.encode('utf-8')).hexdigest()[:10]
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    if story is not None:
        story.append(p)
    return p


def add_chapter(kicker_text, title_text, story):
    """Add an H1 chapter heading with kicker and accent rule.

    Uses CondPageBreak (orphan prevention only) — never forced PageBreak.
    """
    available = PAGE_H - 2 * MARGIN_TB
    story.append(CondPageBreak(available * 0.30))
    story.append(Paragraph(kicker_text.upper(), H1_KICKER_STYLE))
    add_heading(title_text, H1_STYLE, level=0, story=story)
    story.append(HRFlowable(
        width='25%', thickness=2.0, color=ACCENT,
        spaceBefore=2, spaceAfter=14, hAlign='LEFT',
    ))


def add_section(title_text, story, level=1):
    """Add an H2 section heading (level 1 TOC entry)."""
    story.append(CondPageBreak(80))
    add_heading(title_text, H2_STYLE, level=level, story=story)


def add_subsection(title_text, story):
    """Add an H3 subsection heading (not in TOC)."""
    story.append(CondPageBreak(60))
    story.append(Paragraph(title_text, H3_STYLE))


def body(text, story, indent=False):
    """Append a body paragraph."""
    style = BODY_INDENT_STYLE if indent else BODY_STYLE
    story.append(Paragraph(text, style))


def bullet(text, story, marker='•'):
    """Append a bullet list item."""
    story.append(Paragraph(f'{marker}  {text}', BULLET_STYLE))


def numbered(n, text, story):
    """Append a numbered list item."""
    story.append(Paragraph(f'{n}.  {text}', NUMBERED_STYLE))


def callout(title, body_text, story, kind='note'):
    """Add a callout box with accent left border."""
    border_color = {
        'note': ACCENT, 'warning': SEM_WARNING,
        'error': SEM_ERROR, 'success': SEM_SUCCESS,
    }.get(kind, ACCENT)
    bg_color = {
        'note': CARD_BG, 'warning': TABLE_STRIPE,
        'error': TABLE_STRIPE, 'success': TABLE_STRIPE,
    }.get(kind, CARD_BG)

    inner = []
    if title:
        inner.append(Paragraph(f'<b>{title}</b>', CALLOUT_TITLE_STYLE))
    inner.append(Paragraph(body_text, CALLOUT_BODY_STYLE))

    tbl = Table([[inner]], colWidths=[AVAILABLE_WIDTH], hAlign='CENTER')
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg_color),
        ('LINEBEFORE', (0, 0), (0, -1), 3, border_color),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(Spacer(1, 6))
    story.append(tbl)
    story.append(Spacer(1, 12))


def code_block(text, story):
    """Append a code block with light card background and accent left border.

    Converts plain newlines to <br/> for ReportLab Paragraph.
    """
    safe = text.replace('&', '&').replace('<', '<').replace('>', '>')
    safe = safe.replace('\n', '<br/>')
    safe = safe.replace(' ', ' ')
    p = Paragraph(safe, CODE_STYLE)

    tbl = Table([[p]], colWidths=[AVAILABLE_WIDTH], hAlign='CENTER')
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
        ('LINEBEFORE', (0, 0), (0, -1), 2, ACCENT),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(Spacer(1, 6))
    story.append(tbl)
    story.append(Spacer(1, 12))


def make_table(headers, rows, col_ratios=None, header_centered=True, body_centered_cols=None):
    """Build a styled table.

    headers: list of strings
    rows: list of list of strings
    col_ratios: list of floats summing to ~1.0 (column width fractions)
    header_centered: True if header cells should be center-aligned
    body_centered_cols: set of column indices to center-align in body
    """
    n_cols = len(headers)
    if col_ratios is None:
        col_ratios = [1.0 / n_cols] * n_cols
    assert abs(sum(col_ratios) - 1.0) < 0.01, f'col_ratios must sum to 1.0, got {sum(col_ratios)}'
    col_widths = [r * AVAILABLE_WIDTH for r in col_ratios]

    if body_centered_cols is None:
        body_centered_cols = set()

    header_style = TABLE_HEADER_STYLE
    if header_centered:
        header_style = ParagraphStyle('TmpHdr', parent=TABLE_HEADER_STYLE, alignment=TA_CENTER)

    data = [[Paragraph(f'<b>{h}</b>', header_style) for h in headers]]
    for row in rows:
        row_paras = []
        for i, cell in enumerate(row):
            cs = TABLE_CELL_CENTER_STYLE if i in body_centered_cols else TABLE_CELL_STYLE
            row_paras.append(Paragraph(str(cell), cs))
        data.append(row_paras)

    tbl = Table(data, colWidths=col_widths, hAlign='CENTER', repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (-1, 0), 0.5, HEADER_FILL),
        ('LINEBELOW', (0, -1), (-1, -1), 0.5, BORDER),
    ]
    # Alternating row stripes
    for r in range(1, len(data)):
        if r % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, r), (-1, r), TABLE_ROW_ODD))
    tbl.setStyle(TableStyle(style_cmds))
    return tbl


def add_table_with_caption(headers, rows, caption_text, story, col_ratios=None,
                            header_centered=True, body_centered_cols=None):
    """Append a styled table followed by a centered caption."""
    story.append(Spacer(1, 6))
    tbl = make_table(headers, rows, col_ratios=col_ratios,
                     header_centered=header_centered,
                     body_centered_cols=body_centered_cols)
    story.append(tbl)
    story.append(Spacer(1, 4))
    story.append(Paragraph(caption_text, CAPTION_STYLE))


def add_image_with_caption(image_path, caption_text, story, max_height=None):
    """Append a centered image scaled to fit available width, then caption."""
    from PIL import Image as PILImage
    pil = PILImage.open(image_path)
    orig_w, orig_h = pil.size

    max_w = AVAILABLE_WIDTH
    if max_height is None:
        max_height = PAGE_H * 0.40   # leave room for caption + body text

    ratio_w = max_w / orig_w if orig_w > max_w else 1.0
    ratio_h = max_height / orig_h if orig_h > max_height else 1.0
    ratio = min(ratio_w, ratio_h)

    img = Image(image_path, width=orig_w * ratio, height=orig_h * ratio)
    img.hAlign = 'CENTER'
    story.append(Spacer(1, 8))
    story.append(img)
    story.append(Spacer(1, 4))
    story.append(Paragraph(caption_text, CAPTION_STYLE))


# ---------------------------------------------------------------------------
# Page templates — Roman for TOC, Arabic for body (resets to 1)
# ---------------------------------------------------------------------------

ROMAN = {1:'i',2:'ii',3:'iii',4:'iv',5:'v',6:'vi',7:'vii',8:'viii',9:'ix',10:'x',
         11:'xi',12:'xii',13:'xiii',14:'xiv',15:'xv'}

def _draw_header_footer(canvas, doc, page_num_str, doc_title='Jashore Blood Network — Architecture & Foundation Plan'):
    """Draw a thin header rule + page number footer."""
    canvas.saveState()
    # Header: tiny muted title at top-left
    canvas.setFont('FreeSans', 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN_LR, PAGE_H - MARGIN_TB * 0.55, doc_title)
    # Header rule
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.3)
    canvas.line(MARGIN_LR, PAGE_H - MARGIN_TB * 0.55 - 4,
                PAGE_W - MARGIN_LR, PAGE_H - MARGIN_TB * 0.55 - 4)
    # Footer: page number, centered
    canvas.setFont('FreeSerif', 9)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawCentredString(PAGE_W / 2, MARGIN_TB * 0.55, page_num_str)
    # Footer rule
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.3)
    canvas.line(MARGIN_LR, MARGIN_TB * 0.55 + 12,
                PAGE_W - MARGIN_LR, MARGIN_TB * 0.55 + 12)
    canvas.restoreState()


def footer_roman(canvas, doc):
    """Frontmatter page numbers (Roman)."""
    page = doc.page
    page_str = ROMAN.get(page, str(page))
    _draw_header_footer(canvas, doc, page_str)


def footer_arabic(canvas, doc):
    """Body page numbers (Arabic, reset to 1 via doc.page counter)."""
    page_str = str(doc.page)
    _draw_header_footer(canvas, doc, page_str)


class TocDocTemplate(BaseDocTemplate):
    """Custom doc template with TOC support and dual page templates."""

    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))


# Will be set in main()
DOC = None
OUTPUT_BODY = '/home/z/my-project/scripts/body.pdf'
