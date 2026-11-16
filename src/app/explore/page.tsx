import { redirect } from "next/navigation";

/** Explore is now part of Research. */
export default function ExploreRedirect() {
  redirect("/research");
}
