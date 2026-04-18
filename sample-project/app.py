import gradio as gr
import re


SCAM_RULES = [
    # Strong payment indicators.
    (re.compile(r"\b(registration|application|joining|security|training|processing)\s+fee\b", re.I), 3, "Mentions an upfront fee"),
    (re.compile(r"\b(pay|send|transfer|deposit)\b.{0,40}\b(fee|money|payment|charges?)\b", re.I), 3, "Requests payment from applicant"),
    (re.compile(r"\b(non[- ]?refundable|advance payment|refundable deposit)\b", re.I), 3, "Uses risky payment terms"),

    # Unrealistic hiring promises.
    (re.compile(r"\b(no interview|without interview|instant offer|guaranteed job|100% placement)\b", re.I), 2, "Promises hiring without standard screening"),
    (re.compile(r"\b(no experience|fresher welcome|any qualification)\b", re.I), 1, "Very low hiring bar"),

    # Contact and identity red flags.
    (re.compile(r"\b(whatsapp|telegram)\b", re.I), 1, "Pushes communication to private chat apps"),
    (re.compile(r"\b(otp|bank account|ifsc|upi|debit card|credit card|cvv|passport)\b", re.I), 2, "Requests sensitive data too early"),
]


def _salary_red_flag(text):
    # Flags unusually high salary claims often used in scam posts.
    return bool(re.search(r"\b(80k|100k|1\s*lakh|2\s*lakh|3\s*lakh|\d{6,})\b", text, re.I))


def detect_fake_job(description):
    normalized_text = (description or "").strip().lower()

    if not normalized_text:
        return {
            "result": "Unknown",
            "reason": "Empty description",
        }

    score = 0
    reasons = []

    for pattern, weight, reason in SCAM_RULES:
        if pattern.search(normalized_text):
            score += weight
            reasons.append(reason)

    if _salary_red_flag(normalized_text) and re.search(r"\b(no experience|fresher|quick join|immediate join)\b", normalized_text, re.I):
        score += 2
        reasons.append("Unusually high salary paired with low entry requirements")

    # Threshold tuned to reduce false positives while catching clear scams.
    if score >= 3:
        unique_reasons = list(dict.fromkeys(reasons))
        return {
            "result": "Fake Job",
            "reason": "; ".join(unique_reasons[:4]) if unique_reasons else "Multiple scam indicators detected",
        }

    return {
        "result": "Real Job",
        "reason": "No strong scam indicators detected",
    }


demo = gr.Interface(
    fn=detect_fake_job,
    inputs=gr.Textbox(lines=10, label="Paste Job Description"),
    outputs="json",
)

demo.launch(server_name="0.0.0.0", server_port=7860)
