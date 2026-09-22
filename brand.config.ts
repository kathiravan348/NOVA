/**
 * Single source of truth for all brand names.
 * Renaming the platform = change this file only.
 */
export const brand = {
  name: "NOVA",
  expansion: "Networked Order & Value Analytics",
  tagline: "Rules that shine.",
  products: {
    orbit: { name: "NOVA Orbit", short: "Orbit", description: "Strategy builder and backtesting" },
    relay: { name: "NOVA Relay", short: "Relay", description: "Broker API configuration and limits" },
    core: { name: "NOVA Core", short: "Core", description: "Backend core services" },
    atlas: { name: "NOVA Atlas", short: "Atlas", description: "Market data and archive" },
    ledger: { name: "NOVA Ledger", short: "Ledger", description: "Fees and tax engine" },
    ui: { name: "NOVA UI", short: "UI", description: "Shared component library" },
    style: { name: "NOVA Style", short: "Style", description: "Design system and theme tokens" },
    // Future phases
    launch: { name: "NOVA Launch", short: "Launch", description: "Orders and live trading" },
    beacon: { name: "NOVA Beacon", short: "Beacon", description: "Alerts and monitoring" },
    pulse: { name: "NOVA Pulse", short: "Pulse", description: "News and insights" },
    constellation: { name: "NOVA Constellation", short: "Constellation", description: "Portfolio across all assets" },
  },
} as const;

export type ProductKey = keyof typeof brand.products;
