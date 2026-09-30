import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pager, type PagerProps } from "./Pager";

function ControlledPager(props: PagerProps): React.ReactElement {
  const [page, setPage] = React.useState(props.page);
  const [pageSize, setPageSize] = React.useState(props.pageSize);
  return (
    <Pager
      {...props}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
    />
  );
}

const meta: Meta<typeof Pager> = {
  title: "Core/Pager",
  component: Pager,
  render: (args) => <ControlledPager {...args} />,
  args: { page: 3, pageSize: 50, total: 1240 },
  parameters: { layout: "padded", a11y: { test: "error" } },
};
export default meta;
type Story = StoryObj<typeof Pager>;

export const MiddlePage: Story = {};
export const FirstPage: Story = { args: { page: 1 } };
export const OnePage: Story = { args: { page: 1, total: 12 } };
export const Empty: Story = { args: { page: 1, total: 0 } };
export const Loading: Story = { args: { loading: true } };
