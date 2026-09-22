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
| AppShell | Responsive page shell with desktop sidebar, mobile drawer, banner slot, and top bar | `Core/AppShell` |
| NavItem | Sidebar navigation button/link with icon, active state, and mobile auto-close | `Core/NavItem` |
| ThemeToggle | Ghost icon button toggling dark/light mode with sun/moon icon | `Core/ThemeToggle` |
| DemoBanner | Non-dismissible full-width disclaimer bar for prototype data | `Core/DemoBanner` |
| EmptyState | Centered empty or error placeholder with icon, title, description, and action | `Core/EmptyState` |
| Modal | Accessible Radix dialog with title, description, body scroll, and footer actions | `Core/Modal` |
| Tabs | Data-driven horizontal tabs with active indicator and mobile horizontal scroll | `Core/Tabs` |
| ToastProvider / useToast | Radix toast notification manager with tone icons (success, danger, neutral) | `Core/Toast` |
| DataTable | Generic TanStack Table with sortable headers, client pagination, desktop table and mobile stacked cards | `Core/DataTable` |
| Field | Form control wrapper with label, helper description, and error message | `Core/Field` |
| Input | Accessible text/numeric input with leading/trailing adornments wrapped in Field | `Core/Input` |
| Select | Native select dropdown with ChevronDown indicator wrapped in Field | `Core/Select` |
| Checkbox | Radix-based accessible checkbox with clickable label wrapped in Field | `Core/Checkbox` |
| Switch | Radix-based accessible toggle switch with clickable label wrapped in Field | `Core/Switch` |
| DateTimePicker | Native date/datetime-local picker displaying IST and storing UTC ISO | `Core/DateTimePicker` |
| CodeEditor | CodeMirror 6 Python editor (line numbers, wrap, history), token-themed, optional read-only | `Core/CodeEditor` |
| DescriptionList | Label/value `<dl>` rows, optional two columns from `md`, numeric values mono right-aligned | `Core/DescriptionList` |
| LoginForm | Centred sign-in card (username, password, error alert, submitting state, hint) | `Core/LoginForm` |

## ui-trading (built on ui-core)
| Component | Purpose | Story |
|---|---|---|
| PriceText | Formatted price from paise in mono tabular numbers, optional ₹ currency prefix | `Trading/PriceText` |
| PnLText | Signed Profit/Loss number with profit/loss color and optional percentage | `Trading/PnLText` |
| PnLCard | StatCard wrapping PnLText with label, caption, and loading skeleton | `Trading/PnLCard` |
| ChargesBreakdown | Card showing itemized regulatory and brokerage charges with total | `Trading/ChargesBreakdown` |
| Meter | Accessible progress bar with percentage thresholds (warning, danger) and custom labels | `Trading/Meter` |
| EquityCurve | Responsive Recharts line of backtest equity with optional dashed NIFTY 50 benchmark | `Trading/EquityCurve` |
| CandlestickChart | Lightweight Charts OHLC candles + volume, token colours re-read on theme switch, IST times | `Trading/CandlestickChart` |
| useThemeColors (hook) | Resolved theme CSS variables for canvas libraries; updates on `data-theme` change | — |
