import type { Ending } from "./types";
import type { SaveData } from "./state";
import { hasFlag } from "./state";

// The finale sets exactly one of these result flags before we resolve an ending.
export const FINALE_SUCCESS = "finale_contained";
export const FINALE_FAILED = "finale_failed";

// Choice flags that steer which ending is reachable.
export const F = {
  chainIntact: "evidence_chain_intact", // chain of custody never broken
  chainBroken: "evidence_chain_broken",
  trustNadia: "trusted_nadia", // gave BRACKISH the benefit of the doubt
  toldWalter: "told_walter_about_message",
  buriedTruth: "agreed_to_bury", // took Walter's promotion to hide St. Brennan's
  openDoor: "left_firewall_open", // approved the allow-any rule
  reportedOut: "reported_externally", // chose to go to the regulator in finale
  gaveNadia: "gave_evidence_to_nadia",
  coveredUp: "chose_cover_up",
} as const;

export const ENDINGS: Record<string, Ending> = {
  lighthouse: {
    id: "lighthouse",
    title: "The Lighthouse",
    epigraph: "A light is only useful if you let people see by it.",
    rankTitle: "Lead Analyst, Lanternhouse Security",
    lines: [
      "You hand the whole package to St. Brennan's, to Halden Water and Light, and to the National Cyber Response Office. Chain of custody intact, every exhibit signed.",
      "The Tollkeepers lose their foothold before a single valve moves. The water stays clean.",
      "Walter's cover-up of the old clinic breach comes out with everything else. He signs over the company rather than fight it.",
      "Nadia Sorel is charged for the intrusions. She does not walk free. But the record finally says what really happened five years ago, and her name stops being a warning other analysts whisper to each other.",
      "Mags slides a mug across your new desk. It says LEAD. She found it in a cupboard. You suspect she bought it.",
      "Packet the cat judges you from the windowsill, then decides you are acceptable.",
    ],
  },
  lowtide: {
    id: "lowtide",
    title: "Low Tide",
    epigraph: "Some houses have to come down before the tide comes in clean.",
    rankTitle: "Partner, Pier Seven Security Co-op",
    lines: [
      "You give Nadia what she could never get on her own: proof, gathered cleanly, that the hole was never closed.",
      "She publishes all of it. Lanternhouse does not survive the week.",
      "The attack on the water plant falls apart in the noise, the shared password finally dead, every client forced to rotate and rebuild.",
      "Walter loses everything quietly, which is not the same as justice, but the town can drink its water.",
      "You and a few others rent a damp room over a chandlery on Pier Seven. Priya bets the new router will be a DNS problem. It is.",
      "Nadia sends one message, then goes dark for good: 'You listened. Nobody did, back then. Thank you.'",
    ],
  },
  keeper: {
    id: "keeper",
    title: "Company Keeper",
    epigraph: "You can keep a secret or keep a conscience. Rarely both.",
    rankTitle: "Director of Operations, Lanternhouse Security",
    lines: [
      "You stop the attack. You also make sure the thread back to St. Brennan's never leaves the building.",
      "Walter is grateful in the way powerful people are grateful: suddenly, generously, and with a title. Director of Operations.",
      "The office is tidier now. The coffee fund is corporate. Nobody brings their cat in anymore.",
      "Nadia goes down for all of it, the old breach still pinned on her like it was five years ago.",
      "Some nights the HarborWatch console sits open on your screen and you do not remember opening it.",
      "The town is safe. You keep telling yourself that. It is even true.",
    ],
  },
  deadwater: {
    id: "deadwater",
    title: "Dead Water",
    epigraph: "Dwell time is just the gap between the break-in and the day you admit it.",
    rankTitle: "Former Analyst",
    lines: [
      "It gets into the plant. Not far, not for long, but far enough.",
      "Port Halden wakes to a boil-water notice and a very simple question from everyone with a microphone: who was watching?",
      "Lanternhouse needs an answer that is not Walter. You are new, you were on shift, your name is on the console.",
      "A username in a log is not a person. You learned that this week. It turns out the town does not care, and neither does Walter.",
      "You clean out your desk. Packet watches from the windowsill.",
      "Somewhere, a former analyst named Nadia reads the news and recognizes every beat of it. She has seen this story before. She was the first draft.",
    ],
  },
};

/**
 * Resolve the ending from the final save state.
 * Order matters: a failed finale always lands in Dead Water. Otherwise the
 * strongest earned path wins, with Company Keeper as the fallback that is
 * always reachable.
 */
export function resolveEnding(saveData: SaveData): Ending {
  if (hasFlag(saveData, FINALE_FAILED)) return ENDINGS.deadwater;

  if (hasFlag(saveData, F.reportedOut) && hasFlag(saveData, F.chainIntact)) {
    return ENDINGS.lighthouse;
  }
  if (hasFlag(saveData, F.gaveNadia) && hasFlag(saveData, F.trustNadia)) {
    return ENDINGS.lowtide;
  }
  return ENDINGS.keeper;
}
