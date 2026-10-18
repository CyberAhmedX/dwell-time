import type { Chapter } from "../engine/types";

// How each chapter is assembled: an intro scene, the main tickets you must
// clear to advance, optional side tickets, and the outro scenes (including the
// decisions that steer your ending) that play before the next chapter.

export interface ChapterPlan {
  chapter: Chapter;
  title: string;
  subtitle: string;
  intro: string; // scene id
  main: string[]; // ticket ids required to advance
  side: string[]; // optional ticket ids
  outro: string[]; // scene ids played in order before advancing
}

export const CHAPTERS: ChapterPlan[] = [
  {
    chapter: 1,
    title: "Chapter One",
    subtitle: "Fair Weather",
    intro: "s1_intro",
    main: ["t1_bakery_phish"],
    side: ["t1_printer"],
    outro: ["s1_outro"],
  },
  {
    chapter: 2,
    title: "Chapter Two",
    subtitle: "Overcast",
    intro: "s2_intro",
    // plus the case for your own track; the others stay hidden
    main: ["t2_bakery_bec", "t2_school_dns", "tr_soc", "tr_network", "tr_helpdesk", "tr_forensics", "tr_pentest", "tr_intel"],
    side: ["sd_packet"],
    outro: ["s2_outro"],
  },
  {
    chapter: 3,
    title: "Chapter Three",
    subtitle: "Squall",
    intro: "s3_intro",
    main: ["t3_clinic_image", "t3_timeline", "t3_soc_alerts", "t3_network_flows", "t3_helpdesk_accounts", "t3_pentest_lab", "t3_intel_history"],
    side: ["sd_vishing"],
    outro: ["s3_brackish"],
  },
  {
    chapter: 4,
    title: "Chapter Four",
    subtitle: "Gale",
    intro: "s4_intro",
    main: ["t4_harbor_pentest", "t4_intel_correlate"],
    side: ["sd_backups"],
    outro: ["s4_walter_offer"],
  },
  {
    chapter: 5,
    title: "Chapter Five",
    subtitle: "Storm Surge",
    intro: "s5_intro",
    main: ["t5_plant_recon", "t5_network", "t5_helpdesk", "t5_forensics", "t5_pentest", "t5_intel"],
    side: ["sd_keys"],
    outro: ["s5_contain", "s5_evidence"],
  },
];

export function chapterPlan(ch: Chapter): ChapterPlan | undefined {
  return CHAPTERS.find((c) => c.chapter === ch);
}
