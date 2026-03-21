# Design System Specification: Clinical Serenity

This document outlines the visual and structural language for the digital presence of Seetha Dental Lounge. Moving beyond the sterile, "off-the-shelf" medical template, this design system adopts a philosophy of **Clinical Serenity**. It balances the precision of medical science with the hospitality of a high-end lounge, utilizing tonal depth and editorial typography to create a sense of calm and effortless authority.

---

## 1. Creative North Star: "The Curated Sanctuary"
The "Curated Sanctuary" approach treats the user interface not as a software dashboard, but as a premium physical environment. We move away from the "boxy" nature of standard medical apps by using **intentional asymmetry**, **glass-morphism**, and **tonal layering**. The goal is to reduce "white-coat hypertension" through a UI that feels breathable, soft, and meticulously organized.

---

## 2. Color & Tonal Architecture
The palette is a sophisticated range of dental blues and architectural greys. The primary objective is to convey cleanliness without appearing "cold."

### The "No-Line" Rule
To achieve a premium, modern feel, **1px solid borders are prohibited for sectioning.** Structural boundaries must be defined exclusively through:
*   **Background Shifts:** Placing a `surface-container-low` component against a `surface` background.
*   **Tonal Transitions:** Using the hierarchy of `surface-container` tokens to define nested depth.

### Surface Hierarchy & Layering
Treat the UI as a series of stacked, semi-translucent materials. 
*   **Base:** `surface` (#f8f9fa) is the foundation.
*   **Content Areas:** Use `surface-container-low` (#f3f4f5) for large secondary zones.
*   **Actionable Cards:** Use `surface-container-lowest` (#ffffff) to make patient cards "pop" against the background without using shadows.

### The "Glass & Gradient" Rule
For hero sections or floating navigation, utilize **Glassmorphism**:
*   **Material:** `surface` at 70% opacity + `backdrop-blur: 20px`.
*   **Signature Textures:** For primary CTAs, use a subtle linear gradient from `primary` (#003f87) to `primary_container` (#0056b3) at a 135-degree angle to add "soul" and dimension.

---

## 3. Typography: Editorial Authority
We utilize a dual-font system to balance character with legibility.

*   **Display & Headlines (Manrope):** A geometric sans-serif with a modern, high-end feel. Used for patient names and clinic sections to provide a "boutique" editorial aesthetic.
*   **Body & Labels (Inter):** Chosen for its exceptional readability in clinical data contexts. It handles complex patient information and queue statuses with zero friction.

**Scale Philosophy:**
*   **Display-LG (3.5rem):** Reserved for welcome screens and key clinic metrics.
*   **Title-MD (1.125rem):** The workhorse for patient card headers.
*   **Label-SM (0.6875rem):** Used within status badges for maximum precision.

---

## 4. Elevation & Depth: Tonal Stacking
Traditional drop shadows are replaced by **Ambient Occlusion** and **Tonal Layering**.

*   **The Layering Principle:** Instead of shadows, achieve depth by stacking. Place a `surface-container-lowest` card inside a `surface-container` wrapper. The slight shift in hex value creates a "natural lift."
*   **Ambient Shadows:** If an element must float (e.g., a "Call Next Patient" FAB), use a hyper-diffused shadow: `box-shadow: 0 24px 48px rgba(0, 63, 135, 0.08)`. The tint is derived from the `primary` color, not black.
*   **The Ghost Border:** If a boundary is required for accessibility, use `outline_variant` at **15% opacity**. High-contrast lines are strictly forbidden.

---

## 5. Components & Interaction

### Status Badges (Queue Management)
High-contrast indicators that prioritize instant recognition. Badges use a "soft pill" shape (`rounded-full`) and high-chroma text on muted backgrounds.
*   **Waiting:** `secondary_container` background with `on_secondary_container` text.
*   **Called:** `tertiary_container` background with `on_tertiary_container` text (The "Active" attention-getter).
*   **Cancelled/Skipped:** `error_container` background with `on_error_container` text.

### Patient Information Cards
Cards are the core of this system. They must follow the **"No-Divider" Rule**:
*   **Separation:** Use `spacing-6` (1.5rem) of vertical white space or a slight background shift (`surface-container-high`) for headers instead of horizontal rules.
*   **Layout:** Information should be grouped in an asymmetrical 2/3 and 1/3 split on desktop to feel more like a medical chart and less like a database entry.

### Input Fields
*   **Style:** Minimalist. No bottom border; instead, use a subtle `surface-container-high` fill. 
*   **Focus State:** A 2px `primary` glow with a soft 4px blur, avoiding harsh outlines.

### Floating Action Buttons (FAB)
The "Next Patient" or "Add Record" actions should use the **Signature Texture** (gradient) to stand out as the most important interaction on the screen.

---

## 6. Do's and Don'ts

### Do
*   **Do** use `surface_container_highest` for "hover" states to provide tactile feedback.
*   **Do** prioritize whitespace over lines. If the layout feels messy, add more space, don't add more borders.
*   **Do** use `manrope` for any text larger than 1.5rem to maintain the "Lounge" brand identity.

### Don't
*   **Don't** use pure black (#000000) for text. Always use `on_surface` (#191c1d) to keep the contrast "medical-grade" but soft.
*   **Don't** use standard Material Design "Drop Shadows." They feel cheap in a premium clinical context.
*   **Don't** cram information. If a patient card has more than 8 fields, use a progressive disclosure pattern (e.g., "See More").

---

## 7. Accessibility & Motion
*   **Contrast:** All text combinations must pass WCAG AA standards. The `on_primary_fixed_variant` is specifically tuned for this.
*   **Motion:** Interactions should feel "liquid." Use `cubic-bezier(0.4, 0, 0.2, 1)` for all transitions—a slow, purposeful entrance that mimics the calm atmosphere of the Seetha Dental Lounge.