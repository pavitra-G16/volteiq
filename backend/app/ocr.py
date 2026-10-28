"""Conservative field candidates extracted from real Tesseract text."""
from datetime import date, datetime
import re


def _field(candidates: list[tuple[float, str]]) -> dict:
    unique = {value for value, _ in candidates}
    if len(unique) == 1:
        return {"value": candidates[0][0], "status": "extracted", "evidence": candidates[0][1], "candidate_count": len(candidates)}
    status = "conflicting" if unique else "missing"
    evidence = "Multiple values were detected; enter the value shown on your bill." if unique else None
    return {"value": None, "status": status, "evidence": evidence, "candidate_count": len(candidates)}


def _iso_bill_date(value: str) -> str | None:
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y", "%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def extract_candidates(text: str) -> dict:
    """Return value candidates, never inferred replacements for missing/conflicting evidence."""
    lines = text.splitlines()

    def number_candidates(pattern: str) -> list[tuple[float, str]]:
        found = []
        for line in lines:
            match = re.search(pattern, line, re.I)
            if match:
                try:
                    found.append((float(match.group(1).replace(",", "")), line.strip()[:160]))
                except ValueError:
                    continue
        return found

    consumption = _field(number_candidates(r"(?:units|consumption|kwh)\D{0,18}([\d,]+(?:\.\d+)?)"))
    amount = _field(number_candidates(r"(?:total\s*(?:bill|amount|payable)|amount\s*due)\D{0,18}(?:₹|rs\.?\s*)?([\d,]+(?:\.\d+)?)"))

    periods: list[tuple[list[str], str]] = []
    for line in lines:
        if not re.search(r"(?:billing|bill|reading)\s*period|period\s*(?:from|start)", line, re.I):
            continue
        raw_dates = re.findall(r"\b(\d{1,4}[/-]\d{1,2}[/-]\d{2,4})\b", line)
        parsed_dates = [_iso_bill_date(value) for value in raw_dates]
        if len(parsed_dates) >= 2 and parsed_dates[0] and parsed_dates[1] and parsed_dates[0] <= parsed_dates[1]:
            periods.append(([parsed_dates[0], parsed_dates[1]], line.strip()[:160]))

    period = {"value": None, "status": "missing", "evidence": None}
    days = {"value": None, "status": "missing", "evidence": None}
    if len(periods) == 1:
        start, end = (date.fromisoformat(value) for value in periods[0][0])
        period = {"value": periods[0][0], "status": "candidate_review_required", "evidence": periods[0][1]}
        days = {"value": (end - start).days + 1, "status": "derived_from_period_candidate", "evidence": periods[0][1]}
    elif len(periods) > 1:
        period = {"value": None, "status": "conflicting", "evidence": "Multiple bill-period lines were detected; enter the correct dates manually."}

    return {"consumption_kwh": consumption, "total_amount_inr": amount, "billing_period": period, "billing_days": days}
