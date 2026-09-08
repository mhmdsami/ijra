"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";

export async function signOutAction() {
  const jar = await cookies();
  const h = new Headers({ cookie: jar.toString() });
  await auth().api.signOut({ headers: h });
  redirect("/login");
}
