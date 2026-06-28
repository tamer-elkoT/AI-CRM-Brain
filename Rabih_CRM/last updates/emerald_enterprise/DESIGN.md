---
name: Emerald Enterprise
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#3d4947'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#6d7a77'
  outline-variant: '#bcc9c6'
  surface-tint: '#006a61'
  primary: '#00685f'
  on-primary: '#ffffff'
  primary-container: '#008378'
  on-primary-container: '#f4fffc'
  inverse-primary: '#6bd8cb'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#4648d4'
  on-tertiary: '#ffffff'
  tertiary-container: '#6063ee'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#89f5e7'
  primary-fixed-dim: '#6bd8cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#e1e0ff'
  tertiary-fixed-dim: '#c0c1ff'
  on-tertiary-fixed: '#07006c'
  on-tertiary-fixed-variant: '#2f2ebe'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-xl:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.1em
  arabic-body:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  container-max: 1440px
---

## Brand & Style

The visual identity of the design system is anchored in "Institutional Intelligence"—a blend of high-stakes enterprise reliability and cutting-edge AI-driven agility. It is designed to feel "expensive," professional, and authoritative, moving away from generic SaaS aesthetics toward a more refined, editorial look.

The style leverages **Modern Corporate** principles with a heavy emphasis on **Glassmorphism** for navigational layers to provide a sense of transparency and depth. The user experience should feel calm yet highly efficient, utilizing generous whitespace and a sophisticated "Emerald-on-Midnight" contrast to guide the user's eye toward critical CRM insights and AI-generated recommendations. 

The aesthetic is characterized by:
- **High-Fidelity Finishes:** Soft gradients, subtle inner borders, and high-quality iconography.
- **RTL-First Precision:** Layouts and typography are optimized for Arabic script, ensuring visual balance and readability for Middle Eastern enterprise contexts.

## Colors

The palette is dominated by **Deep Emerald Teal (#0D9488)**, used strategically for primary actions and success states to evoke growth and stability. **Midnight Blue (#0F172A)** provides the structural backbone, used for deep text, sidebars, and high-contrast navigation.

- **Primary Emerald:** High-impact engagement. Used for buttons, progress bars, and active states.
- **Midnight Navy:** The foundation. Used for core typography and sidebar backgrounds to create a "premium" feel.
- **Surface & Backgrounds:** We use a hierarchy of whites and cool grays (`#F8FAFC` for page backgrounds, `#FFFFFF` for cards).
- **Semantic Accents:** Tertiary Indigo (`#6366F1`) is reserved exclusively for AI features and automated recommendations to distinguish "machine-led" insights from user data.

## Typography

The design system utilizes **Geist** for its exceptional legibility in data-dense environments and its modern, technical character.

- **Visual Hierarchy:** Large, tight-tracked headlines in Midnight Blue create a strong sense of entry. 
- **Metadata Strategy:** `label-caps` is the workhorse for CRM metadata (e.g., Lead Status, Date Created). It must be tracked out at 10% to ensure readability and a high-end "architectural" feel.
- **Arabic Optimization:** For RTL contexts, line heights are increased by 20% compared to Latin equivalents to accommodate the verticality of Arabic characters without crowding the baseline.

## Layout & Spacing

This design system follows a **Fluid Grid** model based on a 12-column system for desktop.

- **The 4px Rule:** All spacing and sizing must be multiples of 4px to maintain mathematical harmony.
- **Generous Gaps:** Gutters are set to 24px to ensure that data-heavy CRM tables and cards do not feel claustrophobic.
- **RTL Reflow:** On RTL (Arabic) interfaces, the sidebar anchors to the right, and the 12-column flow reverses. AI recommendation panels should "slide-in" from the leading edge (the right in RTL, the left in LTR) to feel like a contextual layer rather than a fixed element.
- **Breakpoints:**
  - Mobile (< 768px): 4 columns, 16px margins.
  - Tablet (768px - 1024px): 8 columns, 24px margins.
  - Desktop (> 1024px): 12 columns, 40px margins.

## Elevation & Depth

Elevation is used sparingly to maintain a "flat but layered" premium aesthetic.

1.  **The Base:** Flat neutral background (`#F8FAFC`).
2.  **The Card Layer:** White surfaces (`#FFFFFF`) with a very soft, diffused shadow (`0 4px 6px -1px rgb(0 0 0 / 0.05)`).
3.  **The Glass Header:** Headers and top-level navigation utilize a 12px backdrop blur with 80% opacity white fill. This creates a sense of "lightness" as content scrolls beneath it.
4.  **The Interactive Lift:** Buttons and interactive cards transition to a slightly deeper shadow (`shadow-md`) on hover to provide tactile feedback without looking "gamey."
5.  **AI Insights:** These components use a subtle "inner glow" or a very thin 1px border in Tertiary Indigo to separate machine logic from standard user inputs.

## Shapes

The shape language is "Soft Professional." 

- **Standard Containers:** Use `rounded-xl` (12px) for most cards, input fields, and standard buttons.
- **Large Sections:** Use `rounded-2xl` (16px) for major dashboard widgets and modal containers.
- **Small Elements:** Tooltips and chips use a smaller 6px radius to maintain sharpness.
- **Pill Elements:** Use full-rounded (pill) shapes exclusively for "Status Labels" (e.g., Active, Pending) to differentiate them from functional buttons.

## Components

### Buttons
- **Primary:** Deep Emerald Teal background, white text, 12px corner radius. No border.
- **Secondary:** Midnight Blue outline (1px), transparent background.
- **Ghost:** No background or border; uses Teal text for actions.

### Input Fields
- White background with a 1px `Slate-200` border. On focus, the border transitions to Emerald Teal with a soft teal outer glow. Label text uses the `label-caps` style positioned above the field.

### AI Recommendation Cards
- These feature a 1px Tertiary Indigo border and a subtle Indigo-to-Transparent gradient background. Icons within these cards should be dual-tone using the Indigo palette.

### Data Tables
- Row headers in Midnight Blue Geist Bold.
- Alternating row highlights are not used; instead, we use thin `1px` horizontal dividers in `Slate-100`.
- On hover, the entire row should lift slightly with a subtle `shadow-sm`.

### Glass Header
- Fixed at the top. 80% opacity white with `backdrop-filter: blur(12px)`. A thin bottom border in `Slate-200` defines the edge.