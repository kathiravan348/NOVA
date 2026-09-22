import { brand } from "@nova/brand";

export function App() {
  return (
    <main>
      <h1 className="text-page-title text-text-primary">{brand.products.relay.name}</h1>
    </main>
  );
}
