import type { Meta, StoryObj } from "@storybook/react-vite";
import tokens from "../../../ui-core/src/theme/tokens.json";

const meta: Meta = {
  title: "Foundations/Tokens",
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj;

const TYPE_CLASSES: Record<string, string> = {
  display: "text-display font-sans",
  "page-title": "text-page-title font-sans",
  "section-title": "text-section-title font-sans",
  "card-title": "text-card-title font-sans",
  body: "text-body font-sans",
  "body-sm": "text-body-sm font-sans",
  label: "text-label font-sans uppercase",
  "number-lg": "text-number-lg font-mono",
  number: "text-number font-mono",
  "number-sm": "text-number-sm font-mono",
};

export const Colors: Story = {
  render: () => (
    <div className="w-full max-w-full">
      <h1 className="text-page-title font-semibold text-text-primary mb-space-2">
        Colors
      </h1>
      <p className="text-body text-text-muted mb-space-6">
        Theme color tokens defined for dark and light modes.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-space-4 w-full">
        {tokens.color.tokens.map((token) => (
          <div
            key={token.name}
            className="flex flex-col rounded-lg border border-border-default bg-bg-surface p-space-4 overflow-hidden"
          >
            <div
              className="h-16 w-full rounded-md border border-border-default mb-space-3"
              style={{ background: `var(--${token.name})` }}
              aria-hidden="true"
            />
            <div className="font-mono text-body font-medium text-text-primary break-words">
              {token.name}
            </div>
            <p className="text-body-sm text-text-muted mt-space-1 leading-normal">
              {token.usage}
            </p>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const Typography: Story = {
  render: () => (
    <div className="w-full max-w-full">
      <h1 className="text-page-title font-semibold text-text-primary mb-space-2">
        Typography
      </h1>
      <p className="text-body text-text-muted mb-space-6">
        Type scales and styles for text (IBM Plex Sans) and numbers (IBM Plex Mono).
      </p>

      <div className="flex flex-col gap-space-6 w-full">
        {tokens.type.groups.map((group) => (
          <section key={group.name} className="flex flex-col gap-space-4">
            <h2 className="text-section-title font-semibold text-text-primary">
              {group.name} ({group.family})
            </h2>

            <div className="flex flex-col gap-space-4">
              {group.styles.map((style) => {
                const typeClass =
                  TYPE_CLASSES[style.name] ??
                  (group.family === "mono"
                    ? "font-mono text-body"
                    : "font-sans text-body");

                return (
                  <div
                    key={style.name}
                    className="rounded-lg border border-border-default bg-bg-surface p-space-4 overflow-hidden"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-space-2 mb-space-2">
                      <div className="font-mono text-body font-medium text-text-primary">
                        {style.name}
                      </div>
                      <div className="font-mono text-body-sm text-text-secondary">
                        {style.fontSize} / {style.lineHeight} / {style.fontWeight}
                      </div>
                    </div>

                    <p className="text-body-sm text-text-muted mb-space-3">
                      {style.usage}
                    </p>

                    <div className="rounded-md border border-border-default bg-bg-raised p-space-4 overflow-x-auto">
                      <p className={`${typeClass} text-text-primary`}>
                        {style.sample}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  ),
};

export const Spacing: Story = {
  render: () => (
    <div className="w-full max-w-full">
      <h1 className="text-page-title font-semibold text-text-primary mb-space-2">
        Spacing
      </h1>
      <p className="text-body text-text-muted mb-space-6">
        Consistent spacing scale for margins, padding, and gaps.
      </p>

      <div className="flex flex-col gap-space-3 w-full">
        {tokens.spacing.tokens.map((token) => (
          <div
            key={token.name}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-3 rounded-lg border border-border-default bg-bg-surface p-space-4"
          >
            <div className="min-w-48">
              <div className="flex items-baseline gap-space-2">
                <span className="font-mono text-body font-medium text-text-primary">
                  {token.name}
                </span>
                <span className="font-mono text-body-sm text-text-secondary">
                  {token.value}
                </span>
              </div>
              <p className="text-body-sm text-text-muted mt-space-1">
                {token.usage}
              </p>
            </div>

            <div className="flex items-center">
              <div
                className="h-6 rounded-xs bg-action min-w-1"
                style={{ width: `var(--${token.name})` }}
                aria-hidden="true"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const Radius: Story = {
  render: () => (
    <div className="w-full max-w-full">
      <h1 className="text-page-title font-semibold text-text-primary mb-space-2">
        Radius
      </h1>
      <p className="text-body text-text-muted mb-space-6">
        Border radius tokens for cards, controls, and badges.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-space-4 w-full">
        {tokens.radius.tokens.map((token) => (
          <div
            key={token.name}
            className="flex flex-col rounded-lg border border-border-default bg-bg-surface p-space-4 overflow-hidden"
          >
            <div
              className="h-20 w-full border-2 border-border-strong bg-bg-raised mb-space-3 flex items-center justify-center"
              style={{ borderRadius: `var(--${token.name})` }}
              aria-hidden="true"
            />
            <div className="flex items-baseline justify-between gap-space-2">
              <span className="font-mono text-body font-medium text-text-primary">
                {token.name}
              </span>
              <span className="font-mono text-body-sm text-text-secondary">
                {token.value}
              </span>
            </div>
            <p className="text-body-sm text-text-muted mt-space-1">
              {token.usage}
            </p>
          </div>
        ))}
      </div>
    </div>
  ),
};
