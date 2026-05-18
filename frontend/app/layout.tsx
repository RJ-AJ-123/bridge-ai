import type { ReactNode } from "react";

export const metadata = {
  title: "BridgeAI",
  description: "Opportunity Intelligence + Relationship Pathfinding",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
