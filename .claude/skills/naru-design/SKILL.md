---
name: naru-design
description: Naru/HumbleVillage UI design system and patterns. Use when creating or modifying frontend pages, components, or any UI work to ensure visual consistency.
---

# Naru Design System

All UI uses Tailwind CSS utility classes only. No CSS modules, styled-components, or inline styles. The custom color palette is defined in `packages/web/tailwind.config.ts`.

## Design Philosophy

This UI should be  **warm, earthy, and human** — not corporate tech. It reflects the mission in rural Guatemala through an artisanal, grounded aesthetic. High contrast blacks against creamy off-whites keep it readable but soft.

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `hv-green` | #2f4f39 | Primary brand — headings, primary buttons, links, nav bg |
| `hv-green-hover` | #3d6b4a | Hover state for primary elements |
| `hv-accent` | #637dff | Focus rings, badges, secondary highlights |
| `hv-crisis` | #c0392b | Crisis/danger indicators, destructive actions |
| `hv-gray` | #646464 | Body text, labels, secondary text |
| `hv-page` | #faf7f2 | Page background (off-white/beige — maps to ~`#F5F2E9`) |
| `hv-card` | #ffffff | Card/surface background |
| `hv-border` | #e0e0e0 | Card borders, dividers |
| `hv-border-input` | #dbdad9 | Form input borders |
| `hv-charcoal` | #1A1A1A | Deep charcoal — primary text and headings |
| `hv-sage` | #7A8B76 | Muted sage — secondary accents and natural elements |
| `hv-terracotta` | #C27D5F | Terracotta — call-to-action highlights and warm tones |

## Page Layout

- Page background: `min-h-screen bg-hv-page`
- Content container: `max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8`
- Page title: `text-2xl font-bold text-hv-green mb-6`
- Section title: `text-lg font-semibold text-hv-green`

## Cards

```
bg-white p-6 rounded-lg border border-hv-border shadow-sm
```

Clickable cards add: `hover:border-hv-accent transition-colors`

## Buttons

- **Primary**: `bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover transition-colors disabled:opacity-50`
- **Secondary**: `bg-hv-gray text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors`
- **Danger**: `bg-hv-crisis text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors`
- **Link**: `text-hv-accent hover:text-hv-green transition-colors`
- **Disabled**: always add `disabled:opacity-50 disabled:cursor-not-allowed`
- **Loading text**: `{isLoading ? 'Saving...' : 'Save'}`

## Forms

**Labels**: `block text-sm font-medium text-hv-gray mb-1`
Required fields add: `<span className="text-red-500">*</span>`

**Text inputs**:
```
w-full px-3 py-2 border border-hv-border-input rounded-md
focus:outline-none focus:ring-2 focus:ring-hv-accent
```

**Error state on inputs**: replace border with `border-red-500 bg-red-50`

**Error messages**: `text-red-500 text-sm mt-1`

**Top-level form errors**:
```
bg-red-50 border border-red-200 rounded-md p-4
  <p className="text-red-600">{error}</p>
```

**Form spacing**: `space-y-4` or `space-y-6` between field groups

**Select/dropdown**: same classes as text inputs

**Checkbox**: `rounded border-hv-border-input text-hv-accent focus:ring-hv-accent`

**Multi-select (checkbox grid)**:
```
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2
max-h-48 overflow-y-auto border border-hv-border-input rounded-md p-3
```

## Tables

- **Wrapper**: `overflow-x-auto`
- **Table**: `min-w-full divide-y divide-hv-border`
- **Header row**: `bg-hv-page`
- **Header cells**: `text-left text-xs font-medium text-hv-gray uppercase tracking-wider px-6 py-3`
- **Body rows**: `divide-y divide-hv-border hover:bg-hv-page`
- **Body cells**: `px-6 py-4`

## Lists

```
<div className="space-y-3">
  <div className="border border-hv-border p-3 rounded">
    <Link className="font-medium text-hv-green hover:text-hv-green-hover">{name}</Link>
    <p className="text-sm text-hv-gray">{metadata}</p>
  </div>
</div>
```

## Navigation

- Nav bar: `bg-hv-green shadow-lg h-16` with `text-white`
- Nav links: `text-white hover:text-gray-300 transition-colors`
- Back links: `text-hv-green hover:text-hv-green-hover transition-colors` with `←` prefix

## Dashboard Stats ("Impact" Grid)

```
grid grid-cols-2 md:grid-cols-4 gap-4
```
Each stat card uses **no borders** — generous whitespace makes the numbers pop:
```
bg-white p-8 rounded-lg
  <div className="text-4xl font-bold text-hv-green">{value}</div>
  <div className="text-sm text-hv-gray mt-1">{label}</div>
```
- Use `p-8` or more. The whitespace IS the design.
- No card borders on stat grids.
- Crisis stats use `text-hv-crisis` instead of `text-hv-green`.

## Badges

- Z-score/status: `inline-flex items-center px-3 py-1 rounded-full text-sm font-medium`
  - Severe: `bg-red-600 text-white`
  - Moderate: `bg-red-400 text-white`
  - Mild: `bg-yellow-500 text-white`
  - Normal: `bg-green-500 text-white`
  - Above: `bg-blue-500 text-white`
  - High: `bg-purple-500 text-white`
- Category label: `px-2 py-1 bg-hv-accent text-white rounded-full text-xs`

## States

- **Loading**: `<div className="text-lg text-hv-gray">Loading...</div>`
- **Empty**: `<p className="text-hv-gray text-center">No items found</p>`
- **Error**: red banner (see form errors above)

## Responsive Patterns

- Grid breakpoints: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Hide on mobile: `hidden md:flex`
- Container widths: `max-w-md` (forms), `max-w-lg`, `max-w-7xl` (page)

## Spacing Conventions

- Card padding: `p-6`
- Input padding: `px-3 py-2`
- Page title margin: `mb-6`
- Section gaps: `gap-4`, `gap-6`
- List item gaps: `space-y-2`, `space-y-3`
- Form field gaps: `space-y-4`, `space-y-6`

## Typography

The type scale is bold and intentional — editorial, not corporate.

- **H1/H2 headings**: Large, bold serif (Playfair Display or similar). `text-3xl font-bold` — authoritative and editorial.
- **Body text**: Clean sans-serif (Montserrat or Open Sans). Readable in dense blocks.
- **Accent / mission text**: Italicized serif for sub-headers and mission statements — personal, quote-like feel.

Tailwind classes:
- Page title: `text-2xl font-bold`
- Section title: `text-lg font-semibold`
- Accent/sub-header: `text-base italic`
- Labels: `text-sm font-medium`
- Body: default size
- Small/meta: `text-sm`
- Table headers: `text-xs uppercase tracking-wider`
