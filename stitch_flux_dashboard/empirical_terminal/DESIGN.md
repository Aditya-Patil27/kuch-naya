# Design System: Empirical Darkness

## 1. Overview & Creative North Star
**Creative North Star: The Kinetic Observatory**
This design system is built to transform complex technical data into a high-end editorial experience. We are moving away from the "SaaS Dashboard" cliché. Instead, we treat the UI as a high-precision instrument—a "Kinetic Observatory." 

The aesthetic is defined by deep tonal immersion, intentional asymmetry, and the juxtaposition of human-centric headers (*Space Grotesk*) against machine-precise data (*JetBrains Mono*). We break the "template" look by using 3D isometric pipelines to visualize flow and "Ghost Borders" to define space. The layout should feel like a specialized terminal for an elite engineer: authoritative, silent, and incredibly sharp.

---

## 2. Colors: The Empirical Palette
We do not use blue. Our depth comes from the "Empirical Darkness" spectrum—a series of cooling charcoals and slates—punctured by high-frequency Cyan-Teal accents.

### Color Roles
- **Primary (`#dbfcff` / `#00f0ff`):** Used sparingly for "Live" states, critical data points, and primary CTAs. This is your "laser" color.
- **Surface & Background (`#10141a`):** The void. All data lives here.
- **Secondary (`#c6c6c7`):** Used for metadata and supporting technical text.

### The "No-Line" Rule
**Prohibit 1px solid borders for sectioning.** We do not draw boxes to contain content. Boundaries must be defined through background color shifts. Use `surface-container-low` for large section blocks sitting on the `surface` background. 

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers.
- **Base Layer:** `surface` (#10141a)
- **Content Blocks:** `surface-container-low` (#181c22)
- **Nested Cards:** `surface-container` (#1c2026)
- **Floating Overlays/Tooltips:** `surface-container-highest` (#31353c)

### The Glass & Gradient Rule
To achieve a "signature" feel, floating elements (like stage pipeline status cards) must use **Glassmorphism**. Apply `surface-container-high` at 60% opacity with a `20px` backdrop-blur. 
*Signature Texture:* For primary CTAs, use a linear gradient from `primary` (#dbfcff) to `primary_container` (#00f0ff) at a 135-degree angle.

---

## 3. Typography: Human vs. Machine
Our typography is a dialogue between the observer and the data.

- **Display & Headlines (Space Grotesk):** These are wide, geometric, and human. Use `display-lg` for hero metrics. The wide tracking and high x-height create an "Editorial Tech" feel.
- **Data & Monospace (JetBrains Mono):** All system outputs, timestamps, and pipeline IDs must use JetBrains Mono. This conveys raw technical accuracy.
- **Hierarchy of Intent:**
    - **Titles (`title-lg`):** Use for module names. Bold, high-contrast white.
    - **Labels (`label-sm`):** Use for technical attributes (e.g., "LATENCY"). Always uppercase with 0.05em letter spacing.

---

## 4. Elevation & Depth
In this system, light does not come from "above"—it radiates from the data itself.

- **The Layering Principle:** Depth is achieved by stacking. A `surface-container-lowest` card placed on a `surface-container-low` section creates a "recessed" look, making the data feel embedded in the machine.
- **Ambient Shadows:** Shadows are forbidden on standard cards. Only use them for floating modals. Use a `32px` blur, 8% opacity, tinted with the `surface_tint` (#00dbe9) to create a subtle cyan atmospheric glow.
- **The Ghost Border Fallback:** If a separator is required for accessibility, use the `outline-variant` token at 15% opacity. It should be felt, not seen.
- **Isometric Stages:** Use 3D isometric blocks for stage pipelines. These blocks should use a subtle gradient transition from `surface-container-highest` to `surface-container-low` to define their 3D faces without using lines.

---

## 5. Components

### Buttons
- **Primary:** Gradient background (`primary` to `primary_container`), `on_primary` text. No border. Roundedness: `sm`.
- **Secondary:** `surface-container-highest` background. A "Ghost Border" of `primary` at 20% opacity.
- **Tertiary:** Pure text (`JetBrains Mono`) with a `primary` underline that appears only on hover.

### 3D Pipeline Blocks (Signature Component)
- Isometric cubes representing stages. 
- **Active State:** Pulse glow using `primary_fixed_dim`. 
- **Connection:** Use "Ghost Lines" (0.5px width, 20% opacity) to connect blocks.

### Input Fields
- **Default:** `surface-container-lowest` background. No border. 
- **Focus:** A bottom-only border (2px) of `primary`.
- **Label:** `label-md` in `on_surface_variant`, positioned strictly above the field.

### Cards & Lists
- **Rule:** Absolute prohibition of divider lines. 
- **Separation:** Use `spacing-8` (2rem) of vertical white space or shift the background from `surface-container-low` to `surface-container`.

### Chips
- Use `md` roundedness. Background `surface-container-highest`. Text in `JetBrains Mono`.

---

## 6. Do's and Don'ts

### Do:
- **Do** use JetBrains Mono for anything that is "computed" (numbers, IDs, dates).
- **Do** use asymmetrical padding (e.g., more padding on the left of a container than the right) to create a sense of forward momentum.
- **Do** use `primary` sparingly. It should represent 5% or less of the total screen real estate.

### Don't:
- **Don't** use standard "drop shadows" (Black/Grey). They muddy the Empirical Darkness palette.
- **Don't** use blue. If a color feels "cool," ensure it is skewed toward Cyan/Teal.
- **Don't** use icons with rounded, bubbly corners. Use sharp, geometric, "technical" iconography with a 1.5px stroke.
- **Don't** center-align data. Data is always left-aligned or tabular for precision. Only display headlines should ever be centered.