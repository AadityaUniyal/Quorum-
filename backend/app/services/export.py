"""
Export service for generating CSV and PDF reports from search results.
Milestone 3 requirement.
"""

import csv
import html
import io
import re
from datetime import UTC, datetime
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
        self.drawString(36, 20, f"Generated on {datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S UTC')}")

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
                card_elements.append(Paragraph(snippet_formatted, snippet_style))
            story.append(KeepTogether(card_elements))
            story.append(Spacer(1, 8))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#f1f5f9"), spaceAfter=8))

    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()


# ------------------------------------------------------------------------------
# ERP & Accounting Integration Export Engine (Roadmap Phase 2.4)
# Supports QuickBooks Online, Xero XML, SAP S/4HANA & NetSuite CSV, Universal JSON
# ------------------------------------------------------------------------------

import json


def _extract_doc_payload(doc: Any) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Extracts field key-values and normalized line items from a Document ORM instance."""
    fields_dict: dict[str, Any] = {}
    if hasattr(doc, "fields") and doc.fields:
        for f in doc.fields:
            fields_dict[f.field_key] = f.consensus_value

    line_items: list[dict[str, Any]] = []
    items_raw = fields_dict.get("line_items") or fields_dict.get("items") or fields_dict.get("table")
    if items_raw:
        if isinstance(items_raw, str):
            try:
                parsed = json.loads(items_raw)
                if isinstance(parsed, list):
                    line_items = parsed
            except Exception:
                pass
        elif isinstance(items_raw, list):
            line_items = items_raw

    if not line_items:
        total = fields_dict.get("total_amount") or fields_dict.get("total") or "0.00"
        clean_total = re.sub(r"[^\d.]", "", str(total)) or "0.00"
        vendor = fields_dict.get("vendor_name") or fields_dict.get("vendor") or "Procurement Item"
        line_items = [{
            "description": f"Procurement Charges — {vendor}",
            "quantity": 1,
            "unit_price": float(clean_total),
            "total": float(clean_total)
        }]

    return fields_dict, line_items


def export_to_quickbooks(doc: Any) -> dict[str, Any]:
    """
    Exports extracted document data to standard QuickBooks Online / Desktop Bill JSON schema.
    """
    fields, items = _extract_doc_payload(doc)

    vendor = fields.get("vendor_name") or fields.get("vendor") or "Generic Vendor"
    inv_num = fields.get("invoice_number") or fields.get("invoice_id") or doc.filename
    total_str = fields.get("total_amount") or fields.get("total") or "0.00"
    total_clean = float(re.sub(r"[^\d.]", "", str(total_str)) or 0.0)
    doc_date = fields.get("invoice_date") or fields.get("date") or datetime.now(UTC).strftime("%Y-%m-%d")
    due_date = fields.get("due_date") or doc_date

    lines = []
    for idx, item in enumerate(items, 1):
        line_qty = float(item.get("quantity") or item.get("qty") or 1)
        line_unit = float(item.get("unit_price") or item.get("price") or 0.0)
        line_total = float(item.get("total") or item.get("amount") or (line_qty * line_unit))
        lines.append({
            "Id": str(idx),
            "LineNum": idx,
            "Description": item.get("description") or item.get("name") or f"Item {idx}",
            "Amount": line_total,
            "DetailType": "SalesItemLineDetail",
            "SalesItemLineDetail": {
                "ItemRef": {
                    "name": item.get("sku") or item.get("item_code") or "Services",
                    "value": "1"
                },
                "UnitPrice": line_unit,
                "Qty": line_qty
            }
        })

    return {
        "Bill": {
            "VendorRef": {
                "name": vendor,
                "value": "VENDOR_AUTODETECT"
            },
            "TxnDate": doc_date,
            "DueDate": due_date,
            "DocNumber": inv_num,
            "TotalAmt": total_clean,
            "PrivateNote": f"Processed via DocIntel AI Multi-Agent Consensus (Score: {doc.consensus_score or 1.0:.2f})",
            "Line": lines
        },
        "DocIntelMetadata": {
            "document_id": str(doc.id),
            "filename": doc.filename,
            "consensus_score": doc.consensus_score,
            "exported_at": datetime.now(UTC).isoformat()
        }
    }


def export_to_xero(doc: Any) -> str:
    """
    Exports extracted document data to standardized Xero ACCPAY XML payload.
    """
    fields, items = _extract_doc_payload(doc)

    vendor = html.escape(str(fields.get("vendor_name") or fields.get("vendor") or "Generic Vendor"))
    inv_num = html.escape(str(fields.get("invoice_number") or fields.get("invoice_id") or doc.filename))
    doc_date = html.escape(str(fields.get("invoice_date") or fields.get("date") or datetime.now(UTC).strftime("%Y-%m-%d")))
    due_date = html.escape(str(fields.get("due_date") or doc_date))
    total_str = fields.get("total_amount") or fields.get("total") or "0.00"
    total_clean = float(re.sub(r"[^\d.]", "", str(total_str)) or 0.0)

    line_items_xml = []
    for item in items:
        desc = html.escape(str(item.get("description") or item.get("name") or "Item"))
        qty = float(item.get("quantity") or item.get("qty") or 1)
        unit = float(item.get("unit_price") or item.get("price") or 0.0)
        line_tot = float(item.get("total") or item.get("amount") or (qty * unit))
        line_items_xml.append(f"""      <LineItem>
        <Description>{desc}</Description>
        <Quantity>{qty}</Quantity>
        <UnitAmount>{unit:.2f}</UnitAmount>
        <LineAmount>{line_tot:.2f}</LineAmount>
        <AccountCode>200</AccountCode>
      </LineItem>""")

    xml_lines = "\n".join(line_items_xml)
    return f"""<?xml version="1.0" encoding="utf-8"?>
<Invoices>
  <Invoice>
    <Type>ACCPAY</Type>
    <Contact>
      <Name>{vendor}</Name>
    </Contact>
    <Date>{doc_date}</Date>
    <DueDate>{due_date}</DueDate>
    <InvoiceNumber>{inv_num}</InvoiceNumber>
    <Status>AUTHORISED</Status>
    <LineAmountTypes>Exclusive</LineAmountTypes>
    <LineItems>
{xml_lines}
    </LineItems>
    <Total>{total_clean:.2f}</Total>
  </Invoice>
</Invoices>"""


def export_to_sap(doc: Any) -> str:
    """
    Exports extracted document data to standard SAP S/4HANA and NetSuite AP Journal CSV format.
    """
    fields, items = _extract_doc_payload(doc)

    vendor = sanitize_csv_cell(fields.get("vendor_name") or fields.get("vendor") or "VEND_9001")
    inv_num = sanitize_csv_cell(fields.get("invoice_number") or fields.get("invoice_id") or doc.filename)
    doc_date = sanitize_csv_cell(fields.get("invoice_date") or fields.get("date") or datetime.now(UTC).strftime("%Y-%m-%d"))
    total_str = fields.get("total_amount") or fields.get("total") or "0.00"
    total_clean = float(re.sub(r"[^\d.]", "", str(total_str)) or 0.0)

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # Standard SAP FI-AP Header
    writer.writerow([
        "RecordType",
        "CompanyCode",
        "DocumentDate",
        "PostingDate",
        "Reference",
        "Currency",
        "VendorAccount",
        "GLAccount",
        "DebitCredit",
        "Amount",
        "TaxCode",
        "ItemText"
    ])

    # Header Row
    writer.writerow([
        "HEADER",
        "1000",
        doc_date,
        doc_date,
        inv_num,
        "USD",
        vendor,
        "",
        "",
        "",
        "",
        f"DocIntel AI Consensus {doc.consensus_score or 1.0:.2f}"
    ])

    # Debit Lines (Expense Items)
    for idx, item in enumerate(items, 1):
        desc = sanitize_csv_cell(item.get("description") or f"Line Item {idx}")
        qty = float(item.get("quantity") or item.get("qty") or 1)
        unit = float(item.get("unit_price") or item.get("price") or 0.0)
        line_tot = float(item.get("total") or item.get("amount") or (qty * unit))
        writer.writerow([
            "ITEM",
            "1000",
            doc_date,
            doc_date,
            inv_num,
            "USD",
            "",
            "600100",  # Default AP Operating Expense GL Account
            "Debit",
            f"{line_tot:.2f}",
            "I0",
            desc
        ])

    # Credit Line (Vendor Liability)
    writer.writerow([
        "ITEM",
        "1000",
        doc_date,
        doc_date,
        inv_num,
        "USD",
        vendor,
        "200100",  # Accounts Payable GL Account
        "Credit",
        f"{total_clean:.2f}",
        "I0",
        f"Invoice {inv_num} Total Liability"
    ])

    return output.getvalue()


def export_to_universal_json(doc: Any) -> dict[str, Any]:
    """
    Exports full document provenance, fields, table structures, and audit trail in Universal JSON.
    """
    fields_dict: dict[str, Any] = {}
    if hasattr(doc, "fields") and doc.fields:
        for f in doc.fields:
            fields_dict[f.field_key] = {
                "value": f.consensus_value,
                "confidence": getattr(f, "confidence_score", getattr(f, "confidence", 1.0)),
                "bounding_box": f.bounding_box,
                "page_number": f.page_number,
                "validation_status": f.validation_status.value if f.validation_status else "VALID"
            }

    _, line_items = _extract_doc_payload(doc)

    return {
        "schema_version": "2.0.0",
        "universal_schema_version": "2.0.0",
        "document_metadata": {
            "document_id": str(doc.id),
            "filename": doc.filename,
            "file_type": doc.file_type,
            "category": doc.category.value if doc.category else "UNKNOWN",
            "status": doc.status.value if doc.status else "COMPLETED",
            "consensus_score": doc.consensus_score,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
        },
        "extracted_fields": fields_dict,
        "line_items": line_items,
        "export_timestamp": datetime.now(UTC).isoformat()
    }
