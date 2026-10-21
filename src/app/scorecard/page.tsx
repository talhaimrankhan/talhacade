import type { Metadata } from "next";
import { Scorecard } from "@/components/scorecard";

export const metadata: Metadata = {
  title: "Scorecard",
  description:
    "Your local arcade stats — games played, categories touched, personal bests and achievements. Stored in this browser only: no account, no server, no tracking.",
};

export default function ScorecardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Scorecard />
    </div>
  );
}
