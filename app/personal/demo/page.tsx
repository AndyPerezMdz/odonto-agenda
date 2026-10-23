import { redirect } from "next/navigation";

// 2.8 · Ya hay una sola demo: /mi-agenda/demo (sabe si tienes sesión).
export default function DemoPersonalPage() {
  redirect("/mi-agenda/demo");
}
