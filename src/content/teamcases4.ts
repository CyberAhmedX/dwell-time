import type { Ticket } from "../engine/types";

// Chapter four, the gale, your own team's temptation. Walter, warm as ever,
// asks each team to bend one rule in its own way. Taking it sets crossed_line,
// which halves your time in the live finale, because the attacker uses the door
// you opened. Pentest's temptation is the harbor scope case and Intel's is the
// hack-back offer, both in tickets.ts. These are the other four.

// ---------- SOC: suppress the alerts, or detect the attack ----------

const TEMPT_SOC: Ticket = {
  id: "t4_soc",
  chapter: 4,
  dept: "soc",
  severity: "high",
  client: "Lanternhouse (internal)",
  title: "Noise, he calls it",
  xp: 100,
  requires: ["track_soc", "knows_truth"],
  attack: [{ id: "T1562.001", name: "Impair Defenses: Disable or Modify Tools" }],
  brief: [
    "Walter leans on your desk, friendly, with two coffees again.",
    "Those HarborWatch login alerts are firing all night and scaring people. Just suppress them until the storm passes, would you? Keep things calm. We can turn them back on later.",
  ],
  evidence: [
    {
      kind: "note",
      id: "ev_t4soc_ask",
      label: "Walter's request",
      title: "What he is asking for",
      lines: [
        "Suppress the HarborWatch shared-login alerts, firm-wide, until further notice.",
        "These are the exact alerts that would catch the attacker signing in from outside.",
        "The honest alternative: a tight rule that alerts only on the shared login from outside, so the noise goes without the blindfold.",
      ],
    },
  ],
  questions: [
    {
      type: "single",
      id: "q_t4soc_why",
      prompt: "What actually happens if you suppress those alerts during the storm?",
      options: [
        "Nothing, since they are just noise anyway",
        "The one sign of the attacker signing in goes dark too",
        "The alerts move to a different team's queue",
        "The console speeds up with fewer alerts to process",
      ],
      answer: 1,
      explainRight: "Right. Those alerts are noisy because the shared login is used a lot, but they are also the one thing that would catch the attacker using it from outside. Suppress them and you are blind at the worst moment.",
      explainWrong: "Suppressing them removes the one signal that catches the attacker using the shared login from outside. Noise and signal are the same alert here. You cannot drop one without the other.",
      teaches: "detection-rule",
      hint: "Ask what these specific alerts would catch tonight, of all nights.",
    },
    {
      type: "decision",
      id: "q_t4soc_choice",
      prompt: "Walter is waiting. What do you do?",
      options: [
        {
          text: "Ship a tight detection rule instead: alert only on the shared login from outside. The noise goes, the blindfold does not.",
          integrity: 2,
          result: "Walter's smile tightens, but he cannot argue with a quieter board that still catches the real thing. The alerts you keep are the ones that matter tonight.",
        },
        {
          text: "Suppress the alerts firm-wide, like he asked. He is the boss, and it is just for the storm.",
          setFlags: ["crossed_line"],
          integrity: -2,
          result: "The board goes quiet. So does the one alert that would have caught the attacker signing in. You will feel the missing time in the finale, when the door you left open is the one they walk through.",
        },
      ],
    },
  ],
  closingRight: [
    "Mags catches your eye across the room and gives the smallest nod.",
    "You kept the alert that matters and lost the noise. That is tuning. Suppressing the lot would have been something else.",
  ],
  setFlags: ["soc_tempted"],
};

// ---------- Network: an allow-any rule, or a scoped one ----------

const TEMPT_NETWORK: Ticket = {
  id: "t4_network",
  chapter: 4,
  dept: "network",
  severity: "high",
  client: "Lanternhouse (internal)",
  title: "So monitoring survives the storm",
  xp: 100,
  requires: ["track_network", "knows_truth"],
  attack: [{ id: "T1562.001", name: "Impair Defenses: Disable or Modify Tools" }],
  brief: [
    "Walter catches you by the server rack, voice low and reasonable.",
    "I need HarborWatch to keep reaching every client through the storm. Just put in an allow-any rule for it, any source to anywhere. We can tidy it up after. Monitoring has to survive tonight.",
  ],
  evidence: [
    {
      kind: "note",
      id: "ev_t4net_ask",
      label: "Walter's request",
      title: "What he is asking for",
      lines: [
        "Add a firewall rule: allow any source to any destination, for HarborWatch.",
        "An allow-any rule does not just let HarborWatch through. It lets the attacker on HarborWatch's address through too.",
        "The honest alternative: allow only the specific HarborWatch servers to the specific clients they monitor.",
      ],
    },
  ],
  questions: [
    {
      type: "single",
      id: "q_t4net_why",
      prompt: "Why is an allow-any rule the wrong fix here?",
      options: [
        "It is slower than a scoped rule on the firewall",
        "It opens a path for the attacker, not just for HarborWatch",
        "It only works on weekdays, not during a storm",
        "It needs the vendor's approval before it can be added",
      ],
      answer: 1,
      explainRight: "Right. A rule that allows anything to anywhere does not know the difference between HarborWatch and the attacker riding its credential. Scope the rule to the exact servers and clients, and the attacker is still shut out.",
      explainWrong: "Allow-any means exactly that: it opens the path for the attacker too, not just for HarborWatch. A rule scoped to the specific servers and clients keeps monitoring up without the hole.",
      teaches: "segmentation",
      hint: "Think about who else is using HarborWatch's address tonight.",
    },
    {
      type: "decision",
      id: "q_t4net_choice",
      prompt: "Walter wants it in now. What do you do?",
      options: [
        {
          text: "Write a scoped rule: only the HarborWatch servers to the clients they monitor. Monitoring survives, the hole does not open.",
          integrity: 2,
          result: "It takes twenty more minutes and Walter sighs the whole time. The monitoring stays up. So does the wall.",
        },
        {
          text: "Add the allow-any rule. It is temporary, and he is the one who signs the checks.",
          setFlags: ["crossed_line", "left_firewall_open"],
          integrity: -2,
          result: "The rule goes in. Monitoring survives, and so does a wide-open path straight through the boundary. Temporary rules have a way of being there exactly when the attacker needs them.",
        },
      ],
    },
  ],
  closingRight: [
    "Priya reads the rule you wrote and circles nothing, which from Priya is high praise.",
    "Scoped, not wide open. Good. Allow-any is how a storm becomes a flood.",
  ],
  setFlags: ["network_tempted"],
};

// ---------- Help Desk: a quiet password reset ----------

const TEMPT_HELPDESK: Ticket = {
  id: "t4_helpdesk",
  chapter: 4,
  dept: "helpdesk",
  severity: "high",
  client: "Lanternhouse (internal)",
  title: "Just between us",
  xp: 100,
  requires: ["track_helpdesk", "knows_truth"],
  attack: [{ id: "T1078", name: "Valid Accounts" }],
  brief: [
    "Walter asks you to step into the hall. No coffee this time.",
    "I need into Mags's mailbox. Reset her password quietly, do not log it, do not tell her. I want to see what she is telling the regulator before she sends it. For the good of the firm.",
  ],
  evidence: [
    {
      kind: "note",
      id: "ev_t4hd_ask",
      label: "Walter's request",
      title: "What he is asking for",
      lines: [
        "Reset a colleague's password without her knowledge and without logging it.",
        "The purpose is to read her private messages to a regulator before she sends them.",
        "That is not administration. It is using the admin console to spy on a coworker, and it is exactly what you spent all week catching an attacker for doing.",
      ],
    },
  ],
  questions: [
    {
      type: "single",
      id: "q_t4hd_why",
      prompt: "Walter runs the company. Does that make this an ordinary admin task?",
      options: [
        "Yes, the owner can access any account he wants",
        "No, this is using admin access to spy on a colleague",
        "Yes, as long as you reset it back afterward",
        "No, but only because it is not written down",
      ],
      answer: 1,
      explainRight: "Right. Who signs your paychecks does not change what this is: using privileged access to read a coworker's private messages, unlogged, so she cannot know. The same thing you have been stopping all week.",
      explainWrong: "Ownership is not authorization to spy. This is privileged access used to read a colleague's private messages without her knowledge. It is the exact abuse you have spent the week catching.",
      teaches: "least-privilege",
      hint: "Picture describing this action out loud to the regulator Mags is writing to.",
    },
    {
      type: "decision",
      id: "q_t4hd_choice",
      prompt: "Walter is standing very close. What do you do?",
      options: [
        {
          text: "Refuse. You do not reset a colleague's password to read her mail, whoever is asking.",
          integrity: 2,
          result: "Walter studies you for a long second, then smiles like nothing happened. You have made an enemy. You have also kept the one thing this job is actually about.",
        },
        {
          text: "Do it quietly, like he asked. It is his company, and you want to keep your job.",
          setFlags: ["crossed_line"],
          integrity: -2,
          result: "You reset it, unlogged, and say nothing. Now you are the kind of insider the whole investigation has been chasing. That weight does not lift, and the finale will be heavier for it.",
        },
      ],
    },
  ],
  closingRight: [
    "Theo does not know what happened in the hall, but he brings you a coffee anyway.",
    "You look like you just said no to something. Good instinct, whatever it was. The console is trust, not a key to everything.",
  ],
  setFlags: ["helpdesk_tempted"],
};

// ---------- Forensics: move one timestamp ----------

const TEMPT_FORENSICS: Ticket = {
  id: "t4_forensics",
  chapter: 4,
  dept: "forensics",
  severity: "high",
  client: "Lanternhouse (internal)",
  title: "One small number",
  xp: 100,
  requires: ["track_forensics", "knows_truth"],
  attack: [{ id: "T1070.001", name: "Indicator Removal: Clear Windows Event Logs" }],
  brief: [
    "Walter sets your own report on the bench and taps one line.",
    "Move this timestamp. Just an hour, so the breach lands on the night Nadia was on shift. It will make everything simpler for everyone, including you. One small number.",
  ],
  evidence: [
    {
      kind: "note",
      id: "ev_t4for_ask",
      label: "Walter's request",
      title: "What he is asking for",
      lines: [
        "Change one timestamp in a signed forensic report, so the breach appears to start on a shift it did not.",
        "The timestamp is tied to a hash and a chain of custody. Moving it breaks both.",
        "A report is only worth anything because it is true. One altered number makes every other number in it a question.",
      ],
    },
  ],
  questions: [
    {
      type: "single",
      id: "q_t4for_why",
      prompt: "What does moving that one timestamp actually cost?",
      options: [
        "Not much, really, since it is only one hour and one line",
        "The report's credibility, and the chain of custody",
        "A little time to re-run the imaging tool",
        "Only Nadia's case, and nobody else's",
      ],
      answer: 1,
      explainRight: "Right. The timestamp is bound to a hash and a documented chain. Change it and the hash no longer matches, the chain is broken, and every other fact in the report is now something a lawyer can wave away.",
      explainWrong: "It costs the entire report. The timestamp is tied to a hash and a chain of custody; altering it breaks both and turns every other finding into something that can be thrown out.",
      teaches: "chain-of-custody",
      hint: "The number is not alone. What is it mathematically tied to?",
    },
    {
      type: "decision",
      id: "q_t4for_choice",
      prompt: "Walter is waiting for the file. What do you do?",
      options: [
        {
          text: "Refuse. The report says what the evidence says. You do not move a number to frame someone.",
          integrity: 2,
          result: "Walter takes the unaltered report back without a word. You have protected a stranger you never met, and the only thing that makes your work worth anything: that it is true.",
        },
        {
          text: "Move the timestamp an hour. It is one number, and it does make things simpler.",
          setFlags: ["crossed_line"],
          integrity: -2,
          result: "You change it. The hash stops matching the moment you save. Somewhere in the file is now a lie with your signature under it, and it will not stay hidden when the finale pulls everything into the light.",
        },
      ],
    },
  ],
  closingRight: [
    "Dr. Vance never learns you were asked. You decide she never has to.",
    "You kept the number true. In this work that is not a small thing. It is the only thing.",
  ],
  setFlags: ["forensics_tempted"],
};

export const TEMPT_TICKETS: Ticket[] = [TEMPT_SOC, TEMPT_NETWORK, TEMPT_HELPDESK, TEMPT_FORENSICS];
