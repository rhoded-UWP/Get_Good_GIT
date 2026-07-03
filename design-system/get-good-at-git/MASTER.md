# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Get Good at GIT
**Generated:** 2026-07-02 09:14:15
**Category:** Developer Tool / IDE

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#0F172A` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#1E293B` | `--color-secondary` |
| Accent/CTA | `#22C55E` | `--color-accent` |
| Background | `#020617` | `--color-background` |
| Foreground | `#F8FAFC` | `--color-foreground` |
| Muted | `#1A1E2F` | `--color-muted` |
| Border | `#334155` | `--color-border` |
| Destructive | `#EF4444` | `--color-destructive` |
| Ring | `#0F172A` | `--color-ring` |

**Color Notes:** Terminal dark + success green

### Typography

> **Spec-mandated** (github-simulator-spec.md overrides the generator's suggestion):

- **UI Chrome Font (headings, tabs, instructions):** Outfit
- **Terminal / Code Font (all commands, terminal output, file names, hashes):** JetBrains Mono
- **Mood:** technical, focused, developer-native — students should feel like they're in VS Code's integrated terminal
- **Google Fonts:** [Outfit + JetBrains Mono](https://fonts.google.com/share?selection.family=Outfit:wght@400;500;600;700|JetBrains+Mono:wght@400;500;700)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
```

**Rules:**
- Anything a student could type or Git could print is JetBrains Mono — no exceptions.
- Base terminal font size 14–15px with `line-height: 1.5`; UI body text ≥16px.
- Use tabular figures / monospace for commit hashes and file lists to prevent layout shift.

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #22C55E;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #0F172A;
  border: 2px solid #0F172A;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #020617;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs (dark theme — corrected from generator's light-mode values)

```css
.input {
  padding: 12px 16px;
  background: #0F172A;
  color: #F8FAFC;
  border: 1px solid #334155;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #22C55E;
  outline: none;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.25);
}
```

### Modals (dark theme — corrected from generator's light-mode values)

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.modal {
  background: #0F172A;
  color: #F8FAFC;
  border: 1px solid #334155;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

### Terminal (project-specific component)

```css
.terminal {
  background: #020617;
  color: #F8FAFC;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
  border: 1px solid #334155;
  border-radius: 8px;
}

.terminal__prompt { color: #22C55E; }   /* user@machine:path$ */
.terminal__branch { color: #38BDF8; }   /* branch name in prompt */
.terminal__error  { color: #EF4444; }   /* fatal:/error: output */
.terminal__hint   { color: #94A3B8; }   /* hints, muted output */
```

**Git-semantic status colors** (match real `git status` terminal colors so recognition transfers):
- Untracked / modified-unstaged files: `#EF4444` (red)
- Staged files: `#22C55E` (green)
- Branch names / refs: `#38BDF8` (cyan-blue)
- Skill checkpoint complete: `#22C55E` with SVG check icon (never color alone — pair with icon + text)

---

## Style Guidelines

**Style:** Dark Mode (OLED)

**Keywords:** Dark theme, low light, high contrast, deep black, midnight blue, eye-friendly, OLED, night mode, power efficient

**Best For:** Night-mode apps, coding platforms, entertainment, eye-strain prevention, OLED devices, low-light

**Key Effects:** Minimal glow (text-shadow: 0 0 10px), dark-to-light transitions, low white emission, high readability, visible focus

### Page Pattern

**Pattern Name:** Minimal + Documentation

- **CTA Placement:** Above fold
- **Section Order:** Hero > Features > CTA

---

## Anti-Patterns (Do NOT Use)

- ❌ Light mode default
- ❌ Slow performance

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Dark mode: text contrast 4.5:1 minimum (verify against `#020617`/`#0F172A` surfaces)
- [ ] Focus states visible for keyboard navigation (tabs and terminal input especially)
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile

---

## Project Hard Constraints (from github-simulator-spec.md)

These override anything above if they ever conflict:

- **BEM class naming** throughout the stylesheet.
- **Static files only** — servable from GitHub Pages, relative paths only, no build step required.
- **Embeddable in Canvas LMS via sandboxed `<iframe>`** — no `localStorage`/`sessionStorage` for core functionality; all state lives in JS memory. Preference persistence (font size, theme) goes through a try/catch storage wrapper that falls back to in-memory when sandboxed. Design for a constrained viewport (assume ~800×600 minimum inside Canvas), not just full-screen desktop.
- **Dark theme is the default.** Per teacher request (2026-07) a light mode exists, toggled via `data-theme="light"` on `<html>` from the control bar, defaulting to `prefers-color-scheme`. Light tokens use darker accent variants (green `#15803d`, red `#b91c1c`, blue `#0369a1`) to hold 4.5:1 contrast; the terminal switches to a VS Code Light+ palette.
- **Vanilla JS preferred**; any library must be CDN `<script>` or vendored static file.
- **Terminal realism first**: prompt line, upward-scrolling history, input at bottom, arrow-key command history. Realistic Git output/error text takes priority over decorative styling.
