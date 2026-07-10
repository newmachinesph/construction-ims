import { redirect } from "next/navigation";

/** The app has no marketing surface — send everyone to the dashboard, which
 *  itself redirects to /login when there is no session. */
export default function Home() {
  redirect("/dashboard");
}
