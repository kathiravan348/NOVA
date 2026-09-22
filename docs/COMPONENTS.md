# NOVA UI — Components index

> One line per component. Check here before creating anything new. Update in the same task.

## ui-core (generic)
| Component | Purpose | Story |
|---|---|---|
| Button | Action button with variants (primary, secondary, ghost, danger), sizes (sm, md, lg), loading spinner, and asChild | `Core/Button` |
| IconButton | Square button with required aria-label, taking an icon with Button variants | `Core/IconButton` |
| Badge | Inline label with tone variants (neutral, info, success, warning, danger) in text-label | `Core/Badge` |
| StatusBadge | Pill badge with an aria-hidden leading dot and text label | `Core/StatusBadge` |
| Card | Container panel with optional heading title, actions bar, footer, and body | `Core/Card` |
| StatCard | Metric card with uppercase label, mono number-lg value, caption tones, and loading skeleton | `Core/StatCard` |
| Skeleton | Animated pulse block with aria-hidden for loading states | `Core/Skeleton` |

## ui-trading (built on ui-core)
| Component | Purpose | Story |
|---|---|---|
| PriceText | Formatted price from paise in mono tabular numbers, optional ₹ currency prefix | `Trading/PriceText` |
| PnLText | Signed Profit/Loss number with profit/loss color and optional percentage | `Trading/PnLText` |
| PnLCard | StatCard wrapping PnLText with label, caption, and loading skeleton | `Trading/PnLCard` |
| ChargesBreakdown | Card showing itemized regulatory and brokerage charges with total | `Trading/ChargesBreakdown` |
| Meter | Accessible progress bar with percentage thresholds (warning, danger) and custom labels | `Trading/Meter` |
