import React from "react";
import ReactDOM from "react-dom/client";
import "@nova/ui-core/styles.css";
import { applyTheme, getStoredTheme } from "@nova/ui-core";
import { getDataMode } from "@nova/services";
import { brand } from "@nova/brand";
import { App } from "./App";

applyTheme(getStoredTheme());

document.title = brand.products.orbit.name;

async function start(): Promise<void> {
  if (getDataMode() === "mock") {
    const { startMockWorker } = await import("@nova/mocks/browser");
    await startMockWorker();
  }
  const rootElement = document.getElementById("root");
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  }
}

void start();
