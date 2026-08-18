"""
Export service for generating CSV and PDF reports from search results.
Milestone 3 requirement.
"""

import csv
import html
import io
import re
from datetime import datetime, timezone
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)


def strip_html_tags(text: str | None) -> str:
    """Removes HTML markup tags (e.g., <mark>) from snippets."""
    if not text:
        return ""
    return re.sub(r"<[^>]+>", "", text).strip()


def convert_mark_tags_to_reportlab(text: str | None) -> str:
    """Converts <mark>word</mark> tags to ReportLab paragraph bold/color markup while escaping XML special chars."""
    if not text:
        return ""
    text = re.sub(r"<mark>", "__MARK_START__", text, flags=re.IGNORECASE)
    text = re.sub(r"</mark>", "__MARK_END__", text, flags=re.IGNORECASE)
    text = html.escape(text)
    text = text.replace("__MARK_START__", '<font color="#1d4ed8"><b>')
    text = text.replace("__MARK_END__", '</b></font>')
    return text


UNSAFE_CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def sanitize_csv_cell(value: Any) -> Any:
    """
    Sanitizes cell values to prevent CSV Formula Injection (CWE-1236).
    If a string begins with formula triggers (=, +, -, @, \t, \r),
    prefixes it with a single quote (') so spreadsheets treat it as plain text.
    """
    if value is None:
        return ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return value
    val_str = str(value)
    if val_str and (val_str[0] in UNSAFE_CSV_FORMULA_PREFIXES or val_str.lstrip()[:1] in UNSAFE_CSV_FORMULA_PREFIXES):
        return f"'{val_str}"
    return val_str


def export_to_csv(results: list[dict[str, Any]], query: str | None = None) -> bytes:
    """
    Generates a CSV file byte stream from search result dictionaries.
    Headers: Query, Title/Filename, Snippet/Content, Score, Type, Date, URL/Path
    """
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # Write Header Row
    writer.writerow([
        "Query",
        "Title/Filename",
        "Snippet/Content",
        "Score",
        "Type",
        "Date",
        "URL/Path"
    ])

    query_val = sanitize_csv_cell(query or "")

    for item in results:
        title = sanitize_csv_cell(item.get("filename", ""))
        snippet_clean = sanitize_csv_cell(strip_html_tags(item.get("snippet", "") or item.get("excerpt", "")))
        score = item.get("score", 0.0)
        if score is None:
            score = item.get("consensus_score", 0.0) or 0.0
        score = sanitize_csv_cell(score)
        item_type = sanitize_csv_cell(item.get("type", "file"))
        created_at = sanitize_csv_cell(item.get("created_at", ""))
        url_or_path = sanitize_csv_cell(item.get("url") or item.get("filename") or "")

        writer.writerow([
            query_val,
            title,
            snippet_clean,
            score,
            item_type,
            created_at,
            url_or_path
        ])

    return output.getvalue().encode("utf-8-sig")


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass ReportLab canvas to compute total page numbers and add footers.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Footer text
        footer_text = f"DocIntel AI Search Export  |  Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 36, 20, footer_text)
        self.drawString(36, 20, f"Generated on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")

        # Footer divider line
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.5)
        self.line(36, 32, letter[0] - 36, 32)
        self.restoreState()


def export_to_pdf(results: list[dict[str, Any]], query: str | None = None) -> bytes:
    """
    Generates a professional PDF byte stream from search results using ReportLab Platypus.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=45
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=4
    )

    meta_style = ParagraphStyle(
        "DocMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569"),
        spaceAfter=10
    )

    card_title_style = ParagraphStyle(
        "CardTitle",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=2
    )

    card_meta_style = ParagraphStyle(
        "CardMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=4
    )

    snippet_style = ParagraphStyle(
        "SnippetText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#334155")
    )

    story = []

    # Title & Document Header
    story.append(Paragraph("DocIntel AI — Search Results Report", title_style))

    escaped_query = html.escape(query) if query else ""
    query_str = f'<b>Query:</b> "{escaped_query}"' if query else '<b>Query:</b> <i>[All Documents]</i>'
    count_str = f'<b>Total Results:</b> {len(results)}'
    story.append(Paragraph(f"{query_str}  &nbsp;|&nbsp;  {count_str}", meta_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=12))

    if not results:
        empty_style = ParagraphStyle(
            "EmptyNotice",
            parent=styles["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=10,
            textColor=colors.HexColor("#64748b")
        )
        story.append(Paragraph("No search results match the specified criteria.", empty_style))
    else:
        for idx, item in enumerate(results, 1):
            card_elements = []

            filename = html.escape(str(item.get("filename", "Untitled")))
            item_type = html.escape(str(item.get("type", "file")).upper())
            score = item.get("score", 0.0)
            if score is None:
                score = item.get("consensus_score", 0.0) or 0.0
            created_at = html.escape(str(item.get("created_at", ""))[:10])  # YYYY-MM-DD
            url_or_path = html.escape(str(item.get("url") or item.get("filename") or ""))

            # Card Header
            title_p = Paragraph(f"{idx}. {filename}", card_title_style)
            meta_p = Paragraph(
                f"<b>Type:</b> {item_type} &nbsp;|&nbsp; "
                f"<b>Score:</b> {score:.4f} &nbsp;|&nbsp; "
                f"<b>Date:</b> {created_at} &nbsp;|&nbsp; "
                f"<b>Source:</b> {url_or_path}",
                card_meta_style
            )
            card_elements.extend([title_p, meta_p])

            # Snippet Text
            snippet_raw = item.get("snippet", "") or item.get("excerpt", "")
            if snippet_raw:
                snippet_formatted = convert_mark_tags_to_reportlab(snippet_raw)
                snippet_p = Paragraph(f"<i>Snippet:</i> {snippet_formatted}", snippet_style)
                card_elements.append(snippet_p)

            story.append(KeepTogether(card_elements))
            story.append(Spacer(1, 8))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#f1f5f9"), spaceAfter=8))

    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()
