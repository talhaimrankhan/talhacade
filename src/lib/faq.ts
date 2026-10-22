/** Shared FAQ copy — rendered on the homepage and mirrored as FAQPage JSON-LD. */
export interface FaqItem {
  q: string;
  a: string;
}

export const faqs: FaqItem[] = [
  {
    q: "Do I need an account?",
    a: "No — there is no signup, no login and no download anywhere on the site. Click a game and it starts.",
  },
  {
    q: "Where are my high scores and favorites saved?",
    a: "In your browser's local storage, on your device only. Nothing is uploaded to a server; clearing your browser data resets them.",
  },
  {
    q: "Do the games work on phones and tablets?",
    a: "Yes. Every game is labeled keyboard, mouse or touch, and touch games show on-screen controls that fit your thumb.",
  },
  {
    q: "Are all the games really free?",
    a: "Completely. No paywalls, no premium tier, no lives system — just pick and play.",
  },
  {
    q: "What kinds of games are here?",
    a: "Eight genres: arcade, puzzle, strategy, casual, racing, shooting, sports and word — from 30-second reaction tests to strategy duels that eat your lunch break.",
  },
];
