import { Splash } from "@/components/layout/Splash";

/** Shown during route transitions, so navigation matches the launch screen. */
export default function Loading() {
  return <Splash persistent />;
}
