import type { Dept } from "../engine/types";

// One secret per team: a piece of the truth only that team's tools can reach.
// Each is an optional question in the team's chapter three case. Finding one
// adds a line to your ending; finding all six across runs earns Six Sides of
// the Story.

export interface Secret {
  flag: string;
  dept: Dept;
  title: string; // shown in Case Files once found
  found: string; // what it proves, shown in Case Files
  ending: string; // added to the epilogue of a run that found it
}

export const SECRETS: Secret[] = [
  {
    flag: "secret_soc",
    dept: "soc",
    title: "The alerts were switched off by hand",
    found: "The rule that silenced the clinic's alerts was changed with the shared admin login, from Walter's own office PC, the night of the breach.",
    ending: "In the files you hand over is one line from a five-year-old audit log: who switched the alerts off, and from which desk. Nobody can call it a misconfiguration again.",
  },
  {
    flag: "secret_network",
    dept: "network",
    title: "Two actors, not one",
    found: "One address only ever read a few small files from the clinic. Another, the Tollkeepers' own server, pulled whole archives. The person collecting proof and the crew collecting ransom were never the same.",
    ending: "Your flow records show two hands on the clinic's data, not one. It is the reason the charge sheet against Nadia is one page shorter than the Tollkeepers'.",
  },
  {
    flag: "secret_helpdesk",
    dept: "helpdesk",
    title: "The ticket marked won't fix",
    found: "Two days before the breach, Nadia filed a ticket: HarborWatch alerts were not reaching her console. Walter closed it as won't fix.",
    ending: "A five-year-old help desk ticket ends up in the regulator's report, quoted in full. It was closed as won't fix. It was always going to matter.",
  },
  {
    flag: "secret_forensics",
    dept: "forensics",
    title: "The draft written first",
    found: "A deleted draft on the clinic laptop blamed Nadia Sorel before anyone had examined a single exhibit. The conclusion came first.",
    ending: "The deleted draft you recovered is read aloud at the inquiry. It names Nadia as the cause, and it was saved before the investigation began.",
  },
  {
    flag: "secret_pentest",
    dept: "pentest",
    title: "Anyone could have had it",
    found: "The shared HarborWatch password sat on Lanternhouse's own staff wiki for years, readable by every account, including an intern login nobody ever removed.",
    ending: "Your lab notes prove the shared password was readable by half of Port Halden's former interns. 'Only an insider could know it' stops being an argument.",
  },
  {
    flag: "secret_intel",
    dept: "intel",
    title: "The warning nobody read",
    found: "A week before the first case, BRACKISH registered a domain and emailed Lanternhouse's shared inbox: the HarborWatch password was never changed. It was never opened.",
    ending: "The unopened warning in Lanternhouse's shared inbox becomes the first exhibit. She tried the front door first. Nobody answered.",
  },
];

export function secretFor(dept: Dept): Secret {
  return SECRETS.find((s) => s.dept === dept)!;
}
