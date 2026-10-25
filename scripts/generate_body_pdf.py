"""
Main entry point — builds the body PDF.

Pipeline:
  1. Define page templates (frontmatter Roman, body Arabic)
  2. Build story (TOC + 18 chapters)
  3. multiBuild() to populate TOC
  4. Output: /home/z/my-project/scripts/body.pdf
"""

import sys
import os

# Ensure same-directory imports work when run as a script
sys.path.insert(0, '/home/z/my-project/scripts')

from body_setup import (
    TocDocTemplate, footer_roman, footer_arabic,
    PAGE_W, PAGE_H, MARGIN_LR, MARGIN_TB,
    BORDER, ACCENT, TEXT_MUTED, HEADER_FILL,
)
from body_content import build_story

from reportlab.platypus import PageTemplate, Frame, NextPageTemplate, PageBreak
from reportlab.lib.pagesizes import A4

OUTPUT_PATH = '/home/z/my-project/scripts/body.pdf'


def build_pdf():
    # Define frames
    frame = Frame(
        MARGIN_LR, MARGIN_TB,
        PAGE_W - 2 * MARGIN_LR,
        PAGE_H - 2 * MARGIN_TB,
        leftPadding=0, rightPadding=0,
        topPadding=0, bottomPadding=0,
        showBoundary=0,
    )

    frontmatter_template = PageTemplate(
        id='frontmatter',
        frames=[frame],
        onPage=footer_roman,
        pagesize=A4,
    )
    body_template = PageTemplate(
        id='body',
        frames=[frame],
        onPage=footer_arabic,
        pagesize=A4,
    )

    doc = TocDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=MARGIN_LR,
        rightMargin=MARGIN_LR,
        topMargin=MARGIN_TB,
        bottomMargin=MARGIN_TB,
        title='Jashore Blood Network — Architecture & Foundation Plan',
        author='Z.ai',
        creator='Z.ai',
        subject='Phase 0–1 architecture plan for stakeholder approval',
    )
    doc.addPageTemplates([frontmatter_template, body_template])

    story = build_story()

    # The first page uses frontmatter template; switch to body after TOC.
    # build_story() already inserts NextPageTemplate('body') + PageBreak after TOC.

    print(f'Building PDF with {len(story)} flowables...')
    doc.multiBuild(story)

    size = os.path.getsize(OUTPUT_PATH)
    print(f'✓ Body PDF generated: {OUTPUT_PATH} ({size / 1024:.1f} KB)')


if __name__ == '__main__':
    build_pdf()
