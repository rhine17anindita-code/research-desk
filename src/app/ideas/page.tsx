import { redirect } from "next/navigation";

/** The idea deck now lives in the Studio. */
export default function IdeasRedirect() {
  redirect("/studio");
}
