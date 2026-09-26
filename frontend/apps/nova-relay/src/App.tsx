import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createBrowserRouter } from "react-router";
import { ToastProvider } from "@nova/ui-core";
import { RealtimeProvider, createQueryClient } from "@nova/services";
import { routes } from "./routes";

export function App() {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(() => createBrowserRouter(routes));
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </RealtimeProvider>
    </QueryClientProvider>
  );
}
