import type { CodexEntry } from "../engine/types";

// Field Notes: short, accurate explanations unlocked as you meet each concept
// in play. Written plainly, the way a mentor would explain it at your desk.

export const CODEX: CodexEntry[] = [
  {
    id: "triage",
    term: "Triage",
    dept: "soc",
    body: [
      "Triage is deciding, fast, what an alert actually means and how urgent it is before you commit hours to it.",
      "You are sorting signal from noise. Most alerts are benign. The skill is spotting the few that are not, without spending your whole shift on the ones that are.",
    ],
  },
  {
    id: "phishing",
    term: "Phishing",
    dept: "helpdesk",
    body: [
      "Phishing is a message that tries to trick a person into clicking, logging in somewhere fake, or handing over information.",
      "Tells to look for: a sense of urgency, a mismatch between the display name and the real address, a link whose text does not match where it goes, and requests that skip normal process.",
      "The fix is rarely only technical. Reporting it and warning others matters as much as blocking a sender.",
    ],
  },
  {
    id: "mfa",
    term: "Multi-factor authentication",
    dept: "helpdesk",
    body: [
      "MFA asks for a second proof beyond a password, usually a code or a tap on your phone.",
      "It stops most account takeovers because a stolen password alone is no longer enough.",
      "Attackers answer with MFA fatigue, spamming prompts until someone taps approve out of annoyance. A prompt you did not start is a prompt you deny.",
    ],
  },
  {
    id: "forwarding-rule",
    term: "Malicious mailbox rule",
    dept: "soc",
    body: [
      "After stealing access to a mailbox, an attacker often creates a hidden rule that auto-forwards or deletes certain mail.",
      "It lets them read replies, hide their own messages, and stay quiet. A rule that forwards invoices to an outside address is a classic sign of business email compromise.",
    ],
  },
  {
    id: "dns-tunnel",
    term: "DNS tunneling",
    dept: "network",
    body: [
      "DNS is how names become addresses. It is allowed out of almost every network, which makes it a tempting smuggling route.",
      "In DNS tunneling, data is hidden inside a stream of odd-looking lookups to a domain the attacker controls. Long random subdomains and a huge number of queries to one domain are the giveaway.",
    ],
  },
  {
    id: "lateral-movement",
    term: "Lateral movement",
    dept: "soc",
    body: [
      "Getting one foothold is rarely the goal. Lateral movement is how an intruder spreads from that first machine to the ones they actually want.",
      "It often reuses valid credentials and normal admin tools, so it hides inside activity that looks legitimate. That is what makes it hard.",
    ],
  },
  {
    id: "chain-of-custody",
    term: "Chain of custody",
    dept: "forensics",
    body: [
      "Evidence is only as good as the story of who held it and when. Chain of custody is that unbroken, documented record.",
      "Hash a copy, work on the copy, log every handoff. A single undocumented gap can make solid evidence worthless when it matters most.",
    ],
  },
  {
    id: "hashing",
    term: "Hashing",
    dept: "forensics",
    body: [
      "A hash is a fixed-length fingerprint of a file. Change one byte and the fingerprint changes completely.",
      "Forensics uses hashes to prove a copy is identical to the original and was not altered. Threat intel uses them to recognize a known-bad file.",
    ],
  },
  {
    id: "ioc",
    term: "Indicator of compromise",
    dept: "intel",
    body: [
      "An IOC is an observable trace of an intrusion: a file hash, a domain, an address, a registry change.",
      "On their own they are just facts. Their value is in matching, when the same indicator shows up across clients, you are probably looking at one campaign, not three accidents.",
    ],
  },
  {
    id: "scope",
    term: "Scope (rules of engagement)",
    dept: "pentest",
    body: [
      "Scope is the written agreement of exactly what a tester may touch, when, and how. Everything outside it is off limits, full stop.",
      "Testing a system you were not authorized to test is not a clever shortcut. It can be a crime, and it destroys the trust the whole engagement runs on.",
    ],
  },
  {
    id: "least-privilege",
    term: "Least privilege",
    dept: "general",
    body: [
      "Give every account and service only the access it genuinely needs, and nothing more.",
      "When something does get compromised, least privilege is what decides whether the damage is one mailbox or the whole company.",
    ],
  },
  {
    id: "defense-in-depth",
    term: "Defense in depth",
    dept: "general",
    body: [
      "No single control is perfect, so you layer them. If one fails, the next still stands.",
      "A phishing filter, plus MFA, plus least privilege, plus monitoring. An attacker has to beat all of them, not just one.",
    ],
  },
  {
    id: "ransomware",
    term: "Ransomware",
    dept: "intel",
    body: [
      "Ransomware encrypts a victim's files and demands payment for the key, often while also stealing the data to threaten leaking it.",
      "The defense that actually works is boring and reliable: tested, offline backups, tight access, and fast detection before encryption starts.",
    ],
  },
  {
    id: "ot",
    term: "Operational technology (OT)",
    dept: "network",
    body: [
      "OT is the computers that run physical things: pumps, valves, cranes, assembly lines. A water plant runs on OT.",
      "You cannot just patch and reboot a pump mid-cycle. Safety comes first, uptime second, which is exactly why OT is kept separated from ordinary office networks.",
    ],
  },
  {
    id: "false-positive",
    term: "False positive",
    dept: "soc",
    body: [
      "An alert that fired on something harmless. Too many of them and a team stops trusting its own tools, which is how real alerts get missed.",
      "Tuning out false positives is real security work, not just tidying up. A quiet, trustworthy alert queue saves the day the one true alert arrives.",
    ],
  },
  {
    id: "attribution",
    term: "Attribution",
    dept: "intel",
    body: [
      "Attribution is the careful, cautious work of linking activity to an actor. It is built from overlapping evidence, never a single clue.",
      "A username in a log is not a person. Credentials get stolen, tools get shared, trails get planted. Say what the evidence supports and no more.",
    ],
  },
  {
    id: "password-spray",
    term: "Password spraying",
    dept: "soc",
    body: [
      "Instead of trying many passwords on one account, a spray tries one common password on many accounts, slowly enough to stay under lockout limits.",
      "It works because somebody, somewhere, still has Spring2026 or the temporary password from their first day. The tell is one source touching dozens of accounts once each.",
      "MFA and banning common passwords take most of the sting out of it.",
    ],
  },
  {
    id: "segmentation",
    term: "Network segmentation",
    dept: "network",
    body: [
      "Segmentation splits a network into zones with rules between them: guests, staff, servers, and the machines that run physical things.",
      "It turns one break-in into a contained one. A laptop on the guest wifi should reach the internet and nothing else.",
      "The rules between zones matter more than the zones. One temporary allow rule can undo all of it.",
    ],
  },
  {
    id: "default-credentials",
    term: "Default credentials",
    dept: "pentest",
    body: [
      "Many devices ship with a known username and password, like admin/admin, printed in a manual anyone can read.",
      "If nobody changes them, the device is open to everyone who finds it, and attackers scan the internet for exactly these.",
      "Change defaults on day one, and keep admin pages off the internet.",
    ],
  },
  {
    id: "social-engineering",
    term: "Social engineering",
    dept: "helpdesk",
    body: [
      "Social engineering hacks the person instead of the computer: a call, a message or a visit that talks someone into helping.",
      "It leans on urgency, authority and helpfulness. A deadline, a title, a friendly voice.",
      "The defense is a habit: hang up and call back on a number you already have. Real IT can wait two minutes.",
    ],
  },
  {
    id: "file-signatures",
    term: "File signatures (magic bytes)",
    dept: "forensics",
    body: [
      "A file's name can say anything. Its first few bytes cannot lie so easily: most formats start with a fixed signature.",
      "Windows programs start with MZ (4d 5a in hex). PDFs start with %PDF. Zip files, and Office documents, which are zips inside, start with PK.",
      "So when an invoice.pdf begins with MZ, it is a program dressed as a document. A hex viewer like xxd shows you the truth in one line.",
    ],
  },
  {
    id: "time-zones",
    term: "Time zones in a timeline",
    dept: "forensics",
    body: [
      "Every log is stamped by its own clock. Firewalls and servers usually log in UTC; desktop PCs often log in local time.",
      "Before merging logs into one timeline, convert everything to one zone, usually UTC. Then check the clocks were right, too: a PC can drift by minutes.",
      "The giveaway of a mistake is an effect before its cause, like a program calling home an hour before the stick it came on was plugged in.",
    ],
  },
  {
    id: "access-control",
    term: "Broken access control (IDOR)",
    dept: "pentest",
    body: [
      "Access control decides who may see or do what. It is broken when the server trusts the client to ask only for its own data.",
      "An insecure direct object reference (IDOR) is the classic case: a record is fetched by an id in the request, and changing the id to another value returns someone else's record, because nothing checks ownership.",
      "The fix is on the server: for every request, confirm the signed-in user is allowed to touch the thing they asked for. Hiding the id, or checking only in the page, is not enough.",
    ],
  },
  {
    id: "pivoting",
    term: "Pivoting (infrastructure tracking)",
    dept: "intel",
    body: [
      "One indicator is rarely alone. Pivoting is turning a known name or address into the rest of an actor's infrastructure, so it can all be blocked at once instead of one piece at a time.",
      "Passive DNS keeps a history of which names pointed at which addresses. From a domain you find its address, and from an address you find the other domains that have used it.",
      "Mind shared hosting and old records: an address a name used last year may also belong to something unrelated today. Pivot on current data, and confirm before you block.",
    ],
  },
  {
    id: "email-headers",
    term: "Reading email headers",
    dept: "helpdesk",
    body: [
      "Every mail server that handles a message adds a Received line on top of the ones already there, so they read newest first. Only the lines added by servers you control can be trusted; anything older was written by the sender and can be faked.",
      "The first Received line your own server wrote names the machine that connected to it. That address is where the message really came from.",
      "SPF says whether a server may send for a domain, DKIM signs the message, and DMARC checks that one of them lines up with the domain in the From address people actually see. An SPF pass for some other domain proves nothing.",
    ],
  },
  {
    id: "cvss",
    term: "CVSS scoring",
    dept: "pentest",
    body: [
      "The Common Vulnerability Scoring System rates how severe a flaw is, from 0.0 to 10.0, by answering eight questions about it: how it is reached, how hard it is, what access it needs, whether a victim must act, whether it reaches beyond the flawed system, and what it does to confidentiality, integrity and availability.",
      "The answers make a vector like AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N, which anyone can re-check. 0.1 to 3.9 is Low, 4.0 to 6.9 Medium, 7.0 to 8.9 High, and 9.0 and above Critical.",
      "Score the flaw as it is, not as the client would like it to read. A base score describes the flaw itself; how urgent it is for this client is a separate conversation.",
    ],
  },
  {
    id: "defanging",
    term: "Defanging indicators",
    dept: "intel",
    body: [
      "A report full of live domains and links is a hazard: a mail client or chat app turns them into links, and someone clicks one. Defanging breaks them on purpose, so evil.example becomes evil[.]example and http becomes hxxp.",
      "A block list should hold everything that belongs to the actor and nothing that does not. Leave out shared hosting and real businesses that happen to sit nearby, or the block breaks something innocent.",
    ],
  },
  {
    id: "detection-rule",
    term: "Writing a detection rule",
    dept: "soc",
    body: [
      "A detection rule is a saved search that fires an alert when it matches. A good one catches every instance of the attack and nothing else.",
      "The trade-off is between missing attacks and crying wolf. Too loose and real alerts drown in false alarms until people stop reading them; too tight and the attack slips through a gap.",
      "Test a rule before you ship it, against a replay of known-bad and known-good events. The attacker is usually a combination: the right account from the wrong place, not the account or the place alone.",
    ],
  },
  {
    id: "incident-report",
    term: "Writing the incident report",
    dept: "general",
    body: [
      "The report is what survives the incident. Write it for someone who was not in the room: what happened, how, what you did, and what should change.",
      "Say what the evidence supports and no more. If a log names an account, the report says the account acted, not that a named person did, unless something else proves it.",
      "A root cause and a concrete recommendation are what make it useful. 'Be more careful' is not a fix; 'retire the shared credential and require MFA' is.",
    ],
  },
  {
    id: "attack",
    term: "MITRE ATT&CK",
    dept: "general",
    body: [
      "ATT&CK is a free, public catalog of the techniques real attackers use, built from reported incidents. Each technique has an ID, like T1566 for phishing or T1078 for using valid accounts.",
      "The IDs are a shared language. A detection rule, an incident report and a threat intel profile can all point at the same technique, so teams compare notes without arguing about wording.",
      "A technique tag says what was done, not who did it. Two unrelated groups can use the same technique on the same day.",
    ],
  },
];

export function codexById(id: string): CodexEntry | undefined {
  return CODEX.find((c) => c.id === id);
}
