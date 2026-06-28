---
name: Cognitive Enterprise
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#271901'
  on-tertiary-container: '#98805d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
  mono-data:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  max-width: 1440px
---

## Brand & Style

The design system is engineered for a B2B SaaS environment where high-density information meets intelligent automation. The brand personality is authoritative yet visionary—blending the institutional reliability of traditional CRM systems with the frictionless, forward-leaning aesthetic of modern AI. 

The visual style is **Corporate / Modern** with a focus on precision and clarity. It prioritizes data-readability and structural integrity, using subtle depth markers to organize complex workflows. The interface should feel "intelligent," responding to user actions with intentionality and providing clear visual hierarchies for automated insights.

## Colors

The palette is anchored in **Deep Slate Blue** (#0F172A) to project stability and "Enterprise Grade" security. **Teal** (#0D9488) serves as the primary action and AI-indicator color, bridging the gap between professional blue and vibrant green.

Semantic colors are strictly regulated for data interpretation:
- **Emerald Green**: Used exclusively for positive deltas, won deals, and success states.
- **Rose Red**: Reserved for lost deals, negative performance trends, and destructive actions.
- **Amber**: Utilized for medium-priority alerts and stalling leads.

Neutral scales use cool grays to maintain a crisp, modern feel without becoming "muddy" on high-density screens.

## Typography

This design system utilizes **Geist** for headlines and labels to provide a technical, modern edge, while **Inter** handles body copy for maximum legibility in data-heavy contexts.

**RTL Support:** For Arabic localization, font-weights should be decreased by one step (e.g., 600 becomes 500) to maintain visual balance. Line heights for Arabic text must be increased by 20% to accommodate diacritics and script height.

**Data Display:** Use the `mono-data` token for ID numbers, currency values in tables, and AI confidence scores to ensure vertical alignment in lists.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid** model. Navigation and sidebars are fixed-width to ensure tool accessibility, while the main content area is fluid with a maximum container width of 1440px.

A strict **4px baseline grid** governs all spacing. 
- **High-Density View**: Use 8px (2 units) for internal component padding and 12px for list item gaps.
- **Standard View**: Use 16px (4 units) for general gutters and 24px for card margins.

**RTL Layout**: The entire grid must mirror across the Y-axis. The primary navigation moves to the right, and the "direction of progress" in charts or workflows flows right-to-left.

## Elevation & Depth

Visual hierarchy is established through **Tonal Layering** and **Low-Contrast Outlines**. 

- **Level 0 (Background)**: Solid `#F8FAFC`.
- **Level 1 (Cards/Tables)**: White background with a 1px border (`#E2E8F0`) and a very soft, diffused shadow (0px 2px 4px rgba(15, 23, 42, 0.05)).
- **Level 2 (Dropdowns/Modals)**: White background with a more pronounced shadow (0px 10px 15px rgba(15, 23, 42, 0.1)) to indicate a physical lift.
- **Side Drawers**: Use a Backdrop Blur (8px) on the obscured content to maintain context while focusing on the detail view.

## Shapes

The design system uses a **Soft (0.25rem)** rounding philosophy. This provides a professional appearance that feels approachable without being overly "bubbly" or consumer-grade.

- **Small Components**: Checkboxes, small buttons, and tags use `0.25rem`.
- **Containers**: Metric cards and data tables use `0.5rem` (rounded-lg).
- **Interactive Elements**: Inputs and primary buttons use `0.375rem` to distinguish them from static labels.

## Components

### High-Density Data Tables
Columns should have adjustable widths with a minimum padding of 12px. The header row uses a subtle gray fill (`#F1F5F9`) and `label-sm` typography. Row hovering must trigger a background color shift to `#F8FAFC`.

### Metric Cards & Delta Indicators
Cards must feature a primary value (`headline-md`) and a secondary delta indicator. Deltas use a "Pill" background with 10% opacity of the semantic color (e.g., Emerald at 10% for positive) and include a directional icon.

### Progress Bars
Scores are visualized using 4px tall bars. Use a "Track" color of `#E2E8F0` and a "Fill" color of the Primary Teal. For AI confidence scores, use a gradient from Secondary to Primary.

### Side Drawers
Drawers slide in from the right (left in RTL) and occupy 400px–600px. They must include a "Pinned" header with the primary action button and a "Close" affordance at the top outer corner.

### Input Fields
Inputs use a 1px border. On focus, the border transitions to Primary Teal with a 2px outer glow of the same color at 20% opacity.