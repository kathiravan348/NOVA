import * as React from "react";
import type { ExitReason, LedgerEvent } from "@nova/contracts";
import { Badge, Skeleton, cn } from "@nova/ui-core";
import { formatInTimeZone } from "date-fns-tz";
import { formatInr } from "../../format/money";
import { PnLText } from "../PnLText/PnLText";
import { heldTime } from "./heldTime";

const IST = "Asia/Kolkata";

export type TradeTimelineClock = "seconds" | "minutes" | "none";

export interface TradeTimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Buys and sells, oldest first. */
  events: LedgerEvent[];
  /** `seconds` HH:mm:ss, `minutes` HH:mm, `none` date only (D83). */
  clock: TradeTimelineClock;
  reasonLabels: Record<ExitReason, string>;
  loading?: boolean;
  emptyState?: React.ReactNode;
}

type Tone = "buy" | "profit" | "loss" | "flat";

const toneClass: Record<Tone, { mark: string; text: string }> = {
  buy: { mark: "bg-action", text: "text-action-text" },
  profit: { mark: "bg-profit", text: "text-profit-text" },
  loss: { mark: "bg-loss", text: "text-loss-text" },
  flat: { mark: "bg-text-muted", text: "text-text-secondary" },
};

function toneOf(event: LedgerEvent): Tone {
  if (event.side === "buy") return "buy";
  const net = event.netPnlPaise ?? 0;
  return net > 0 ? "profit" : net < 0 ? "loss" : "flat";
}

const clockFormat: Record<TradeTimelineClock, string | null> = {
  seconds: "HH:mm:ss",
  minutes: "HH:mm",
  none: null,
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-text-primary">{children}</dd>
    </div>
  );
}

const money = (paise: number) => <span className="font-mono tabular-nums">{formatInr(paise)}</span>;

/** A run's buys and sells as nodes on a vertical rail, coloured by trade (D83). */
export const TradeTimeline = React.forwardRef<HTMLDivElement, TradeTimelineProps>(
  ({ events, clock, reasonLabels, loading = false, emptyState, className, ...props }, ref) => {
    if (loading)
      return (
        <div ref={ref} aria-busy="true" className={cn("flex flex-col gap-6", className)} {...props}>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="h-3 w-3 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      );
    if (events.length === 0)
      return (
        <div
          ref={ref}
          className={cn("py-8 text-center text-body text-text-muted", className)}
          {...props}
        >
          {emptyState ?? "No trades"}
        </div>
      );
    const format = clockFormat[clock];
    return (
      <div ref={ref} className={className} {...props}>
        <ol aria-label="Trades" className="flex flex-col">
          {events.map((event, index) => {
            const tone = toneOf(event);
            const next = events[index + 1];
            const date = formatInTimeZone(event.at, IST, "d MMM yyyy");
            const time = format ? formatInTimeZone(event.at, IST, format) : null;
            const sell = event.side === "sell";
            return (
              <li
                key={`${event.at}-${event.symbol}-${event.side}-${index}`}
                data-tone={tone}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[7rem_1.5rem_minmax(0,1fr)]"
              >
                <div className="hidden pb-6 text-right sm:block">
                  <p className="text-body-sm text-text-secondary">{date}</p>
                  {time && <p className="font-mono text-number-sm text-text-primary">{time}</p>}
                </div>
                <div className="relative flex justify-center" aria-hidden="true">
                  {index > 0 && (
                    <span className={cn("absolute top-0 h-3 w-1", toneClass[tone].mark)} />
                  )}
                  {next && (
                    <span
                      className={cn("absolute top-3 bottom-0 w-1", toneClass[toneOf(next)].mark)}
                    />
                  )}
                  <span
                    className={cn(
                      "relative mt-1.5 h-3 w-3 rounded-full ring-2 ring-bg-surface",
                      toneClass[tone].mark,
                    )}
                  />
                </div>
                <div className="min-w-0 pb-6">
                  <p className="text-body-sm text-text-secondary sm:hidden">
                    {time ? `${date} · ${time}` : date}
                  </p>
                  <p className="flex flex-wrap items-baseline gap-x-2 text-body">
                    <span className={cn("font-semibold", toneClass[tone].text)}>
                      {sell ? "Sell" : "Buy"}
                    </span>
                    <span className="font-semibold text-text-primary">{event.symbol}</span>
                    <span className="font-mono tabular-nums text-text-secondary">
                      {event.qty} @ {formatInr(event.pricePaise)}
                    </span>
                  </p>
                  <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-body-sm">
                    <Fact label="Amount">{money(event.amountPaise)}</Fact>
                    {sell && (
                      <>
                        <Fact label="Charges">{money(event.chargesPaise)}</Fact>
                        <Fact label="Net P&L">
                          {event.netPnlPaise === null ? "—" : <PnLText paise={event.netPnlPaise} />}
                        </Fact>
                        {event.entryAt && (
                          <Fact label="Held">{heldTime(event.entryAt, event.at)}</Fact>
                        )}
                        <Fact label="Reason">
                          {event.reason === "stop" ? (
                            <Badge tone="warning">{reasonLabels.stop}</Badge>
                          ) : event.reason ? (
                            reasonLabels[event.reason]
                          ) : (
                            "—"
                          )}
                        </Fact>
                      </>
                    )}
                    <Fact label="Cash after">{money(event.cashAfterPaise)}</Fact>
                  </dl>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    );
  },
);

TradeTimeline.displayName = "TradeTimeline";
