import React from "react";
import ReactDOM from "react-dom/client";
import { brand } from "@nova/brand";
import { App } from "./App";

document.title = brand.products.orbit.name;

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
