# codex_context.md — reitbeteiligung.app (Marketing Website)

## Project
Public marketing website for reitbeteiligung.app
Goal: clean, fast, mobile-first landing page with light branding, background images, and clear CTA.

## Stack (assumptions)
- Static site (HTML/CSS/JS) OR lightweight framework (if already in repo).
- Deployed via FTP to a web server (no server-side rendering assumed).
- Must work without build complexity if possible.

## Design Constraints
- Performance: optimize images, avoid large JS bundles.
- Accessibility: good contrast, readable font sizes, keyboard-friendly.
- Mobile-first layout; responsive breakpoints for desktop.
- Keep UI calm: 1 primary accent color, consistent spacing, limited font weights.

## Assets / Images
Expected files (examples you requested previously):
- bg_hero_2400x1200.jpg (hero background)
- bg_section_2400x1600.jpg (section background)
- bg_card_1400x1400.jpg (card / feature visuals)
- pattern_tile_512.png (subtle repeating pattern)

Rules:
- Use modern formats when possible (WebP optional), but keep JPG/PNG fallbacks.
- Add CSS overlays (gradient) to ensure text readability on images.
- Prefer CSS background-image for hero/sections; <img> for content images with alt text.

## Page Structure (target)
- Hero: value proposition + short subtitle + primary CTA
- Benefits/Features: 3–6 cards
- How it works: simple 3-step section
- Trust/FAQ: minimal
- Footer: imprint/privacy links if applicable

## Content Style
- German copy (default), simple and factual, short sentences.
- Avoid marketing fluff; explain who it is for and what problem it solves.

## Implementation Expectations for Codex
- Keep changes localized; do not introduce heavy dependencies unless repo already uses them.
- Return FULL updated files (HTML/CSS/JS) and list added assets.
- If adding images, also update references and ensure paths work on plain FTP hosting.

## Quality Gates
- Lighthouse basics: fast load, correct meta tags, responsive, no console errors.
- No broken asset paths; test relative URLs.