// Display names and portrait keys for everyone who speaks.

export interface CharacterInfo {
  name: string;
  role: string;
  portrait: string;
  color: string;
}

export const CHARACTERS: Record<string, CharacterInfo> = {
  you: { name: "You", role: "New hire", portrait: "you", color: "#7fb4d8" },
  walter: { name: "Walter Abernathy", role: "Founder, Lanternhouse", portrait: "walter", color: "#c9a86a" },
  mags: { name: "Mags Okafor", role: "SOC Lead", portrait: "mags", color: "#5fb0c4" },
  theo: { name: "Theo Lindqvist", role: "Help Desk Lead", portrait: "theo", color: "#e4a24a" },
  priya: { name: "Priya Raman", role: "Network Engineer", portrait: "priya", color: "#5fc48a" },
  imani: { name: "Dr. Imani Vance", role: "Forensics Lead", portrait: "imani", color: "#a78bd0" },
  rook: { name: "Rook", role: "Pentest Lead", portrait: "rook", color: "#c45f6b" },
  juno: { name: "Juno Park", role: "Threat Intel", portrait: "juno", color: "#6f9bd8" },
  celeste: { name: "Celeste Morrow", role: "GRC & Compliance", portrait: "celeste", color: "#9aa7b4" },
  brackish: { name: "BRACKISH", role: "Unknown", portrait: "brackish", color: "#2f8f88" },
  narration: { name: "", role: "", portrait: "", color: "#8a93a8" },
  packet: { name: "Packet", role: "Chief Morale Officer", portrait: "you", color: "#9ad1b0" },
};

export function charName(key: string): string {
  return CHARACTERS[key]?.name ?? key;
}
