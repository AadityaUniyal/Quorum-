import json
import math
import os
import re
from typing import Any

# Local synonym storage path
SYNONYM_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "synonyms.json")

def load_local_synonyms() -> dict[str, list[str]]:
    """Load local synonym dictionary from JSON file."""
    if not os.path.exists(SYNONYM_FILE):
        default = {
            "invoice": ["bill", "receipt", "charge", "payment"],
            "rfq": ["request for quote", "quote", "part spec", "specification"],
            "contract": ["agreement", "msa", "nda", "covenant"],
            "compliance": ["certification", "standards", "iso", "rohs"]
        }
        with open(SYNONYM_FILE, "w") as f:
            json.dump(default, f, indent=2)
        return default
    try:
        with open(SYNONYM_FILE) as f:
            return json.load(f)
    except Exception:
        return {}

def save_local_synonyms(data: dict[str, list[str]]):
    """Save local synonym dictionary to JSON file."""
    with open(SYNONYM_FILE, "w") as f:
        json.dump(data, f, indent=2)


class LocalNaiveBayesClassifier:
    """
    Pure-Python Naive Bayes Document Classifier.
    Computes class probabilities based on term frequencies.
    """
    CLASSES = ["INVOICE", "RFQ", "CONTRACT", "COMPLIANCE"]

    # Class term vocabulary seeds
    VOCAB = {
        "INVOICE": ["invoice", "bill", "subtotal", "tax", "due", "total", "vendor", "payment", "amount", "charge", "remit", "invoice number"],
        "RFQ": ["rfq", "reference", "part", "tolerance", "drawing", "material", "spec", "revision", "quantity", "machining", "steel", "supplier"],
        "CONTRACT": ["agreement", "contract", "parties", "governing law", "hereby", "effective date", "term", "termination", "indemnity", "disclosure", "confidential"],
        "COMPLIANCE": ["certificate", "compliance", "standard", "iso", "astm", "rohs", "conformity", "test report", "inspection", "regulation", "directives"]
    }

    @classmethod
    def classify(cls, text: str) -> tuple[str, dict[str, float]]:
        """
        Classifies raw text and returns the best class and a probability distribution map.
        """
        text_lower = text.lower()
        tokens = re.findall(r"\b\w+\b", text_lower)
        token_set = set(tokens)

        scores = {}
        for c in cls.CLASSES:
            # Simple prior probability (uniform across 4 classes = 0.25)
            score = math.log(0.25)
            keywords = cls.VOCAB[c]

            # Compute term presence probability
            for keyword in keywords:
                if keyword in token_set:
                    # High probability if keyword matches class
                    score += math.log(0.85)
                else:
                    # Low probability if class keyword is missing
                    score += math.log(0.15)
            scores[c] = score

        # Check if ANY class keyword was matched
        matched_any = any(kw in token_set for kws in cls.VOCAB.values() for kw in kws)
        if not matched_any:
            return "UNKNOWN", {c: 0.25 for c in cls.CLASSES}

        # Convert log probabilities to relative probabilities (softmax equivalent)
        max_score = max(scores.values())
        exp_scores = {c: math.exp(score - max_score) for c, score in scores.items()}
        total_sum = sum(exp_scores.values())

        probabilities = {}
        for c in cls.CLASSES:
            probabilities[c] = round(exp_scores[c] / total_sum, 4) if total_sum > 0 else 0.25

        best_class = max(probabilities, key=probabilities.get)
        return best_class, probabilities


class LocalTableReconstructor:
    """
    Parses OCR text layouts, extracts tables, and audits line items.
    """

    @staticmethod
    def extract_table(ocr_text: str) -> list[dict[str, Any]]:
        """
        Scans text lines for table dividers or patterns and reconstructs row items.
        Handles vertical bars | and spaced columns.
        """
        rows = []
        lines = ocr_text.split("\n")

        for line in lines:
            line_str = line.strip()
            # Look for lines containing numeric columns resembling table items
            # E.g. Description   Quantity   Price   Total
            if "|" in line_str:
                cells = [c.strip() for c in line_str.split("|") if c.strip()]
                # Verify cells look like line item (e.g. qty, price, total)
                if len(cells) >= 3:
                    rows.append(cells)
            else:
                # Fallback: split by multiple spaces (2 or more spaces)
                cells = re.split(r"\s{2,}", line_str)
                if len(cells) >= 3:
                    # Verify if numeric values are present at the end
                    if any(re.search(r"\d", c) for c in cells[1:]):
                        rows.append(cells)

        line_items = []
        for r in rows:
            # Check if this row contains headers to filter them
            if any(h in "".join(r).lower() for h in ["description", "item", "qty", "quantity", "unit price"]):
                continue

            # Try to identify columns: Description, Qty, Unit Price, Total
            desc = r[0]
            qty_val = 1
            price_val = 0.0
            total_val = 0.0

            # Match numbers in trailing columns
            numbers = []
            for cell in r[1:]:
                clean_num = cell.replace("$", "").replace(",", "").strip()
                try:
                    numbers.append(float(clean_num))
                except ValueError:
                    continue

            if len(numbers) >= 3:
                # Format: [..., quantity, price, total]
                qty_val = int(numbers[-3])
                price_val = numbers[-2]
                total_val = numbers[-1]
            elif len(numbers) == 2:
                # Format: [..., quantity, total] (guess price = total/quantity)
                qty_val = int(numbers[0])
                total_val = numbers[1]
                price_val = round(total_val / qty_val, 2) if qty_val > 0 else total_val
            elif len(numbers) == 1:
                total_val = numbers[0]
                price_val = total_val

            line_items.append({
                "description": desc,
                "quantity": qty_val,
                "unit_price": price_val,
                "total": total_val
            })

        return line_items

    @staticmethod
    def audit_line_items(line_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Mathematical Auditor for line items:
        Checks if Quantity * Unit Price == Total and tags audit flags.
        """
        audit_results = []
        for item in line_items:
            qty = item.get("quantity", 1)
            price = item.get("unit_price", 0.0)
            total = item.get("total", 0.0)
            expected = round(qty * price, 2)

            is_valid = math.isclose(expected, total, abs_tol=0.01)
            notes = (
                f"Math verified: {qty} x ${price:.2f} == ${total:.2f}" if is_valid
                else f"Math discrepancy: Expected {qty} x ${price:.2f} = ${expected:.2f}, but got ${total:.2f}"
            )
            audit_results.append({
                "description": item.get("description", "Unknown Item"),
                "is_valid": is_valid,
                "notes": notes
            })
        return audit_results


class LocalLayoutParser:
    """
    Layout and Rule-based document extraction engine.
    Parses fields based on keyword-relative positioning and patterns.
    """

    @staticmethod
    def extract_fields(ocr_text: str, category: str) -> dict[str, Any]:
        """Extracts structured values from text based on category layout rules."""
        text_lower = ocr_text.lower()
        extracted = {}

        if category == "INVOICE":
            extracted = {
                "invoice_number": "N/A",
                "invoice_date": "N/A",
                "vendor_name": "N/A",
                "subtotal": "0.00",
                "tax": "0.00",
                "shipping": "0.00",
                "total_amount": "0.00",
                "line_items": []
            }

            inv_no = re.search(r"(?:invoice\s*(?:number|no\.?|#))\s*[:\-]?\s*([a-z0-9\-]+)", text_lower)
            if inv_no:
                extracted["invoice_number"] = inv_no.group(1).upper()

            date_match = re.search(r"(?:invoice\s*)?date\s*[:\-]?\s*([0-9a-zA-Z,/\- ]+)", text_lower)
            if date_match:
                extracted["invoice_date"] = date_match.group(1).strip().title()

            lines = [l.strip() for l in ocr_text.split("\n") if l.strip()]
            if lines:
                extracted["vendor_name"] = lines[0]

            subtotal = re.search(r"subtotal\s*[:\-]?\s*\$?([0-9,]+\.[0-9]{2})", text_lower)
            if subtotal:
                extracted["subtotal"] = subtotal.group(1).replace(",", "")

            tax = re.search(r"tax\s*\([0-9\.]*%\)?\s*[:\-]?\s*\$?([0-9,]+\.[0-9]{2})", text_lower)
            if not tax:
                tax = re.search(r"tax\s*[:\-]?\s*\$?([0-9,]+\.[0-9]{2})", text_lower)
            if tax:
                extracted["tax"] = tax.group(1).replace(",", "")

            shipping = re.search(r"shipping\s*[:\-]?\s*\$?([0-9,]+\.[0-9]{2})", text_lower)
            if shipping:
                extracted["shipping"] = shipping.group(1).replace(",", "")

            total = re.search(r"(?:total\s*amount|total\s*due|total)\s*[:\-]?\s*\$?([0-9,]+\.[0-9]{2})", text_lower)
            if total:
                extracted["total_amount"] = total.group(1).replace(",", "")

            # Extracted Line Items
            extracted["line_items"] = LocalTableReconstructor.extract_table(ocr_text)

        elif category == "RFQ":
            extracted = {
                "rfq_reference": "N/A",
                "part_number": "N/A",
                "material": "N/A",
                "quantity": "0",
                "tolerance": "N/A",
                "line_items": []
            }
            rfq_ref = re.search(r"(?:rfq\s*(?:reference|no\.?|#|ref))\s*[:\-]?\s*([a-z0-9\-]+)", text_lower)
            if rfq_ref:
                extracted["rfq_reference"] = rfq_ref.group(1).upper()

            part = re.search(r"(?:part\s*(?:number|no\.?|#))\s*[:\-]?\s*([a-z0-9\-]+)", text_lower)
            if part:
                extracted["part_number"] = part.group(1).upper()

            material = re.search(r"material\s*[:\-]?\s*([a-zA-Z0-9\- ]+)", text_lower)
            if material:
                extracted["material"] = material.group(1).strip().title()

            qty = re.search(r"(?:qty|quantity)\s*[:\-]?\s*([0-9]+)", text_lower)
            if qty:
                extracted["quantity"] = qty.group(1)

            tol = re.search(r"tolerance\s*[:\-]?\s*([a-zA-Z0-9%+\-/\. ]+)", text_lower)
            if tol:
                extracted["tolerance"] = tol.group(1).strip()

            extracted["line_items"] = LocalTableReconstructor.extract_table(ocr_text)

        elif category == "CONTRACT":
            extracted = {
                "effective_date": "N/A",
                "expiry_date": "N/A",
                "client_name": "N/A",
                "contractor_name": "N/A",
                "governing_law": "N/A",
                "line_items": []
            }
            gov = re.search(r"governing\s*law\s*(?:of|is)?\s*([a-z\s]+)", text_lower)
            if gov:
                extracted["governing_law"] = gov.group(1).strip().title()

            eff = re.search(r"effective\s*date\s*[:\-]?\s*([0-9a-z\s,/\-]+)", text_lower)
            if eff:
                extracted["effective_date"] = eff.group(1).strip().title()

            exp = re.search(r"(?:expiry\s*date|expires)\s*[:\-]?\s*([0-9a-z\s,/\-]+)", text_lower)
            if exp and exp.group(1):
                extracted["expiry_date"] = exp.group(1).strip().title()

            lines = [l.strip() for l in ocr_text.split("\n") if l.strip()]
            if len(lines) >= 2:
                extracted["client_name"] = lines[0]
                extracted["contractor_name"] = lines[1]

        else:
            extracted = {
                "document_title": "N/A",
                "extracted_date": "N/A",
                "line_items": []
            }
            lines = [l.strip() for l in ocr_text.split("\n") if l.strip()]
            if lines:
                extracted["document_title"] = lines[0]

        return extracted


class LocalTfidfSearch:
    """
    Self-contained text vectorization, similarity search, and extractive QA.
    """

    @staticmethod
    def tokenize(text: str) -> list[str]:
        """Convert text to clean lowercase tokenized words."""
        return re.findall(r"\b\w{3,}\b", text.lower())

    @classmethod
    def expand_query_with_synonyms(cls, query: str) -> str:
        """Expand search queries using the local synonym dictionary."""
        syns = load_local_synonyms()
        tokens = cls.tokenize(query)
        expanded = list(tokens)

        for t in tokens:
            for base_word, word_list in syns.items():
                if t == base_word or t in word_list:
                    expanded.extend([base_word] + [w for w in word_list if w != t])

        return " ".join(set(expanded))

    @classmethod
    def compute_tfidf(cls, query: str, documents: list[str]) -> list[tuple[int, float]]:
        """
        Calculates similarity scores of documents to a query using TF-IDF.
        Uses expanded synonyms for queries to find matching semantics.
        """
        expanded_query = cls.expand_query_with_synonyms(query)
        query_tokens = cls.tokenize(expanded_query)
        if not query_tokens or not documents:
            return [(i, 0.0) for i in range(len(documents))]

        doc_tokens = [cls.tokenize(doc) for doc in documents]
        num_docs = len(documents)

        vocab = set(query_tokens)
        df = {}
        for term in vocab:
            df[term] = sum(1 for tokens in doc_tokens if term in tokens)

        query_tf = {}
        for token in query_tokens:
            query_tf[token] = query_tf.get(token, 0) + 1

        query_vector = {}
        query_norm_sq = 0.0
        for term in vocab:
            idf = math.log((1 + num_docs) / (1 + df.get(term, 0))) + 1
            query_vector[term] = query_tf[term] * idf
            query_norm_sq += query_vector[term] ** 2
        query_norm = math.sqrt(query_norm_sq)

        if query_norm == 0:
            return [(i, 0.0) for i in range(len(documents))]

        results = []
        for doc_idx, tokens in enumerate(doc_tokens):
            if not tokens:
                results.append((doc_idx, 0.0))
                continue

            doc_tf = {}
            for t in tokens:
                if t in vocab:
                    doc_tf[t] = doc_tf.get(t, 0) + 1

            dot_product = 0.0
            doc_norm_sq = 0.0
            for term in vocab:
                idf = math.log((1 + num_docs) / (1 + df.get(term, 0))) + 1
                doc_val = doc_tf.get(term, 0) * idf
                dot_product += query_vector[term] * doc_val
                doc_norm_sq += doc_val ** 2

            doc_norm = math.sqrt(doc_norm_sq)
            if doc_norm > 0:
                score = dot_product / (query_norm * doc_norm)
            else:
                score = 0.0

            results.append((doc_idx, score))

        return results

    @classmethod
    def extractive_qa(cls, question: str, docs: list) -> tuple[str, list[dict]]:
        """
        Extractive Q&A with cosine semantic TF-IDF scoring.
        """
        segments = []
        for doc in docs:
            text = doc.ocr_text or ""
            sentences = re.split(r"(?<=[.!?])\s+", text)
            for sent in sentences:
                sent_clean = sent.strip()
                if len(sent_clean) > 12:
                    segments.append({
                        "doc_id": str(doc.id),
                        "filename": doc.filename,
                        "text": sent_clean
                    })

        if not segments:
            return f"I could not extract readable segments to answer: '{question}'.", []

        corpus = [seg["text"] for seg in segments]
        scores = cls.compute_tfidf(question, corpus)

        scored_segments = []
        for idx, score in scores:
            if score > 0:
                scored_segments.append({
                    **segments[idx],
                    "score": score
                })

        scored_segments.sort(key=lambda x: x["score"], reverse=True)

        if not scored_segments:
            return f"I could not find precise matches in the selected documents for your question: '{question}'.", []

        top_matches = scored_segments[:3]
        citations = []
        answers = []
        for m in top_matches:
            citations.append({
                "document_id": m["doc_id"],
                "filename": m["filename"],
                "quote": m["text"]
            })
            answers.append(f"[{m['filename']}]: \"{m['text']}\"")

        compiled_answer = "Found matching context in documents:\n" + "\n\n".join(answers)
        return compiled_answer, citations
