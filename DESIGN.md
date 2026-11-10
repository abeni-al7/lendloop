# Design

LendLoop looks like a workshop **shadow board**: a painted board where every tool hangs on its own outline, so you
see at once what is home and what is out.

## Signature

- A tool that is home is a filled **enamel plate**.
- A tool out on loan is only a **dashed safety-yellow outline** of the same plate.
- A late tool's outline is **rust**. Only people in the loan and admins see it.

Keep this mapping everywhere a tool's state shows (board, tool page, admin). Don't add other meanings to dashed
yellow.

## Color

Defined as CSS variables in `src/app/globals.css` and exposed to Tailwind as `bg-board`, `text-paint`, and so on.

| Token | Hex | Job |
| --- | --- | --- |
| `board` | `#1f3529` | Page ground, the painted board |
| `board-raised` | `#29432f` | Raised panels on the board |
| `board-line` | `#3b5a45` | Rules and quiet outlines on the board |
| `peg` | `#172a20` | Peg holes (`.pegboard` background) |
| `paint` | `#f2c230` | The one accent: primary actions, active nav, "out on loan" |
| `enamel` | `#eceee7` | Plates and work panels (forms, lists) |
| `ink` / `ink-soft` | `#17221b` / `#4a5a4f` | Text on enamel |
| `on-board` / `on-board-soft` | `#eef1ea` / `#a9bcaf` | Text on the board |
| `rust` / `rust-ink` | `#e2683f` / `#a8391a` | Late, errors, destructive actions (rust on board, rust-ink on enamel) |
| `leaf` | `#2f7d4a` | "Home", approved, trusted lender |

Flat paint only: no gradients, glows or glass. Shadows are not used.

## Type

One family: **Archivo** (variable, with a width axis), loaded with `next/font`.

- Display (`.display`): extra bold, width 118, tracking -0.02em. Page titles and the wordmark only.
- Headings: bold, normal width. Body: 15 to 18px regular. Numbers are tabular everywhere.
- Sentence case. No all-caps labels, no eyebrows above headings.

## Components

- **Plates** (`src/components/board.tsx`): 8px radius, 16px padding, icon top left, ref code top right, name and
  owner at the bottom.
- **Tool icons** (`src/components/tool-icon.tsx`): authored silhouettes, 48px grid, 2.5px round stroke. One per
  category.
- **Lists on enamel** (`src/components/loan-list.tsx`): one enamel panel, rows split by 1px `enamel-line` rules. Not
  separate cards.
- **Status chips**: filled pill. Paint = waiting, leaf = approved / out now, rust-ink = overdue, outline = past.
- **Buttons** (`src/components/ui.tsx`): `primary` (board green on enamel), `paint` (on the board), `outline`,
  `danger`. 44px tall, 6px radius.
- Standard controls only: native date inputs, selects, checkboxes with `role="switch"`, real tabs.

## Layout

Top bar with nav; on phones the nav becomes a scrolling row under the bar. Content max width 72 to 80rem with 16px
(phone) / 32px gutters. The board grid fills columns of at least 10.5rem, so phones get two plates per row.

## Motion

Almost none. Plates lift 2px on hover. Loading states are empty dashed outlines, the same shape as the plates.
`prefers-reduced-motion` turns transitions off.
