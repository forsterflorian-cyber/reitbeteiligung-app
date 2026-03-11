from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import fitz
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PDF = REPO_ROOT / "output" / "pdf" / "reitbeteiligung-app-summary.pdf"
PREVIEW_PNG = REPO_ROOT / "tmp" / "pdfs" / "reitbeteiligung-app-summary-page-1.png"

TITLE = "reitbeteiligung.app"
SUBTITLE = (
    "One-page repo summary based only on evidence in README, app/, lib/, "
    "types/database.ts, supabase/migrations/, docs/, and tests/."
)

LEFT_COLUMN_SECTIONS = [
    (
        "What It Is",
        "paragraph",
        [
            (
                "reitbeteiligung.app is a Next.js 14 + Supabase web app for "
                "structuring the path from first rider interest to an active "
                "horse-sharing relationship."
            ),
            (
                "It replaces scattered messages with explicit trial slots, "
                "gated approvals, and in-platform chat for owners and riders."
            ),
        ],
    ),
    (
        "Who It's For",
        "paragraph",
        [
            (
                "Primary operational persona in the repo: horse owners "
                "('Pferdehalter') who manage horse profiles, trial requests, "
                "approvals, and ongoing rider relationships."
            ),
            (
                "The second role is riders ('Reiter') who search horses, "
                "request trial slots, and use chat or calendar access after approval."
            ),
        ],
    ),
    (
        "What It Does",
        "bullets",
        [
            "Role-based signup, login, onboarding, and owner/rider dashboards.",
            "Horse profile creation and editing with gallery, location, facts, and publish toggle.",
            "Search that shows only horses with upcoming trial slots, plus PLZ radius filtering.",
            "Trial workflow: request, accept or decline, mark completed, approve, or revoke.",
            "1:1 chat during the trial phase with unread indicators and contact unlock after approval.",
            "Horse group chat for active relationships, plus owner tools to remove a rider cleanly.",
            "Calendar and availability layer for trial slots, blocks, booking requests, and bookings.",
        ],
    ),
]

RIGHT_COLUMN_SECTIONS = [
    (
        "How It Works",
        "bullets",
        [
            "UI and routing live in Next.js App Router pages under app/ with reusable components in components/.",
            "Mutations go through app/actions.ts and lib/server-actions/* for auth guards, horse CRUD, trial lifecycle, approvals, relationship cleanup, calendar rules, and bookings.",
            "Supabase provides Auth, Postgres, RPCs, and storage. Repo evidence shows profiles, horses, horse_images, rider_profiles, trial_requests, approvals, conversations, messages, horse_group_messages, availability_rules, calendar_blocks, booking_requests, and bookings.",
            "Data flow is role-driven: owner publishes horse and trial slots -> rider searches and requests -> owner decides and approves -> approval state unlocks contact data, group chat, and some calendar access.",
        ],
    ),
    (
        "How To Run",
        "bullets",
        [
            "Run npm install.",
            "Create .env.local from .env.example and set NEXT_PUBLIC_SUPABASE_URL plus NEXT_PUBLIC_SUPABASE_ANON_KEY.",
            "Prepare a Supabase project and schema that match the repo tables and migrations. Exact local bootstrap or seed command: Not found in repo.",
            "Run npm run dev, then open http://localhost:3000.",
        ],
    ),
    (
        "Not Found In Repo",
        "bullets",
        [
            "Documented local Supabase bootstrap workflow or seed data.",
            "Demo credentials or sample accounts for trying the app quickly.",
        ],
    ),
]


@dataclass(frozen=True)
class StylePreset:
    title_size: float
    subtitle_size: float
    section_title_size: float
    body_size: float
    bullet_size: float
    paragraph_leading: float
    bullet_leading: float
    card_padding: float
    section_gap: float
    paragraph_gap: float


PRESETS = [
    StylePreset(23, 10.0, 12.4, 10.0, 9.7, 12.5, 11.9, 12, 14, 8),
    StylePreset(22, 9.6, 11.7, 9.4, 9.1, 11.8, 11.3, 11, 13, 7),
    StylePreset(21, 9.1, 11.1, 8.9, 8.6, 11.1, 10.7, 10, 12, 6),
]

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN_X = 34
MARGIN_TOP = 34
MARGIN_BOTTOM = 26
GUTTER = 16
HEADER_HEIGHT = 82
COLUMN_WIDTH = (PAGE_WIDTH - (2 * MARGIN_X) - GUTTER) / 2
CONTENT_TOP = PAGE_HEIGHT - MARGIN_TOP - HEADER_HEIGHT
CONTENT_BOTTOM = MARGIN_BOTTOM
CONTENT_HEIGHT = CONTENT_TOP - CONTENT_BOTTOM

INK = colors.HexColor("#1f2937")
MUTED = colors.HexColor("#5b6470")
ACCENT = colors.HexColor("#1f6b57")
ACCENT_SOFT = colors.HexColor("#dcefe8")
CARD_FILL = colors.HexColor("#fbfaf7")
CARD_STROKE = colors.HexColor("#ddd7cf")
RULE = colors.HexColor("#e8e2d8")
FOOTER = colors.HexColor("#6b7280")


def wrap_text(text: str, font_name: str, font_size: float, max_width: float) -> list[str]:
    words = text.split()
    if not words:
        return [""]

    lines: list[str] = []
    current = words[0]

    for word in words[1:]:
        candidate = f"{current} {word}"
        if stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word

    lines.append(current)
    return lines


def measure_section(section: tuple[str, str, list[str]], preset: StylePreset) -> float:
    title, kind, items = section
    del title

    text_width = COLUMN_WIDTH - (2 * preset.card_padding)
    total = preset.card_padding + preset.section_title_size + 6

    if kind == "paragraph":
        for index, paragraph in enumerate(items):
            lines = wrap_text(paragraph, "Helvetica", preset.body_size, text_width)
            total += len(lines) * preset.paragraph_leading
            if index < len(items) - 1:
                total += preset.paragraph_gap
    else:
        bullet_width = text_width - 12
        for bullet in items:
            lines = wrap_text(bullet, "Helvetica", preset.bullet_size, bullet_width)
            total += len(lines) * preset.bullet_leading
            total += 4

    total += preset.card_padding
    return total


def column_height(sections: list[tuple[str, str, list[str]]], preset: StylePreset) -> float:
    return sum(measure_section(section, preset) for section in sections) + preset.section_gap * (len(sections) - 1)


def choose_preset() -> StylePreset:
    for preset in PRESETS:
        if column_height(LEFT_COLUMN_SECTIONS, preset) <= CONTENT_HEIGHT and column_height(RIGHT_COLUMN_SECTIONS, preset) <= CONTENT_HEIGHT:
            return preset

    return PRESETS[-1]


def draw_section(
    pdf: canvas.Canvas,
    x: float,
    y_top: float,
    section: tuple[str, str, list[str]],
    preset: StylePreset,
) -> float:
    title, kind, items = section
    height = measure_section(section, preset)
    y_bottom = y_top - height

    pdf.setFillColor(CARD_FILL)
    pdf.setStrokeColor(CARD_STROKE)
    pdf.roundRect(x, y_bottom, COLUMN_WIDTH, height, 12, fill=1, stroke=1)

    text_x = x + preset.card_padding
    text_y = y_top - preset.card_padding

    pdf.setFillColor(ACCENT_SOFT)
    pdf.roundRect(text_x, text_y - 11, 50, 16, 8, fill=1, stroke=0)
    pdf.setFont("Helvetica-Bold", 7.6)
    pdf.setFillColor(ACCENT)
    pdf.drawString(text_x + 8, text_y - 6.2, "SECTION")

    text_y -= 22
    pdf.setFont("Helvetica-Bold", preset.section_title_size)
    pdf.setFillColor(INK)
    pdf.drawString(text_x, text_y, title)

    text_y -= 14
    pdf.setStrokeColor(RULE)
    pdf.line(text_x, text_y, x + COLUMN_WIDTH - preset.card_padding, text_y)
    text_y -= 10

    if kind == "paragraph":
        pdf.setFont("Helvetica", preset.body_size)
        pdf.setFillColor(MUTED)
        for index, paragraph in enumerate(items):
            lines = wrap_text(paragraph, "Helvetica", preset.body_size, COLUMN_WIDTH - (2 * preset.card_padding))
            for line in lines:
                pdf.drawString(text_x, text_y, line)
                text_y -= preset.paragraph_leading
            if index < len(items) - 1:
                text_y -= preset.paragraph_gap
    else:
        pdf.setFont("Helvetica", preset.bullet_size)
        pdf.setFillColor(MUTED)
        bullet_text_width = COLUMN_WIDTH - (2 * preset.card_padding) - 12
        for bullet in items:
            lines = wrap_text(bullet, "Helvetica", preset.bullet_size, bullet_text_width)
            for line_index, line in enumerate(lines):
                if line_index == 0:
                    pdf.setFillColor(ACCENT)
                    pdf.drawString(text_x, text_y, "-")
                    pdf.setFillColor(MUTED)
                    pdf.drawString(text_x + 10, text_y, line)
                else:
                    pdf.drawString(text_x + 10, text_y, line)
                text_y -= preset.bullet_leading
            text_y -= 4

    return y_bottom - preset.section_gap


def draw_header(pdf: canvas.Canvas, preset: StylePreset) -> None:
    pdf.setFillColor(colors.white)
    pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)

    pdf.setFillColor(colors.HexColor("#f1eee8"))
    pdf.roundRect(MARGIN_X, PAGE_HEIGHT - MARGIN_TOP - HEADER_HEIGHT + 8, PAGE_WIDTH - (2 * MARGIN_X), HEADER_HEIGHT - 8, 16, fill=1, stroke=0)

    pdf.setFillColor(ACCENT)
    pdf.roundRect(MARGIN_X + 16, PAGE_HEIGHT - MARGIN_TOP - 24, 84, 18, 9, fill=1, stroke=0)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 8.4)
    pdf.drawCentredString(MARGIN_X + 58, PAGE_HEIGHT - MARGIN_TOP - 18, "APP SUMMARY")

    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", preset.title_size)
    pdf.drawString(MARGIN_X + 16, PAGE_HEIGHT - MARGIN_TOP - 46, TITLE)

    subtitle_lines = wrap_text(
        SUBTITLE,
        "Helvetica",
        preset.subtitle_size,
        PAGE_WIDTH - (2 * MARGIN_X) - 32,
    )
    pdf.setFont("Helvetica", preset.subtitle_size)
    pdf.setFillColor(MUTED)
    subtitle_y = PAGE_HEIGHT - MARGIN_TOP - 61
    for line in subtitle_lines:
        pdf.drawString(MARGIN_X + 16, subtitle_y, line)
        subtitle_y -= 10.5


def draw_footer(pdf: canvas.Canvas) -> None:
    footer_text = "Generated on 2026-03-11 from repo evidence only."
    pdf.setFont("Helvetica", 7.2)
    pdf.setFillColor(FOOTER)
    pdf.drawRightString(PAGE_WIDTH - MARGIN_X, 18, footer_text)


def generate_pdf() -> Path:
    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW_PNG.parent.mkdir(parents=True, exist_ok=True)

    preset = choose_preset()
    pdf = canvas.Canvas(str(OUTPUT_PDF), pagesize=A4)
    pdf.setTitle("reitbeteiligung.app summary")
    pdf.setAuthor("OpenAI Codex")
    pdf.setSubject("Repo-backed one-page app summary")

    draw_header(pdf, preset)

    left_x = MARGIN_X
    right_x = MARGIN_X + COLUMN_WIDTH + GUTTER
    left_y = CONTENT_TOP
    right_y = CONTENT_TOP

    for section in LEFT_COLUMN_SECTIONS:
        left_y = draw_section(pdf, left_x, left_y, section, preset)

    for section in RIGHT_COLUMN_SECTIONS:
        right_y = draw_section(pdf, right_x, right_y, section, preset)

    draw_footer(pdf)
    pdf.showPage()
    pdf.save()

    reader = PdfReader(str(OUTPUT_PDF))
    if len(reader.pages) != 1:
        raise RuntimeError(f"Expected exactly 1 page, found {len(reader.pages)}.")

    return OUTPUT_PDF


def render_preview(pdf_path: Path) -> Path:
    doc = fitz.open(pdf_path)
    try:
        if doc.page_count != 1:
            raise RuntimeError(f"Expected exactly 1 page, found {doc.page_count}.")

        page = doc.load_page(0)
        pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        pixmap.save(PREVIEW_PNG)
    finally:
        doc.close()

    return PREVIEW_PNG


def main() -> None:
    pdf_path = generate_pdf()
    preview_path = render_preview(pdf_path)
    print(pdf_path)
    print(preview_path)


if __name__ == "__main__":
    main()
