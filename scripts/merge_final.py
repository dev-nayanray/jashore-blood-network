"""Merge cover PDF (page 1) + body PDF (pages 2-N) into the final deliverable.

Normalizes all pages to A4 dimensions to avoid sub-pixel mismatch
between Playwright (595.92 × 842.88 pt) and ReportLab (595.28 × 841.89 pt).
"""

import os
from pypdf import PdfReader, PdfWriter

COVER = '/home/z/my-project/scripts/cover.pdf'
BODY = '/home/z/my-project/scripts/body.pdf'
FINAL = '/home/z/my-project/download/Jashore_Blood_Network_Architecture_Plan.pdf'

A4_W, A4_H = 595.28, 841.89  # A4 in points


def normalize_page_to_a4(page):
    """Scale a page to A4 if its dimensions don't match (within 0.5pt tolerance)."""
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    if abs(w - A4_W) > 0.5 or abs(h - A4_H) > 0.5:
        page.scale_to(A4_W, A4_H)
    return page


def merge():
    os.makedirs(os.path.dirname(FINAL), exist_ok=True)
    writer = PdfWriter()

    # Cover as page 1
    cover_reader = PdfReader(COVER)
    cover_page = cover_reader.pages[0]
    writer.add_page(normalize_page_to_a4(cover_page))

    # Body pages follow
    body_reader = PdfReader(BODY)
    for page in body_reader.pages:
        writer.add_page(normalize_page_to_a4(page))

    writer.add_metadata({
        '/Title': 'Jashore Blood Network — Architecture & Foundation Plan',
        '/Author': 'Z.ai',
        '/Creator': 'Z.ai',
        '/Subject': 'Phase 0–1 architecture plan for stakeholder approval',
        '/Keywords': 'Jashore, Blood Network, Architecture, Phase 0, Phase 1, '
                     'Supabase, NestJS, Next.js, Prisma, Bangladesh',
    })

    with open(FINAL, 'wb') as f:
        writer.write(f)

    size = os.path.getsize(FINAL)
    pages = len(PdfReader(FINAL).pages)
    print(f'✓ Final PDF: {FINAL}')
    print(f'  Size: {size / 1024:.1f} KB')
    print(f'  Pages: {pages}')


if __name__ == '__main__':
    merge()
