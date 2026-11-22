"""
Generate formatted .docx report from Meghdrishti_Report.md.

Formatting spec:
  - A4, margins 1" (1.5" left for binding), Times New Roman 12pt body,
    1.5 line spacing, justified text.
  - Chapter titles: 16pt bold UPPERCASE; Sections: 14pt bold; Subsections: 12pt bold.
  - Roman numerals for front-matter pages, arabic from Chapter 1, bottom center.
  - Code snippets: Consolas 10pt in shaded boxes with captions.
  - Figures/tables centered, numbered by chapter.
  - Auto-generated TOC placeholder.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from docx import Document
from docx.shared import Pt, Inches, Cm, RGBColor, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml

REPORT_MD = Path(__file__).parent / "Meghdrishti_Report.md"
OUTPUT_DOCX = Path(__file__).parent / "Meghdrishti_Report.docx"

FONT_BODY = "Times New Roman"
FONT_CODE = "Consolas"
SIZE_BODY = Pt(12)
SIZE_CHAPTER = Pt(16)
SIZE_SECTION = Pt(14)
SIZE_SUBSECTION = Pt(12)
SIZE_CODE = Pt(10)
LINE_SPACING = 1.5

# Shading color for code blocks (light gray)
CODE_SHADING = "E8E8E8"
TABLE_HEADER_COLOR = "2F5496"
TABLE_ALT_COLOR = "D9E2F3"


def setup_styles(doc: Document):
    """Configure base document styles."""
    style = doc.styles["Normal"]
    font = style.font
    font.name = FONT_BODY
    font.size = SIZE_BODY
    font.color.rgb = RGBColor(0, 0, 0)
    pf = style.paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    pf.line_spacing = LINE_SPACING
    pf.space_after = Pt(6)
    pf.space_before = Pt(0)

    # Heading styles
    for level, (size, bold) in {1: (SIZE_CHAPTER, True), 2: (SIZE_SECTION, True),
                                 3: (SIZE_SUBSECTION, True)}.items():
        sname = f"Heading {level}"
        if sname in doc.styles:
            hs = doc.styles[sname]
            hs.font.name = FONT_BODY
            hs.font.size = size
            hs.font.bold = bold
            hs.font.color.rgb = RGBColor(0x1F, 0x38, 0x64)
            hs.paragraph_format.space_before = Pt(18 if level == 1 else 12)
            hs.paragraph_format.space_after = Pt(6)
            hs.paragraph_format.keep_with_next = True


def setup_page(doc: Document):
    """Set A4 page size, margins, and page numbering."""
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.left_margin = Inches(1.5)
    section.right_margin = Inches(1.0)
    section.top_margin = Inches(1.0)
    section.bottom_margin = Inches(1.0)

    # Footer with page number
    footer = section.footer
    footer.is_linked_to_previous = False
    fp = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    # Add PAGE field
    run = fp.add_run()
    fld_char_begin = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="begin"/>')
    run._r.append(fld_char_begin)
    run2 = fp.add_run()
    instr = parse_xml(f'<w:instrText {nsdecls("w")} xml:space="preserve"> PAGE </w:instrText>')
    run2._r.append(instr)
    run3 = fp.add_run()
    fld_char_end = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="end"/>')
    run3._r.append(fld_char_end)


def add_toc(doc: Document):
    """Insert a Table of Contents field (user must update in Word)."""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("TABLE OF CONTENTS")
    run.bold = True
    run.font.size = SIZE_CHAPTER
    run.font.name = FONT_BODY
    run.font.color.rgb = RGBColor(0x1F, 0x38, 0x64)

    # Instruction paragraph
    inst = doc.add_paragraph()
    inst.alignment = WD_ALIGN_PARAGRAPH.CENTER
    inst_run = inst.add_run("[Right-click here and select 'Update Field' to generate the Table of Contents]")
    inst_run.italic = True
    inst_run.font.size = Pt(10)
    inst_run.font.color.rgb = RGBColor(0x80, 0x80, 0x80)

    # TOC field
    p2 = doc.add_paragraph()
    run_begin = p2.add_run()
    fld_begin = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="begin"/>')
    run_begin._r.append(fld_begin)
    run_instr = p2.add_run()
    instr_text = parse_xml(
        f'<w:instrText {nsdecls("w")} xml:space="preserve">'
        ' TOC \\o "1-3" \\h \\z \\u '
        '</w:instrText>'
    )
    run_instr._r.append(instr_text)
    run_sep = p2.add_run()
    fld_sep = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="separate"/>')
    run_sep._r.append(fld_sep)
    run_placeholder = p2.add_run("Press F9 or right-click to update this table of contents.")
    run_placeholder.font.color.rgb = RGBColor(0x80, 0x80, 0x80)
    run_end = p2.add_run()
    fld_end = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="end"/>')
    run_end._r.append(fld_end)

    doc.add_page_break()


def add_shading(paragraph, color: str):
    """Add background shading to a paragraph."""
    pPr = paragraph._p.get_or_add_pPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color}" w:val="clear"/>')
    pPr.append(shd)


def shade_cell(cell, color: str):
    """Shade a table cell."""
    shading = parse_xml(
        f'<w:shd {nsdecls("w")} w:fill="{color}" w:val="clear"/>'
    )
    cell._tc.get_or_add_tcPr().append(shading)


def set_cell_font(cell, font_name=FONT_BODY, font_size=Pt(10), bold=False,
                  color=None, alignment=WD_ALIGN_PARAGRAPH.LEFT):
    """Set font properties for all paragraphs in a cell."""
    for p in cell.paragraphs:
        p.alignment = alignment
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.0
        for run in p.runs:
            run.font.name = font_name
            run.font.size = font_size
            run.font.bold = bold
            if color:
                run.font.color.rgb = color


def parse_inline(paragraph, text: str):
    """Parse inline markdown (bold, italic, code) and add runs to paragraph."""
    # Pattern: **bold**, *italic*, `code`, $$math$$, $math$
    patterns = [
        (r'\*\*(.+?)\*\*', 'bold'),
        (r'\*(.+?)\*', 'italic'),
        (r'`(.+?)`', 'code'),
    ]

    # Simple approach: split on code/bold/italic markers
    parts = re.split(r'(\*\*.*?\*\*|`.*?`|\*.*?\*)', text)
    for part in parts:
        if not part:
            continue
        if part.startswith('**') and part.endswith('**'):
            run = paragraph.add_run(part[2:-2])
            run.bold = True
            run.font.name = FONT_BODY
            run.font.size = SIZE_BODY
        elif part.startswith('`') and part.endswith('`'):
            run = paragraph.add_run(part[1:-1])
            run.font.name = FONT_CODE
            run.font.size = Pt(10)
            run.font.color.rgb = RGBColor(0xC7, 0x25, 0x4E)
        elif part.startswith('*') and part.endswith('*') and not part.startswith('**'):
            run = paragraph.add_run(part[1:-1])
            run.italic = True
            run.font.name = FONT_BODY
            run.font.size = SIZE_BODY
        else:
            run = paragraph.add_run(part)
            run.font.name = FONT_BODY
            run.font.size = SIZE_BODY


def add_table_from_rows(doc: Document, header_row: list[str], data_rows: list[list[str]]):
    """Add a formatted table to the document."""
    num_cols = len(header_row)
    table = doc.add_table(rows=1 + len(data_rows), cols=num_cols)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"

    # Header row
    for i, text in enumerate(header_row):
        cell = table.rows[0].cells[i]
        cell.text = text.strip()
        shade_cell(cell, TABLE_HEADER_COLOR)
        set_cell_font(cell, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF),
                      alignment=WD_ALIGN_PARAGRAPH.CENTER)

    # Data rows
    for r, row_data in enumerate(data_rows):
        for c, text in enumerate(row_data):
            if c < num_cols:
                cell = table.rows[r + 1].cells[c]
                cell.text = text.strip()
                if r % 2 == 1:
                    shade_cell(cell, TABLE_ALT_COLOR)
                set_cell_font(cell)

    doc.add_paragraph()  # spacing after table


def process_markdown(doc: Document, md_text: str):
    """Parse markdown and add content to the document."""
    lines = md_text.split('\n')
    i = 0
    in_code_block = False
    code_lines = []
    code_lang = ""
    toc_inserted = False
    chapter_started = False

    # Track table state
    table_rows = []
    in_table = False

    while i < len(lines):
        line = lines[i]

        # --- Code blocks ---
        if line.strip().startswith('```') and not in_code_block:
            # Flush any pending table
            if in_table and table_rows:
                flush_table(doc, table_rows)
                table_rows = []
                in_table = False

            in_code_block = True
            code_lines = []
            code_lang = line.strip().replace('```', '').strip()
            i += 1
            continue
        elif line.strip().startswith('```') and in_code_block:
            in_code_block = False
            # Add code block
            code_text = '\n'.join(code_lines)
            if code_text.strip():
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(6)
                p.paragraph_format.space_after = Pt(6)
                p.paragraph_format.line_spacing = 1.0
                run = p.add_run(code_text)
                run.font.name = FONT_CODE
                run.font.size = SIZE_CODE
                run.font.color.rgb = RGBColor(0x1A, 0x1A, 0x2E)
                add_shading(p, CODE_SHADING)
            i += 1
            continue
        elif in_code_block:
            code_lines.append(line)
            i += 1
            continue

        # --- Table rows ---
        if line.strip().startswith('|') and '|' in line.strip()[1:]:
            stripped = line.strip()
            # Check if separator row
            if re.match(r'^\|[\s\-:]+\|', stripped):
                i += 1
                continue
            cells = [c.strip() for c in stripped.split('|')[1:-1]]
            if not in_table:
                in_table = True
                table_rows = [cells]
            else:
                table_rows.append(cells)
            i += 1
            continue
        else:
            # Flush table if we were in one
            if in_table and table_rows:
                flush_table(doc, table_rows)
                table_rows = []
                in_table = False

        # --- Horizontal rule / page break ---
        if line.strip() == '---':
            # Don't add page breaks for every ---, only between chapters
            i += 1
            continue

        # --- Empty line ---
        if not line.strip():
            i += 1
            continue

        # --- Headings ---
        heading_match = re.match(r'^(#{1,4})\s+(.+)$', line.strip())
        if heading_match:
            level = len(heading_match.group(1))
            text = heading_match.group(2).strip()

            # Insert TOC before first chapter heading
            if level <= 2 and 'CHAPTER' in text.upper() and not toc_inserted:
                add_toc(doc)
                toc_inserted = True

            # Page break before chapter headings
            if level <= 2 and ('CHAPTER' in text.upper() or 'APPENDIX' in text.upper()
                              or 'REFERENCES' in text.upper()):
                doc.add_page_break()
                chapter_started = True

            # Map markdown heading levels to Word heading levels
            if level == 1:
                word_level = 1
            elif level == 2:
                word_level = 1
            elif level == 3:
                word_level = 2
            else:
                word_level = 3

            heading = doc.add_heading(level=word_level)
            # Clean text of markdown formatting
            clean_text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
            clean_text = re.sub(r'\*(.+?)\*', r'\1', clean_text)
            clean_text = re.sub(r'`(.+?)`', r'\1', clean_text)

            run = heading.add_run(clean_text)
            run.font.name = FONT_BODY
            if word_level == 1:
                run.font.size = SIZE_CHAPTER
            elif word_level == 2:
                run.font.size = SIZE_SECTION
            else:
                run.font.size = SIZE_SUBSECTION
            run.font.color.rgb = RGBColor(0x1F, 0x38, 0x64)
            run.bold = True

            i += 1
            continue

        # --- Numbered list ---
        list_match = re.match(r'^(\d+)\.\s+(.+)$', line.strip())
        if list_match:
            p = doc.add_paragraph(style='List Number')
            parse_inline(p, list_match.group(2))
            p.paragraph_format.space_after = Pt(3)
            i += 1
            continue

        # --- Bullet list ---
        bullet_match = re.match(r'^[-*]\s+(.+)$', line.strip())
        if bullet_match:
            p = doc.add_paragraph(style='List Bullet')
            parse_inline(p, bullet_match.group(1))
            p.paragraph_format.space_after = Pt(3)
            i += 1
            continue

        # --- Caption lines (italic, starting with *) ---
        if line.strip().startswith('*') and line.strip().endswith('*') and not line.strip().startswith('**'):
            caption_text = line.strip()[1:-1]
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(caption_text)
            run.italic = True
            run.font.size = Pt(10)
            run.font.name = FONT_BODY
            p.paragraph_format.space_after = Pt(12)
            i += 1
            continue

        # --- Image embeds ---
        img_match = re.match(r'^!\[(.*?)\]\((.*?)\)$', line.strip())
        if img_match:
            alt_text = img_match.group(1)
            img_rel_path = img_match.group(2)
            
            # Try multiple candidate paths
            candidate1 = REPORT_MD.parent / img_rel_path
            candidate2 = REPORT_MD.parent / "screenshots" / Path(img_rel_path).name
            candidate3 = REPORT_MD.parent.parent / "docs" / "screenshots" / Path(img_rel_path).name
            
            chosen_img = None
            for cand in [candidate1, candidate2, candidate3]:
                if cand.exists():
                    chosen_img = cand
                    break
            
            if chosen_img:
                p = doc.add_paragraph()
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.paragraph_format.space_before = Pt(8)
                p.paragraph_format.space_after = Pt(4)
                run = p.add_run()
                run.add_picture(str(chosen_img), width=Inches(5.5))
            else:
                p = doc.add_paragraph()
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = p.add_run(f"[{alt_text}]")
                run.italic = True
            i += 1
            continue

        # --- Screenshot / figure placeholders ---
        if line.strip().startswith('[INSERT SCREENSHOT') or line.strip().startswith('[INSERT RESULT') or line.strip().startswith('[INSERT'):
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(line.strip())
            run.font.color.rgb = RGBColor(0xFF, 0x00, 0x00)
            run.bold = True
            run.font.size = Pt(11)
            run.font.name = FONT_BODY
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(12)
            # Add a border box
            add_shading(p, "FFF2CC")
            i += 1
            continue

        # --- &nbsp; (spacer) ---
        if line.strip() == '&nbsp;':
            doc.add_paragraph()
            i += 1
            continue

        # --- Regular paragraph ---
        p = doc.add_paragraph()
        parse_inline(p, line.strip())
        i += 1

    # Flush any remaining table
    if in_table and table_rows:
        flush_table(doc, table_rows)


def flush_table(doc: Document, rows: list[list[str]]):
    """Create a table from accumulated rows (first row = header)."""
    if len(rows) < 2:
        # Single row, treat as paragraph
        for row in rows:
            p = doc.add_paragraph()
            p.add_run(' | '.join(row))
        return
    header = rows[0]
    data = rows[1:]
    add_table_from_rows(doc, header, data)


def main():
    print("Reading markdown report...")
    md_text = REPORT_MD.read_text(encoding="utf-8")

    print("Creating document...")
    doc = Document()
    setup_styles(doc)
    setup_page(doc)

    print("Processing markdown content...")
    process_markdown(doc, md_text)

    print(f"Saving to {OUTPUT_DOCX}...")
    doc.save(str(OUTPUT_DOCX))
    print(f"Done! Report saved to: {OUTPUT_DOCX}")
    print(f"File size: {OUTPUT_DOCX.stat().st_size / 1024:.0f} KB")

    # Count approximate pages
    para_count = len(doc.paragraphs)
    table_count = len(doc.tables)
    print(f"Paragraphs: {para_count}, Tables: {table_count}")


if __name__ == "__main__":
    main()
