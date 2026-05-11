import { redirect } from "next/navigation";

(window as any).doesNotExist();

// Middleware handles role-based routing. This fallback covers any gap.
export default function Home() {
  redirect("/shift");
}
