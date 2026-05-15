"""Generate a score-report PDF as bytes using ReportLab."""
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

_GREEN = colors.HexColor("#166534")
_RED = colors.HexColor("#991b1b")
_TEAL = colors.HexColor("#1f6f5f")
_LIGHT_GRAY = colors.HexColor("#f5f3f0")
_MID_GRAY = colors.HexColor("#c4b8aa")
_TEXT = colors.HexColor("#1a1208")
_MUTED = colors.HexColor("#7a6a56")

SECTION_LABELS = {
    "english": "English",
    "math": "Mathematics",
    "reading": "Reading",
    "science": "Science",
}

ODD_LETTERS = {1: "A", 2: "B", 3: "C", 4: "D"}
EVEN_LETTERS = {1: "F", 2: "G", 3: "H", 4: "J"}

ANSWER_KEYS = {
    "english": {1:3,2:2,3:1,4:1,5:1,6:1,7:4,8:4,9:2,10:2,11:2,12:4,13:3,14:3,15:4,16:4,17:4,18:3,19:1,20:4,21:1,22:1,23:3,24:4,25:4,26:3,27:4,28:2,29:2,30:2,31:3,32:2,33:1,34:2,35:3,36:3,37:3,38:3,39:4,40:3,41:1,42:2,43:3,44:2,45:1,46:2,47:3,48:3,49:4,50:2},
    "math": {1:4,2:2,3:3,4:3,5:1,6:3,7:3,8:3,9:1,10:4,11:2,12:4,13:3,14:3,15:4,16:1,17:3,18:3,19:1,20:1,21:4,22:2,23:2,24:2,25:3,26:4,27:1,28:3,29:4,30:4,31:2,32:4,33:2,34:3,35:1,36:3,37:4,38:4,39:1,40:3,41:4,42:3,43:2,44:2,45:2},
    "reading": {1:3,2:2,3:4,4:4,5:2,6:1,7:3,8:2,9:3,10:1,11:4,12:4,13:2,14:4,15:1,16:3,17:2,18:2,19:3,20:2,21:2,22:1,23:3,24:4,25:4,26:3,27:4,28:2,29:3,30:4,31:4,32:2,33:3,34:2,35:4,36:3},
    "science": {1:3,2:2,3:2,4:1,5:3,6:2,7:4,8:1,9:2,10:2,11:4,12:3,13:3,14:1,15:3,16:1,17:2,18:4,19:1,20:2,21:3,22:4,23:2,24:3,25:1,26:2,27:1,28:4,29:2,30:1,31:3,32:2,33:4,34:2,35:1,36:3,37:2,38:3,39:4,40:1},
}


def _letter(value, q_num):
    if value is None:
        return "—"
    try:
        n = int(value)
    except (TypeError, ValueError):
        return "—"
    mapping = ODD_LETTERS if q_num % 2 == 1 else EVEN_LETTERS
    return mapping.get(n, "—")


def build_pdf(
    username: str,
    email: str,
    test_name: str,
    answers: dict,
    scores: dict | None,
    created_at: str = "",
) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=LETTER,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", fontSize=22, textColor=_TEAL, spaceAfter=4, fontName="Helvetica-Bold")
    sub_style = ParagraphStyle("sub", fontSize=10, textColor=_MUTED, spaceAfter=2, fontName="Helvetica")
    section_style = ParagraphStyle("section", fontSize=13, textColor=_TEAL, spaceBefore=14, spaceAfter=6, fontName="Helvetica-Bold")
    body_style = ParagraphStyle("body", fontSize=9, textColor=_TEXT, fontName="Helvetica")

    story = []

    # Header
    story.append(Paragraph("Prepmedians Score Report", title_style))
    story.append(Paragraph(f"Student: {username} &nbsp;&nbsp; Email: {email}", sub_style))
    story.append(Paragraph(f"Test: {test_name or 'Unknown'}", sub_style))
    if created_at:
        story.append(Paragraph(f"Date: {created_at}", sub_style))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1, color=_MID_GRAY))
    story.append(Spacer(1, 10))

    # Score summary table
    if scores:
        story.append(Paragraph("Score Summary", section_style))
        header = ["Section", "Questions Correct", "Raw Score", "ACT Score"]
        rows = [header]
        for key, label in SECTION_LABELS.items():
            s = scores.get(key) or {}
            rows.append([
                label,
                f"{s.get('rawScore', '—')} / {s.get('totalPossible', '—')}",
                str(s.get("rawScore", "—")),
                str(s.get("scaleScore", "—")),
            ])
        tbl = Table(rows, colWidths=[2.0 * inch, 2.0 * inch, 1.5 * inch, 1.5 * inch])
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), _TEAL),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [_LIGHT_GRAY, colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.3, _MID_GRAY),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 12))

    # Per-section answer grids
    for key, label in SECTION_LABELS.items():
        section_answers = answers.get(key) or []
        if not section_answers:
            continue
        story.append(Paragraph(label, section_style))
        answer_key = ANSWER_KEYS.get(key, {})

        chunk_size = 10
        for chunk_start in range(0, len(section_answers), chunk_size):
            chunk = section_answers[chunk_start: chunk_start + chunk_size]
            q_nums = [chunk_start + i + 1 for i in range(len(chunk))]

            header_row = [Paragraph(f"<b>Q{q}</b>", body_style) for q in q_nums]
            answer_row = []
            for i, val in enumerate(chunk):
                q_num = chunk_start + i + 1
                letter = _letter(val, q_num)
                expected = answer_key.get(q_num)
                if letter == "—" or expected is None:
                    cell = Paragraph(f"<font color='#7a6a56'>{letter}</font>", body_style)
                elif int(val) == expected:
                    cell = Paragraph(f"<font color='#166534'><b>{letter}</b></font>", body_style)
                else:
                    cell = Paragraph(f"<font color='#991b1b'><b>{letter}</b></font>", body_style)
                answer_row.append(cell)

            col_w = 0.65 * inch
            tbl = Table(
                [header_row, answer_row],
                colWidths=[col_w] * len(chunk),
            )
            tbl.setStyle(TableStyle([
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("BACKGROUND", (0, 0), (-1, 0), _LIGHT_GRAY),
                ("GRID", (0, 0), (-1, -1), 0.3, _MID_GRAY),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            story.append(tbl)
            story.append(Spacer(1, 4))

    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=_MID_GRAY))
    story.append(Spacer(1, 6))
    story.append(Paragraph("Generated by Prepmedians &bull; grader.prepmedians.com", sub_style))

    doc.build(story)
    return buf.getvalue()
