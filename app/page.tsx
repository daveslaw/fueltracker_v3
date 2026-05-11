import { redirect } from "next/navigation";

// Middleware handles role-based routing. This fallback covers any gap.
export default function Home() {
  redirect("/shift");
}
