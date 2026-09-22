import * as React from "react";
import { StatCard, type StatCardProps } from "@nova/ui-core";
import { PnLText } from "../PnLText/PnLText";

export interface PnLCardProps extends Omit<StatCardProps, "value"> {
  paise: number;
  percent?: number;
}

export function PnLCard({
  label,
  paise,
  percent,
  caption,
  captionTone,
  loading = false,
  className,
  ...props
}: PnLCardProps): React.ReactElement {
  return (
    <StatCard
      label={label}
      value={<PnLText paise={paise} percent={percent} />}
      caption={caption}
      captionTone={captionTone}
      loading={loading}
      className={className}
      {...props}
    />
  );
}
