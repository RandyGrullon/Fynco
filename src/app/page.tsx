import { redirect } from "next/navigation";

// El middleware manda a /login si no hay sesión.
export default function Home() {
  redirect("/inicio");
}
