import pytest
from unittest.mock import patch, MagicMock
from app.services.ocr import extract_text_from_pdf

@patch("app.services.ocr.pdfplumber.open")
def test_extract_text_from_pdf_success(mock_pdfplumber_open):
    # Setup mock page and tables structure
    mock_pdf = MagicMock()
    mock_pdfplumber_open.return_value.__enter__.return_value = mock_pdf
    
    mock_page = MagicMock()
    mock_page.extract_text.return_value = "Page text content"
    mock_page.extract_tables.return_value = [
        [["Header1", "Header2"], ["Val1", "Val2"]]
    ]
    mock_pdf.pages = [mock_page]

    result = extract_text_from_pdf("dummy.pdf")
    
    assert "Page text content" in result
    assert "--- Page 1 Tables ---" in result
    assert "Header1 | Header2" in result
    assert "Val1 | Val2" in result

@patch("app.services.ocr.pdfplumber.open")
@patch("app.services.ocr.pypdf.PdfReader")
def test_extract_text_from_pdf_fallback_to_pypdf(mock_pypdf_reader, mock_pdfplumber_open):
    # Simulate pdfplumber raising an exception
    mock_pdfplumber_open.side_effect = Exception("pdfplumber error")
    
    mock_reader = MagicMock()
    mock_page = MagicMock()
    mock_page.extract_text.return_value = "PyPDF extracted text"
    mock_reader.pages = [mock_page]
    mock_pypdf_reader.return_value = mock_reader

    result = extract_text_from_pdf("dummy.pdf")
    
    assert result == "PyPDF extracted text"
