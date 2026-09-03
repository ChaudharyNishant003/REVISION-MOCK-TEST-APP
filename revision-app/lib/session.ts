import { redirect } from "next/navigation";

import { auth } from "@/auth";

/** Server-side guard: returns the signed-in user's id, or redirects to /login. Middleware already
 * protects these routes, but server actions and data loaders call this directly for safety. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user.id;
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}
