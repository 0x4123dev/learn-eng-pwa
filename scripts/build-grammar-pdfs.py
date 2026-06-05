#!/usr/bin/env python3
"""
Generate one print-ready PDF per FlashLingo grammar unit + a master index PDF.

Usage:
    # 1. Dump grammar-lessons.js → JSON
    node -e "const fs=require('fs');const vm=require('vm');const src=fs.readFileSync('js/grammar-lessons.js','utf8');const ctx={};vm.createContext(ctx);vm.runInContext(src+';this.G=GRAMMAR_LESSONS;',ctx);fs.writeFileSync('/tmp/grammar-lessons.json',JSON.stringify(ctx.G));"
    # 2. Generate PDFs (requires `pip install reportlab`)
    python3 scripts/build-grammar-pdfs.py

Outputs to <repo>/print/grammar/  (13 PDFs: 12 unit sheets + 1 master index).
"""

import json
import os
import re
import html
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, ListFlowable, ListItem, HRFlowable, Frame, PageTemplate,
    BaseDocTemplate
)
from reportlab.pdfgen import canvas

# Resolve paths relative to this script so it works from any cwd
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_SCRIPT_DIR)
DATA_PATH = "/tmp/grammar-lessons.json"
OUT_DIR = os.path.join(_PROJECT_ROOT, "print", "grammar")
os.makedirs(OUT_DIR, exist_ok=True)


# -----------------------------------------------------------------------------
# Color palette (matches the app's unit colors)
# -----------------------------------------------------------------------------
UNIT_COLOR_HEX = {
    'unit1':  '#3B82F6',  # blue
    'unit2':  '#10B981',  # emerald
    'unit3':  '#F59E0B',  # amber
    'unit4':  '#EF4444',  # red
    'unit5':  '#8B5CF6',  # violet
    'unit6':  '#EC4899',  # pink
    'unit7':  '#06B6D4',  # cyan
    'unit8':  '#84CC16',  # lime
    'unit9':  '#F97316',  # orange
    'unit10': '#14B8A6',  # teal
    'unit11': '#6366F1',  # indigo
    'unit12': '#4F46E5',  # indigo-darker
}

DARK_GRAY = colors.HexColor('#1F2937')
MID_GRAY  = colors.HexColor('#6B7280')
LIGHT_BG  = colors.HexColor('#F9FAFB')
ACCENT_BG = colors.HexColor('#F3F4F6')


# -----------------------------------------------------------------------------
# Text helpers — escape Paragraph content (ReportLab uses XML)
# -----------------------------------------------------------------------------
def esc(text):
    """Escape text for ReportLab Paragraph (XML-like)."""
    if text is None:
        return ''
    return (str(text)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;'))


def strip_emoji(text):
    """Strip emoji from a string (PDF fonts don't include emoji glyphs)."""
    if not text:
        return text
    return re.sub(
        r'[\U00010000-\U0010FFFF\U00002600-\U000027BF\U0001F300-\U0001F9FF\U00002700-\U000027BF\U0001F000-\U0001FFFF]',
        '',
        str(text)
    ).strip()


# -----------------------------------------------------------------------------
# Styles
# -----------------------------------------------------------------------------
def make_styles(unit_color):
    """Build a paragraph stylesheet for one unit, themed with its accent color."""
    accent = colors.HexColor(unit_color)
    return {
        'h1': ParagraphStyle(
            'h1', fontName='Helvetica-Bold', fontSize=22, leading=26,
            textColor=accent, spaceAfter=6, spaceBefore=0
        ),
        'h2': ParagraphStyle(
            'h2', fontName='Helvetica-Bold', fontSize=15, leading=19,
            textColor=accent, spaceAfter=4, spaceBefore=12
        ),
        'h3': ParagraphStyle(
            'h3', fontName='Helvetica-Bold', fontSize=12, leading=16,
            textColor=DARK_GRAY, spaceAfter=3, spaceBefore=8
        ),
        'h4': ParagraphStyle(
            'h4', fontName='Helvetica-Bold', fontSize=10.5, leading=14,
            textColor=accent, spaceAfter=2, spaceBefore=6
        ),
        'body': ParagraphStyle(
            'body', fontName='Helvetica', fontSize=10, leading=14,
            textColor=DARK_GRAY, spaceAfter=3, alignment=TA_LEFT
        ),
        'body_just': ParagraphStyle(
            'body_just', fontName='Helvetica', fontSize=10, leading=14,
            textColor=DARK_GRAY, spaceAfter=3, alignment=TA_JUSTIFY
        ),
        'rule': ParagraphStyle(
            'rule', fontName='Helvetica-Oblique', fontSize=10, leading=14,
            textColor=DARK_GRAY, spaceAfter=4, leftIndent=8
        ),
        'example': ParagraphStyle(
            'example', fontName='Helvetica', fontSize=10, leading=14,
            textColor=DARK_GRAY, spaceAfter=2, leftIndent=14, bulletIndent=4
        ),
        'goal': ParagraphStyle(
            'goal', fontName='Helvetica', fontSize=10.5, leading=15,
            textColor=DARK_GRAY, spaceAfter=2, leftIndent=14, bulletIndent=2
        ),
        'cover_title': ParagraphStyle(
            'cover_title', fontName='Helvetica-Bold', fontSize=32, leading=38,
            textColor=accent, alignment=TA_CENTER, spaceAfter=4
        ),
        'cover_sub': ParagraphStyle(
            'cover_sub', fontName='Helvetica', fontSize=14, leading=18,
            textColor=MID_GRAY, alignment=TA_CENTER, spaceAfter=8
        ),
        'cover_intro': ParagraphStyle(
            'cover_intro', fontName='Helvetica-Oblique', fontSize=12, leading=18,
            textColor=DARK_GRAY, alignment=TA_CENTER, spaceAfter=24, leftIndent=24, rightIndent=24
        ),
        'meta': ParagraphStyle(
            'meta', fontName='Helvetica', fontSize=9, leading=12,
            textColor=MID_GRAY, alignment=TA_CENTER, spaceAfter=2
        ),
        'tag': ParagraphStyle(
            'tag', fontName='Helvetica', fontSize=8.5, leading=11,
            textColor=accent, spaceAfter=4
        ),
        'pagenum': ParagraphStyle(
            'pagenum', fontName='Helvetica', fontSize=9, leading=11,
            textColor=MID_GRAY, alignment=TA_CENTER
        ),
    }


# -----------------------------------------------------------------------------
# Page templates with header / footer
# -----------------------------------------------------------------------------
def make_page_decorator(unit_title, unit_color, total_pages_holder):
    """Return a function that draws the header/footer on every page."""
    accent = colors.HexColor(unit_color)
    clean_title = strip_emoji(unit_title)

    def decorator(canvas_obj, doc):
        canvas_obj.saveState()
        # Header strip
        page_w, page_h = A4
        canvas_obj.setFillColor(accent)
        canvas_obj.rect(0, page_h - 1.2 * cm, page_w, 1.2 * cm, fill=1, stroke=0)
        # Header text — left: brand, right: unit title
        canvas_obj.setFont('Helvetica-Bold', 10)
        canvas_obj.setFillColor(colors.white)
        canvas_obj.drawString(1.5 * cm, page_h - 0.75 * cm, 'FlashLingo · Grammar Study Sheet')
        canvas_obj.drawRightString(page_w - 1.5 * cm, page_h - 0.75 * cm, clean_title)
        # Footer rule
        canvas_obj.setStrokeColor(colors.HexColor('#E5E7EB'))
        canvas_obj.setLineWidth(0.5)
        canvas_obj.line(1.5 * cm, 1.4 * cm, page_w - 1.5 * cm, 1.4 * cm)
        # Footer text — page number
        canvas_obj.setFont('Helvetica', 9)
        canvas_obj.setFillColor(MID_GRAY)
        page_num = canvas_obj.getPageNumber()
        canvas_obj.drawCentredString(page_w / 2, 0.8 * cm, f'Page {page_num}')
        canvas_obj.drawString(1.5 * cm, 0.8 * cm, 'flashlingo')
        canvas_obj.drawRightString(page_w - 1.5 * cm, 0.8 * cm, clean_title)
        canvas_obj.restoreState()

    return decorator


# -----------------------------------------------------------------------------
# Build content flowables for a single lesson
# -----------------------------------------------------------------------------
def build_lesson_flowables(lesson, styles, accent_color):
    """Return a list of flowables for one lesson, formatted as a study sheet."""
    flow = []
    accent = colors.HexColor(accent_color)

    # Lesson header card (colored bar + title + page reference)
    title = strip_emoji(lesson.get('title', '')) or lesson.get('id', '')
    lesson_id = lesson.get('id', '')
    page_ref = lesson.get('page', '')
    header_data = [[
        Paragraph(f"<b>Lesson {esc(lesson_id)}</b> · {esc(title)}", styles['h2']),
        Paragraph(f"Page {esc(page_ref)}", styles['meta']) if page_ref else Paragraph('', styles['meta']),
    ]]
    header_tbl = Table(header_data, colWidths=[12 * cm, 4 * cm])
    header_tbl.setStyle(TableStyle([
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('LINEBELOW', (0, 0), (-1, -1), 2, accent),
    ]))
    flow.append(header_tbl)
    flow.append(Spacer(1, 4))

    # Topic tags
    tags = lesson.get('topicTags') or []
    if tags:
        tag_str = '  ·  '.join(esc(t) for t in tags)
        flow.append(Paragraph(f"<i>Topics: {tag_str}</i>", styles['tag']))
        flow.append(Spacer(1, 4))

    # Vocabulary block (if present) — can be a dict or a list of dicts
    vocab = lesson.get('vocabulary')
    if vocab:
        vocab_groups = vocab if isinstance(vocab, list) else [vocab]
        for vg in vocab_groups:
            if not isinstance(vg, dict):
                continue
            flow.append(Paragraph(f"Vocabulary — {esc(vg.get('title', ''))}", styles['h3']))
            words = vg.get('words') or []
            if words:
                cells = [esc(w) for w in words]
                cols = 4
                rows = [cells[i:i + cols] for i in range(0, len(cells), cols)]
                if rows and len(rows[-1]) < cols:
                    rows[-1] += [''] * (cols - len(rows[-1]))
                word_tbl = Table(rows, colWidths=[3.7 * cm] * cols)
                word_tbl.setStyle(TableStyle([
                    ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9.5),
                    ('TEXTCOLOR', (0, 0), (-1, -1), DARK_GRAY),
                    ('BACKGROUND', (0, 0), (-1, -1), ACCENT_BG),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ]))
                flow.append(word_tbl)
                flow.append(Spacer(1, 4))
            note = vg.get('note')
            if note:
                flow.append(Paragraph(f"<i>{esc(note)}</i>", styles['rule']))
                flow.append(Spacer(1, 6))

    # Pronunciation block — handle dict or list of dicts
    pron = lesson.get('pronunciation')
    if pron:
        pron_groups = pron if isinstance(pron, list) else [pron]
        for pg in pron_groups:
            if not isinstance(pg, dict):
                continue
            flow.append(Paragraph(f"Pronunciation — {esc(pg.get('title', ''))}", styles['h3']))
            if pg.get('rule'):
                flow.append(Paragraph(esc(pg['rule']), styles['body']))
            for ex in pg.get('examples', []):
                flow.append(Paragraph(f"• {esc(ex)}", styles['example']))
            flow.append(Spacer(1, 6))

    # Grammar blocks — main content
    for block in lesson.get('grammar', []):
        flow.append(Paragraph(esc(block.get('title', '')), styles['h3']))
        if block.get('rule'):
            flow.append(Paragraph(esc(block['rule']), styles['body']))
            flow.append(Spacer(1, 2))

        # Form table
        form_rows = block.get('form') or []
        if form_rows:
            data = [[Paragraph(f"<b>{esc(r.get('label', ''))}</b>", styles['body']),
                     Paragraph(esc(r.get('text', '')), styles['body'])]
                    for r in form_rows]
            form_tbl = Table(data, colWidths=[4 * cm, 12 * cm])
            form_tbl.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('BACKGROUND', (0, 0), (0, -1), accent),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.white),
                ('BACKGROUND', (1, 0), (1, -1), LIGHT_BG),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
            ]))
            flow.append(form_tbl)
            flow.append(Spacer(1, 4))

        # Examples bulleted
        examples = block.get('examples') or []
        if examples:
            flow.append(Paragraph('<b>Examples:</b>', styles['h4']))
            for ex in examples:
                flow.append(Paragraph(f"• {esc(ex)}", styles['example']))
            flow.append(Spacer(1, 6))

    flow.append(Spacer(1, 10))
    # Horizontal rule between lessons
    flow.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#E5E7EB'), spaceBefore=4, spaceAfter=8))

    return flow


# -----------------------------------------------------------------------------
# Build one unit PDF
# -----------------------------------------------------------------------------
def build_unit_pdf(unit, out_path):
    """Generate a single PDF for one grammar unit."""
    unit_id = unit['unitId']
    unit_color = UNIT_COLOR_HEX.get(unit_id, '#4F46E5')
    title = unit.get('title', unit_id)
    clean_title = strip_emoji(title)
    intro = unit.get('intro', '')
    goals = unit.get('iCanGoals') or []
    lessons = unit.get('lessons') or []

    styles = make_styles(unit_color)

    # Build the document
    doc = SimpleDocTemplate(
        out_path,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm,
        title=clean_title,
        author='FlashLingo',
        subject='Grammar Study Sheet',
    )

    story = []

    # ---- Cover page ----
    story.append(Spacer(1, 4 * cm))
    story.append(Paragraph(esc(clean_title), styles['cover_title']))
    story.append(Paragraph(f"Unit {unit_id.replace('unit', '')} of 12 · Grammar Study Sheet",
                          styles['cover_sub']))
    story.append(Spacer(1, 1 * cm))
    if intro:
        story.append(Paragraph(esc(intro), styles['cover_intro']))

    # I-can goals card
    if goals:
        story.append(Spacer(1, 0.5 * cm))
        goal_items = [Paragraph(f"✓  {esc(g)}", styles['goal']) for g in goals]
        goal_tbl = Table(
            [[Paragraph('<b>What you will be able to do</b>', styles['h3'])]] + [[item] for item in goal_items],
            colWidths=[15 * cm]
        )
        goal_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(unit_color)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, 1), (-1, -1), LIGHT_BG),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('RIGHTPADDING', (0, 0), (-1, -1), 14),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
        ]))
        story.append(goal_tbl)

    story.append(Spacer(1, 2 * cm))
    story.append(Paragraph(
        f"<i>{len(lessons)} lesson{'s' if len(lessons) != 1 else ''} in this unit</i>",
        styles['meta']
    ))
    story.append(Paragraph(
        '<i>Generated from the FlashLingo PWA · flashlingo.app</i>',
        styles['meta']
    ))

    story.append(PageBreak())

    # ---- Lesson pages ----
    for idx, lesson in enumerate(lessons):
        story.extend(build_lesson_flowables(lesson, styles, unit_color))
        # Page break between lessons except the last
        if idx < len(lessons) - 1:
            story.append(PageBreak())

    # Build with header/footer
    decorator = make_page_decorator(clean_title, unit_color, None)
    doc.build(story, onFirstPage=decorator, onLaterPages=decorator)


# -----------------------------------------------------------------------------
# Build the master index PDF
# -----------------------------------------------------------------------------
def build_index_pdf(units, out_path):
    """Generate a master index PDF listing all units and lessons."""
    accent_color = '#4F46E5'
    styles = make_styles(accent_color)

    doc = SimpleDocTemplate(
        out_path,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm,
        title='FlashLingo — Grammar Index',
        author='FlashLingo',
        subject='Grammar Master Index',
    )

    story = []
    # Cover
    story.append(Spacer(1, 3 * cm))
    story.append(Paragraph('FlashLingo', styles['cover_title']))
    story.append(Paragraph('Complete Grammar Reference · 12 Units', styles['cover_sub']))
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph(
        '<i>Print-ready study sheets covering tenses, verb forms, articles, modals, '
        'comparatives, conditionals, and more — designed to mirror the IELTS exam syllabus.</i>',
        styles['cover_intro']
    ))

    story.append(PageBreak())

    # Table of contents — one row per unit
    story.append(Paragraph('Master Index', styles['h1']))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor(accent_color),
                            spaceBefore=2, spaceAfter=10))

    for unit in units:
        unit_id = unit['unitId']
        unit_color = UNIT_COLOR_HEX.get(unit_id, '#4F46E5')
        clean_title = strip_emoji(unit.get('title', unit_id))
        intro = unit.get('intro', '')
        lessons = unit.get('lessons') or []

        # Unit header row
        story.append(Spacer(1, 6))
        unit_hdr = Table(
            [[Paragraph(f"<b>{esc(clean_title)}</b>", styles['h2']),
              Paragraph(f"<i>{len(lessons)} lessons</i>", styles['meta'])]],
            colWidths=[12 * cm, 4 * cm]
        )
        unit_hdr.setStyle(TableStyle([
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
            ('LINEBELOW', (0, 0), (-1, -1), 1.5, colors.HexColor(unit_color)),
        ]))
        story.append(unit_hdr)
        if intro:
            story.append(Paragraph(f"<i>{esc(intro)}</i>", styles['rule']))

        # Lesson list
        lesson_rows = []
        for l in lessons:
            lid = esc(l.get('id', ''))
            ltitle = esc(strip_emoji(l.get('title', '')))
            lpage = esc(l.get('page', ''))
            lesson_rows.append([
                Paragraph(f"<b>{lid}</b>", styles['body']),
                Paragraph(ltitle, styles['body']),
                Paragraph(f"<i>p. {lpage}</i>" if lpage else '', styles['body']),
            ])
        if lesson_rows:
            lesson_tbl = Table(lesson_rows, colWidths=[2 * cm, 12 * cm, 2 * cm])
            lesson_tbl.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor(unit_color)),
            ]))
            story.append(lesson_tbl)
        story.append(Spacer(1, 10))

    decorator = make_page_decorator('Grammar Index', accent_color, None)
    doc.build(story, onFirstPage=decorator, onLaterPages=decorator)


# -----------------------------------------------------------------------------
# Run
# -----------------------------------------------------------------------------
def main():
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        units = json.load(f)

    print(f"Loaded {len(units)} units from {DATA_PATH}")
    print(f"Writing PDFs to {OUT_DIR}/")

    # Build each unit PDF
    for unit in units:
        unit_id = unit['unitId']
        clean = re.sub(r'[^a-z0-9-]+', '-', strip_emoji(unit.get('title', unit_id)).lower()).strip('-')
        filename = f"{unit_id}-{clean}.pdf"
        out_path = os.path.join(OUT_DIR, filename)
        try:
            build_unit_pdf(unit, out_path)
            size_kb = os.path.getsize(out_path) // 1024
            print(f"  ✓ {filename}  ({size_kb} KB)")
        except Exception as e:
            print(f"  ✗ {filename}  FAILED: {e}")
            raise

    # Build master index
    index_path = os.path.join(OUT_DIR, "00-master-index.pdf")
    build_index_pdf(units, index_path)
    size_kb = os.path.getsize(index_path) // 1024
    print(f"  ✓ 00-master-index.pdf  ({size_kb} KB)")

    # Build single combined PDF with bookmarks per unit
    combined_path = os.path.join(OUT_DIR, "flashlingo-grammar-all-units.pdf")
    build_combined_pdf(units, index_path, combined_path)
    size_kb = os.path.getsize(combined_path) // 1024
    print(f"  ✓ flashlingo-grammar-all-units.pdf  ({size_kb} KB)")

    print(f"\nDone. {len(units) + 2} PDFs in {OUT_DIR}/")


def build_combined_pdf(units, index_path, out_path):
    """Merge the master index + all 12 unit PDFs into one bookmarked file."""
    from pypdf import PdfReader, PdfWriter

    writer = PdfWriter()
    total_pages = 0

    # 1. Master index first
    r = PdfReader(index_path)
    for page in r.pages:
        writer.add_page(page)
    writer.add_outline_item('Master Index', 0)
    total_pages += len(r.pages)

    # 2. Then each unit in numeric order
    for unit in units:
        unit_id = unit['unitId']
        clean = re.sub(r'[^a-z0-9-]+', '-',
                       strip_emoji(unit.get('title', unit_id)).lower()).strip('-')
        unit_path = os.path.join(OUT_DIR, f"{unit_id}-{clean}.pdf")
        r = PdfReader(unit_path)
        start = total_pages
        for page in r.pages:
            writer.add_page(page)
        title = strip_emoji(unit.get('title', unit_id))
        writer.add_outline_item(title, start)
        total_pages += len(r.pages)

    with open(out_path, 'wb') as fh:
        writer.write(fh)


if __name__ == '__main__':
    main()
