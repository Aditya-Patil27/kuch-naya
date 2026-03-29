# Design System: The Empirical Command

## 1. Overview & Creative North Star
The North Star for this design system is **"The Kinetic Terminal."** This is not a standard SaaS dashboard; it is a high-stakes SRE Command Center. It represents a shift from "software as a tool" to "software as an instrument." 

To break the "template" look, we move away from soft rounded corners and generic grids. We embrace **Organic Brutalism**: a philosophy where the interface is rigid, sharp (`0px` radius), and authoritative, yet feels alive through glassmorphism and light-emitting accents. By using intentional asymmetry—such as technical metadata labels offset from primary headers—we create a layout that feels engineered rather than merely "designed."

---

## 2. Colors: The Obsidian Spectrum
Our palette is rooted in "Empirical Darkness." We use deep, light-absorbing base tones to make our high-contrast "Electric" accents feel like they are emitting actual light.

### The "No-Line" Rule
**Prohibit 1px solid borders for general sectioning.** In this system, space is defined by mass, not lines. Sections must be separated by shifts in surface depth (e.g., a `surface-container-low` panel residing on a `background` floor). 

### Surface Hierarchy & Nesting
Treat the UI as a series of physical, stacked layers—like server blades or glass slides.
*   **Base Floor:** `surface` (#080f16) - The global background.
*   **Recessed Zones:** `surface-container-lowest` (#000000) - Use for code blocks or terminal inputs to suggest an "infinite" depth.
*   **Elevated Panels:** `surface-container-high` (#18202a) - Primary workspace areas.
*   **Active Overlays:** `surface-bright` (#232d38) - Used for focused states.

### The "Glass & Glow" Rule
For floating elements (modals, tooltips), use **Glassmorphism**. Apply a semi-transparent `surface-variant` with a `backdrop-filter: blur(12px)`. To provide the "SRE" polish, use a **1px Sharp Border Glow**: a 1px border using `primary` or `outline-variant` at 20% opacity to simulate light catching the edge of a glass pane.

---

## 3. Typography: The Technical Ledger
We use a dual-font strategy to distinguish between the "Interface Skin" and the "Data Pulse."

*   **Space Grotesk (Headings & UI):** This is our authoritative voice. Its idiosyncratic letterforms provide a "boutique" technical feel. Use `display-lg` for high-impact chaos metrics, ensuring the tracking is slightly tight (-2%) to feel dense and intentional.
*   **JetBrains Mono (Metrics & Technical Data):** All numerical data, logs, and AI-generated code must use JetBrains Mono. This conveys precision and raw transparency.

**Editorial Tip:** Use `label-sm` in JetBrains Mono for all-caps "micro-copy" above headlines to act as a technical breadcrumb (e.g., `STATUS // STABLE`).

---

## 4. Elevation & Depth: Tonal Layering
We do not use shadows to create "softness"; we use them to create **mechanical separation.**

*   **The Layering Principle:** Depth is achieved by "stacking." A `surface-container-highest` card should be placed on a `surface-container-low` background. This creates a clear hierarchy without visual clutter.
*   **Ambient Shadows:** For floating isometric blocks, use a "Hard Ambient" shadow. Set blur to `24px`, spread to `-4px`, and use a color derived from `on-surface` at `8%` opacity. This mimics a high-end darkroom environment.
*   **The Ghost Border:** If containment is required for accessibility, use a "Ghost Border": the `outline-variant` token at `15%` opacity. Forbid 100% opaque borders—they break the immersion of the Obsidian Spectrum.

---

## 5. Components: Engineered Primitives

### Buttons (The Isometric Trigger)
*   **Primary:** Background `primary` (#8ff5ff), Text `on-primary`. Sharp `0px` corners. On hover, apply a `primary-container` box-shadow with `0px` blur to simulate a 3D "lift."
*   **Secondary:** Ghost style. `0px` radius, `outline` border at 30%, Text `primary`.

### Input Fields (The Terminal Slot)
*   **Style:** `surface-container-lowest` background. No borders on three sides; only a 2px `primary` bottom-bar that glows when focused. 
*   **Text:** `body-md` in JetBrains Mono.

### Status Chips (The Health Ledger)
*   **Pass:** `primary` (#8ff5ff) text with a 1px `primary` border at 20% opacity. 
*   **Chaos:** `tertiary-container` (#ff084d) background with `on-tertiary` text. These should look like "Warning Lights" in a cockpit.

### Cards & Lists (The Blade View)
*   **Rule:** Forbid divider lines. Separate list items using the Spacing Scale (e.g., `1.5` / `0.3rem`) and subtle background alternating between `surface-container-low` and `surface-container-high`.
*   **Isometric Influence:** For data visualizations, use subtle 3D transforms (e.g., `rotateX(10deg) rotateZ(-5deg)`) to make cards feel like physical modules in a rack.

---

## 6. Do's and Don'ts

### Do
*   **Do** use `0px` border-radius for everything. Sharpness equals authority.
*   **Do** use asymmetrical spacing. Align technical data to a different vertical axis than body text to create an editorial, "non-template" feel.
*   **Do** use `JetBrains Mono` for any value that can be measured or calculated.
*   **Do** leverage transparency. Let background textures or grid patterns bleed through glassmorphic layers.

### Don't
*   **Don't** use generic CSS gradients. If a gradient is needed, it must be a "Functional Glow" (e.g., `primary` to `transparent`).
*   **Don't** use standard drop shadows with high opacity. They look "cheap" in a dark UI.
*   **Don't** use 1px solid white borders. They create too much visual noise and distract from the data.
*   **Don't** use rounded corners (`>0px`). This is a rigid, empirical system. Softness is the enemy of the SRE vibe.