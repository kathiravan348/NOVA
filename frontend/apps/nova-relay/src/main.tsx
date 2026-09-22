import React from "react";
import ReactDOM from "react-dom/client";
import "@nova/ui-core/styles.css";
import { applyTheme, getStoredTheme } from "@nova/ui-core";
import { brand } from "@nova/brand";
import { App } from "./App";

applyTheme(getStoredTheme());

document.title = brand.products.relay.name;

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
