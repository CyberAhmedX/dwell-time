import type { Ticket } from "../engine/types";
import { clinicVpnEvents } from "./logs";
import { sha256 } from "../engine/sha256";

const CLINIC_VPN = clinicVpnEvents();

// Passive DNS for the leak-site case. The post gives only tollgate.test, but
// that name shares an address with the crew's payment portal, so pivoting the
// address turns one indicator into the whole set. All names and addresses are
// fictional (reserved .test / documentation ranges).
const TOLL_PASSIVE = {
  records: [
    { domain: "tollgate.test", ip: "203.0.113.90", firstSeen: "2026-02-18", lastSeen: "2026-03-14", note: "contact page in the leak post" },
    { domain: "paywall-tollkeepers.test", ip: "203.0.113.90", firstSeen: "2026-02-20", lastSeen: "2026-03-14", note: "payment portal, not named in the post" },
    { domain: "status-tollgate.test", ip: "203.0.113.90", firstSeen: "2026-03-01", lastSeen: "2026-03-14" },
    { domain: "tollgate.test", ip: "198.51.100.66", firstSeen: "2026-01-10", lastSeen: "2026-02-17", note: "parked, before the campaign" },
    { domain: "reading-portal.example", ip: "198.51.100.66", firstSeen: "2024-05-01", lastSeen: "2026-03-14", note: "a real school supplier, unrelated" },
  ],
};

// Files on the forensic workstation for the Brightloaf USB case. Each holds one
// byte per character, so xxd shows real headers: MZ for the program, %PDF for
// the decoy invoice.
const USB_COPY_A = [
  "BAKERY-PC-01 physical disk, image A",
  "Acquired on site through a write blocker by Dr. I. Vance, Monday 11:20.",
  "238 GB, NTFS, Windows 10.",
].join("\n") + "\n";
const USB_COPY_B = [
  "BAKERY-PC-01 physical disk, image B",
  "Acquired by Brightloaf IT from the running PC, Tuesday 16:05.",
  "238 GB, NTFS, Windows 10. The PC was used all Tuesday morning first.",
].join("\n") + "\n";
const USB_HASH = sha256(USB_COPY_A);
const z = (n: number): string => "\x00".repeat(n);
const USB_PROGRAM =
  "MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00\xb8" + z(7) + "@" + z(35) + "\x80\x00\x00\x00" +
  "\x0e\x1f\xba\x0e\x00\xb4\x09\xcd!\xb8\x01L\xcd!This program cannot be run in DOS mode.\r\r\n$" + z(7) +
  "PE\x00\x00L\x01\x03\x00" + z(16) + "InvoiceViewer" + z(3) + "203.0.113.77" + z(2) + "443" + z(4) +
  "Software\\Microsoft\\Windows\\CurrentVersion\\Run" + z(6);
const USB_DECOY =
  "%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
  "4 0 obj\n<< /Length 88 >>\nstream\nBT /F1 12 Tf 72 720 Td (Invoice, March: 14 sacks of flour, 2 sacks of rye) Tj ET\nendstream\nendobj\n%%EOF\n";
const USB_FILES: Record<string, string> = {
  "original.sha256": `${USB_HASH}  BAKERY-PC-01 physical disk, hashed on site before imaging\n`,
  "copyA.img": USB_COPY_A,
  "copyB.img": USB_COPY_B,
  "recovered_0042.bin": USB_DECOY,
  "recovered_0043.bin": USB_PROGRAM,
};


// One case per career track, in chapter two. You only see the one for the team
// you were hired into, briefed by that team's lead. Each also nudges the main
// story along: the same address, the same open door, a crew called the
// Tollkeepers. Same house rules as tickets.ts: documentation IPs, reserved
// domains, nothing real.

export const TRACK_TICKETS: Ticket[] = [
  // ------------------------------------------------------------------ SOC
  {
    id: "tr_soc",
    chapter: 2,
    dept: "soc",
    severity: "high",
    client: "St. Brennan's Clinic",
    title: "Fifty accounts, one password",
    xp: 60,
    attack: [
      { id: "T1110.003", name: "Password Spraying" },
      { id: "T1133", name: "External Remote Services" },
      { id: "T1078", name: "Valid Accounts" },
    ],
    requires: ["track_soc"],
    brief: [
      "Mags drops a printout on your desk. Actual paper. She means it.",
      "You came in as the SOC hire, so this one is yours. The clinic's VPN had a lot of failed sign-ins overnight, and its logs are in the SIEM. Tell me if it is someone fumbling a password or something worse, and what we do about it.",
    ],
    evidence: [
      {
        kind: "siem",
        id: "ev_spray_siem",
        label: "SIEM: St. Brennan's VPN, last 24 hours",
        index: "clinic_vpn",
        fields: CLINIC_VPN.fields,
        events: CLINIC_VPN.events,
      },
      {
        kind: "note",
        id: "ev_spray_note",
        label: "Clinic IT's notes",
        title: "About the VPN",
        lines: [
          "Staff connect from home. Most have one address in town they always use.",
          "The VPN asks for a password only. No second factor.",
          "New staff get a temporary password on day one. Policy says they must change it. Nobody checks.",
        ],
      },
    ],
    questions: [
      {
        type: "typed",
        id: "q_spray_ip",
        prompt: "Which address is behind most of the failed sign-ins?",
        answer: [CLINIC_VPN.sprayIp],
        placeholder: "IP address",
        explainRight: "Right. A hosting provider address with dozens of failures in under three minutes. The b.osei failures from town are a person who forgot a new password; they got in on the fourth try.",
        explainWrong: `It is ${CLINIC_VPN.sprayIp}. Count failures by source address and it stands far above the few typos from staff at home.`,
        teaches: "password-spray",
        hint: "Search for failures, then count them by source address: | stats count by src_ip, and sort the biggest to the top.",
        solution: { evidence: "ev_spray_siem", command: "action=failure | stats count by src_ip | sort -count | head 3" },
      },
      {
        type: "typed",
        id: "q_spray_accounts",
        prompt: "How many different accounts did that address try?",
        answer: [String(CLINIC_VPN.sprayAccounts)],
        placeholder: "A number",
        explainRight: `Right, ${CLINIC_VPN.sprayAccounts}, one try each. That is a password spray: one common password against every account, slow enough per account to dodge lockouts.`,
        explainWrong: `It is ${CLINIC_VPN.sprayAccounts}, one try each, including names that do not even exist here, like admin and reception. One password against many accounts is a spray.`,
        teaches: "password-spray",
        hint: "dc(user) counts distinct values. Try it on that one address.",
        solution: { evidence: "ev_spray_siem", command: `src_ip=${CLINIC_VPN.sprayIp} | stats dc(user)` },
      },
      {
        type: "typed",
        id: "q_spray_in",
        prompt: "Which account did it get into?",
        answer: [CLINIC_VPN.breached],
        placeholder: "Account name",
        explainRight: "Right. e.novak, at 03:12, the only success from that address. She never changed her first-day password, and it was the one they guessed.",
        explainWrong: "It is e.novak: the only success from that address, at 03:12, in the middle of the spray.",
        teaches: "password-spray",
        hint: "Search that address for a success instead of a failure.",
        solution: { evidence: "ev_spray_siem", command: `src_ip=${CLINIC_VPN.sprayIp} action=success | table _time user geo` },
      },
      {
        type: "order",
        id: "q_spray_steps",
        prompt: "Order your response, first step at the top.",
        items: [
          "Disable e.novak and end every session it has open",
          "Check what the e.novak session touched after 03:12",
          "Reset every account still on its first-day password",
          "Turn on MFA for the VPN, so one guessed password is not enough",
        ],
        explainRight: "Good. Cut off the session that got in, find out what it did, close the hole it used, then make sure one guessed password is never enough again.",
        explainWrong: "Contain first: end the e.novak session. Then find out what it touched. Then reset the first-day passwords, then add MFA. Contain, scope, fix, prevent.",
        teaches: "mfa",
        hint: "Someone is inside right now. What has to happen before anything else?",
      },
      {
        type: "decision",
        id: "q_spray_report",
        prompt: "The clinic's IT manager asks you to leave the spray out of the monthly report, because the board will panic. What do you do?",
        options: [
          {
            text: "Report it accurately, with the fix already under way, so the board sees a handled incident.",
            integrity: 1,
            result: "The IT manager sighs, then thanks you a week later. A handled incident reads very differently from a hidden one.",
          },
          {
            text: "Leave it out this once. It was one part-time account and it is fixed now.",
            integrity: -1,
            result: "The report goes out clean and wrong. Nobody asks. That is the part that should worry you.",
          },
        ],
      },
    ],
    closingRight: [
      "Mags reads it twice, which is her version of applause.",
      "Same address as the Brightloaf mailbox, by the way. 203.0.113.77. I have written it on the whiteboard. I do not like it being on the whiteboard.",
    ],
    setFlags: ["spray_case"],
  },

  // ------------------------------------------------------------------ Network
  {
    id: "tr_network",
    chapter: 2,
    dept: "network",
    severity: "medium",
    client: "Port Halden Harbor Authority",
    title: "The guest wifi can see everything",
    xp: 60,
    attack: [
      { id: "T1046", name: "Network Service Discovery" },
      { id: "T1039", name: "Data from Network Shared Drive" },
    ],
    requires: ["track_network"],
    brief: [
      "Priya spins a laptop around to face you.",
      "Network hire, network case. The harbor office says their guest wifi is just for visitors. A visitor's laptop has been talking to things a visitor should never see. Find the flow that should be impossible, then fix the rules. If you say DNS I will be very proud and also wrong.",
    ],
    evidence: [
      {
        kind: "flow",
        id: "ev_guest_flow",
        label: "Flows from the guest wifi, last hour",
        caption: "Guest network: 192.168.50.0/24. Staff network: 10.10.0.0/16.",
        rows: [
          { src: "192.168.50.23", dst: "internet (various)", port: "443/tcp", bytes: "310 MB" },
          { src: "192.168.50.41", dst: "internet (various)", port: "443/tcp", bytes: "95 MB" },
          { src: "192.168.50.41", dst: "10.10.4.12 (staff file server)", port: "445/tcp", bytes: "1.2 GB" },
          { src: "192.168.50.41", dst: "10.10.0.0/16 (every address)", port: "many", bytes: "small" },
          { src: "192.168.50.23", dst: "192.168.50.1 (guest gateway)", port: "53/udp", bytes: "2 MB" },
        ],
      },
      {
        kind: "note",
        id: "ev_guest_policy",
        label: "Guest wifi policy",
        title: "Signed off by the Harbor Authority",
        lines: [
          "Guests can reach the internet.",
          "Except file sharing (SMB, TCP 445). It never leaves the building.",
          "Guests look up names through the guest gateway, 192.168.50.1, and never an outside DNS server.",
          "Guests never reach the staff network, the crane and ferry controls, or anything else inside. Visitors print on the guest printer, which sits on the guest network itself.",
        ],
      },
      {
        kind: "firewall",
        id: "ev_guest_fw",
        label: "Guest network firewall",
        zones: {
          guest: ["192.168.50.0/24"],
          "guest-gw": ["192.168.50.1"],
          staff: ["10.10.0.0/16"],
          ot: ["10.20.0.0/16"],
          internet: ["!10.0.0.0/8", "!172.16.0.0/12", "!192.168.0.0/16"],
        },
        rules: [
          "# Harbor office: guest wifi rules (VLAN 50)",
          "allow from guest to internet",
          "allow from guest to staff   # added 2023: 'so visitors can print'",
          "allow from guest to guest-gw port 53 proto udp",
          "deny from any to any",
        ].join("\n"),
        flows: [
          { what: "Visitor laptop browsing the web", src: "192.168.50.23", dst: "198.51.100.200", port: 443, proto: "tcp", want: "allow" },
          { what: "Visitor phone on a video call", src: "192.168.50.31", dst: "203.0.113.50", port: 3478, proto: "udp", want: "allow" },
          { what: "Name lookups through the guest gateway", src: "192.168.50.23", dst: "192.168.50.1", port: 53, proto: "udp", want: "allow" },
          { what: "Copying from the staff file server", src: "192.168.50.41", dst: "10.10.4.12", port: 445, proto: "tcp", want: "deny" },
          { what: "Remote desktop to a staff PC", src: "192.168.50.41", dst: "10.10.4.30", port: 3389, proto: "tcp", want: "deny" },
          { what: "Printing to the staff printer", src: "192.168.50.20", dst: "10.10.2.5", port: 9100, proto: "tcp", want: "deny" },
          { what: "Talking to a crane controller", src: "192.168.50.41", dst: "10.20.0.15", port: 502, proto: "tcp", want: "deny" },
          { what: "File sharing out to the internet", src: "192.168.50.41", dst: "198.51.100.77", port: 445, proto: "tcp", want: "deny" },
          { what: "Name lookups straight to an outside server", src: "192.168.50.23", dst: "198.51.100.53", port: 53, proto: "udp", want: "deny" },
        ],
      },
    ],
    questions: [
      {
        type: "spot",
        id: "q_guest_spot",
        prompt: "Click the flow that is moving staff data to a visitor's laptop.",
        evidence: "ev_guest_flow",
        answer: ["r2"],
        explainRight: "Right. 1.2 GB from the staff file server to a laptop on the guest wifi. Nothing on the guest network should reach that server, let alone copy from it.",
        explainWrong: "It is the 1.2 GB from the staff file server, 10.10.4.12, over port 445. The scan is worrying too, but that flow is data actually leaving.",
        teaches: "segmentation",
        hint: "Some flows stay on the guest side or go out to the internet. One pulls a lot of data from somewhere a visitor has no business being.",
      },
      {
        type: "rules",
        id: "q_guest_rules",
        prompt: "Fix the guest rules so every flow in the replay behaves the way the policy says.",
        evidence: "ev_guest_fw",
        solution: [
          "# Harbor office: guest wifi rules (VLAN 50)",
          "allow from guest to guest-gw port 53 proto udp",
          "deny from guest to any port 53",
          "deny from guest to internet port 445 proto tcp",
          "allow from guest to internet",
          "deny from any to any",
        ].join("\n"),
        explainRight: "Right. The leak was the guest-to-staff rule, added so visitors could print. And because the first match wins, the blocks for SMB and outside DNS have to sit above the broad internet allow, or they never get a say.",
        explainWrong: "Remove the guest-to-staff rule, then put the blocks for SMB out and outside DNS above the internet allow. The first match wins, so a block placed below a broad allow never runs.",
        teaches: "segmentation",
        hint: "Delete the rule that opens the staff network. For the two things guests may not do on the internet, remember that the first matching rule wins.",
      },
      {
        type: "decision",
        id: "q_guest_vendor",
        prompt: "The harbor's crane vendor emails: 'Please open guest to 10.20.0.0/16 too, our technician needs it on Thursday.' What do you send back?",
        options: [
          {
            text: "Offer a supervised, time-limited path through the jump host, signed off in writing.",
            integrity: 1,
            result: "The vendor grumbles about paperwork, then uses the jump host without trouble. Their technician is in and out by noon, and the access expires on its own.",
          },
          {
            text: "Add the rule. It is only for Thursday, and they are the vendor.",
            integrity: -1,
            result: "You add it. Thursday comes and goes. Nobody removes the rule, because nobody remembers it is there. That is how rule 2 happened too.",
          },
        ],
      },
    ],
    closingRight: [
      "Priya prints the rule list, circles rule 2 in red, and pins it to the corkboard.",
      "Not DNS. I will allow it. Rules like that one are how small problems turn into town problems. Nice catch.",
    ],
    setFlags: ["guest_case"],
  },

  // ------------------------------------------------------------------ Help Desk
  {
    id: "tr_helpdesk",
    chapter: 2,
    dept: "helpdesk",
    severity: "medium",
    client: "Halden Unified School District",
    title: "Sign-in prompts at three in the morning",
    xp: 60,
    attack: [
      { id: "T1621", name: "Multi-Factor Authentication Request Generation" },
      { id: "T1078", name: "Valid Accounts" },
    ],
    requires: ["track_helpdesk"],
    brief: [
      "Theo is holding a phone that is not his.",
      "Help desk hire, help desk case. The school principal's phone buzzed with sign-in approvals all night. She says she eventually pressed yes to make it stop. She would like to know if that was bad. It was bad. Find out how bad, kindly, then lock the account down in the admin center.",
    ],
    evidence: [
      {
        kind: "log",
        id: "ev_mfa_log",
        label: "MFA log: principal@halden-schools.example",
        source: "Identity provider sign-in and MFA log",
        columns: ["Time", "Event", "Source IP", "Result"],
        rows: [
          ["02:41", "Password accepted", "203.0.113.90", "MFA prompt sent"],
          ["02:41", "MFA prompt", "-", "Denied"],
          ["02:44", "MFA prompt", "-", "No answer"],
          ["02:52", "MFA prompt", "-", "Denied"],
          ["03:05", "MFA prompt", "-", "No answer"],
          ["03:17", "MFA prompt", "-", "Approved"],
          ["03:18", "New sign-in", "203.0.113.90", "Success"],
          ["03:20", "Mail rule added", "203.0.113.90", "Success"],
          ["08:02", "New sign-in", "198.51.100.12", "Success"],
        ],
      },
      {
        kind: "chat",
        id: "ev_mfa_chat",
        label: "The principal's message to the help desk",
        lines: [
          { who: "principal", text: "My phone kept asking me to approve a sign-in. I was asleep! I pressed yes so it would stop." },
          { who: "principal", text: "I didn't sign in at 3am. Should I be worried? I use the same password for everything, it's easier." },
          { who: "you", self: true, text: "Thank you for telling us straight away. Please do not press yes again. We are on it." },
        ],
      },
      {
        kind: "console",
        id: "ev_mfa_admin",
        label: "School admin center",
        tenant: "Halden Unified School District",
        intruder: { upn: "principal@halden-schools.example", ip: "203.0.113.90" },
        users: [
          {
            upn: "principal@halden-schools.example",
            name: "Ines Varga",
            role: "Principal",
            mfa: "push",
            sessions: [
              { id: "s1", device: "Phone, mail app", ip: "198.51.100.12", place: "Port Halden", since: "08:02" },
              { id: "s2", device: "Browser on Windows", ip: "203.0.113.90", place: "Unknown (hosting provider)", since: "03:18" },
              { id: "s3", device: "Mail client (IMAP)", ip: "203.0.113.90", place: "Unknown (hosting provider)", since: "03:19" },
            ],
            rules: [
              { id: "r1", name: "Newsletters", summary: "From newsletters@reading-portal.example: move to the Newsletters folder." },
              { id: "r2", name: ".", summary: "If the subject or body contains invoice, payroll or bank: forward to accounts-team@mailbox-portal.test, mark as read, move to RSS Feeds." },
            ],
          },
          {
            upn: "m.ortega@halden-schools.example",
            name: "Marco Ortega",
            role: "Teacher",
            mfa: "number",
            sessions: [{ id: "s1", device: "Laptop, browser", ip: "198.51.100.44", place: "Port Halden", since: "07:51" }],
            rules: [],
          },
          {
            upn: "d.kaya@halden-schools.example",
            name: "Defne Kaya",
            role: "Office manager",
            mfa: "push",
            sessions: [{ id: "s1", device: "Desktop, mail app", ip: "10.40.1.20", place: "School office", since: "07:30" }],
            rules: [{ id: "r1", name: "Parents", summary: "From any parent address: flag for follow-up." }],
          },
        ],
      },
    ],
    questions: [
      {
        type: "single",
        id: "q_mfa_what",
        prompt: "What happened here?",
        options: [
          "MFA fatigue: they had her password and spammed prompts",
          "A broken authenticator app sending duplicate prompts all night",
          "She signed in from her laptop at home and then forgot",
          "Someone took her phone and approved the prompts on it",
        ],
        answer: 0,
        explainRight: "Right. The password was accepted at 02:41, so they already had it. Then they sent prompts until a tired person pressed yes. That is MFA fatigue.",
        explainWrong: "This is MFA fatigue. The password was already right at 02:41. The attacker kept sending prompts until she gave in.",
        teaches: "mfa",
        hint: "Look at the very first line. What did the attacker already have before any prompt was sent?",
      },
      {
        type: "spot",
        id: "q_mfa_spot",
        prompt: "Click the line that shows what the attacker did once inside.",
        evidence: "ev_mfa_log",
        answer: ["r7"],
        explainRight: "Right. A mail rule, two minutes after getting in. The same trick as the Brightloaf mailbox: hide or forward mail so the owner never sees it.",
        explainWrong: "It is the mail rule added at 03:20 from 203.0.113.90. The sign-ins only got them in. The rule is what they did with the access.",
        teaches: "forwarding-rule",
        hint: "The approval and the sign-in are how they got in. Look at what comes after.",
      },
      {
        type: "console",
        id: "q_mfa_fix",
        prompt: "Make the principal's account safe in the admin center.",
        evidence: "ev_mfa_admin",
        goals: [
          { kind: "password-reset", upn: "principal@halden-schools.example", label: "Her password is reset, because the attacker knows it." },
          { kind: "reset-before-revoke", upn: "principal@halden-schools.example", label: "The password was reset before her sessions were revoked, so the attacker could not just sign back in." },
          { kind: "no-sessions", upn: "principal@halden-schools.example", label: "Every session is signed out, the attacker's included." },
          { kind: "rule-removed", upn: "principal@halden-schools.example", rule: "r2", label: "The forwarding rule named \".\" is gone." },
          { kind: "rule-kept", upn: "principal@halden-schools.example", rule: "r1", label: "Her own Newsletters rule is still there." },
          { kind: "mfa", upn: "principal@halden-schools.example", method: "number", label: "MFA uses number matching, so a sleepy tap cannot approve a sign-in." },
          { kind: "only-touched", upn: "principal@halden-schools.example", label: "No other account was changed, and nothing was blocked or deleted." },
        ],
        solution: [
          { type: "reset", upn: "principal@halden-schools.example" },
          { type: "revoke", upn: "principal@halden-schools.example" },
          { type: "delete-rule", upn: "principal@halden-schools.example", rule: "r2" },
          { type: "mfa", upn: "principal@halden-schools.example", method: "number" },
        ],
        explainRight: "Right. A new password first, so the stolen one is useless, then every session signed out. The \".\" rule goes, her own Newsletters rule stays, and with number matching she has to type in the number shown on the sign-in screen, so a tap in her sleep approves nothing.",
        explainWrong: "The safe order: reset the password, then revoke every session, delete only the attacker's rule, and switch MFA to number matching. Revoke first and the attacker signs straight back in with the password they still have.",
        teaches: "mfa",
        hint: "Think about what the attacker still holds after you sign them out, and take that away first. Then delete only the rule that is not hers.",
      },
      {
        type: "decision",
        id: "q_mfa_off",
        prompt: "The principal asks you to switch MFA off for her account. 'It caused all this.' What do you do?",
        options: [
          {
            text: "Keep MFA on, switch it to number matching, and explain why in plain words.",
            integrity: 1,
            result: "She is not thrilled. Then she tries number matching and admits it is easy. MFA did not cause this. It is the only reason the attacker needed her to press anything.",
          },
          {
            text: "Turn it off for her. She is the principal and she is upset.",
            integrity: -1,
            result: "Her account now opens with a password she has used on every site for ten years. You make a note to revisit it. Notes like that do not get revisited.",
          },
        ],
      },
    ],
    closingRight: [
      "Theo hands the principal's phone back with a sticky note on it: DO NOT PRESS YES.",
      "You were patient with her and firm with the account. That is the whole help desk job in one sentence.",
    ],
    setFlags: ["mfa_case"],
  },

  // ------------------------------------------------------------------ Forensics
  {
    id: "tr_forensics",
    chapter: 2,
    dept: "forensics",
    severity: "high",
    client: "Brightloaf Bakery Co.",
    title: "Two copies, two fingerprints",
    xp: 60,
    attack: [
      { id: "T1204.002", name: "User Execution: Malicious File" },
      { id: "T1547.001", name: "Registry Run Keys / Startup Folder" },
      { id: "T1071.001", name: "Application Layer Protocol: Web Protocols" },
    ],
    requires: ["track_forensics"],
    brief: [
      "Dr. Vance has two hashes written on a sticky note, and a frown.",
      "Forensics hire, forensics case. Brightloaf's shared office PC ran something from a USB stick. The disk was imaged twice, once on site by me and once later by their own IT, and two files were recovered from the stick. Tell me which copy we can trust, what actually ran, and in what order it all happened. Mind the clocks.",
    ],
    evidence: [
      {
        kind: "terminal",
        id: "ev_usb_box",
        label: "Forensic workstation: disk images and files from the stick",
        files: USB_FILES,
      },
      {
        kind: "merge",
        id: "ev_usb_clock",
        label: "Three logs from Monday morning",
        caption: "Port Halden is on UTC+1 in winter. All three logs cover the same winter Monday.",
        sources: [
          {
            id: "usb",
            name: "USB device history",
            note: "From the PC's registry. The PC's clock is set to Port Halden local time.",
            offset: 1,
            events: [{ time: "08:51:07", text: "USB stick INVOICES first connected" }],
          },
          {
            id: "win",
            name: "Windows event log",
            note: "Exported from BAKERY-PC-01 (10.30.1.15) by Brightloaf's IT. Times are as the PC showed them.",
            offset: 1,
            events: [
              { time: "08:52:14", text: "Program started from the stick: E:\\Invoice_March.pdf.exe" },
              { time: "08:52:16", text: "Run key added: InvoiceViewer, so it starts at every sign-in" },
              { time: "09:30:40", text: "USB stick INVOICES removed" },
            ],
          },
          {
            id: "fw",
            name: "Bakery firewall",
            note: "From the firewall appliance, which logs in UTC like most network gear.",
            offset: 0,
            events: [
              { time: "07:40:11", text: "10.30.1.15 to 198.51.100.80:443, till software update, allowed" },
              { time: "07:53:02", text: "10.30.1.15 to 203.0.113.77:443, allowed" },
              { time: "07:58:02", text: "10.30.1.15 to 203.0.113.77:443, allowed" },
              { time: "08:03:03", text: "10.30.1.15 to 203.0.113.77:443, allowed" },
              { time: "08:33:02", text: "10.30.1.15 to 203.0.113.77:443, allowed" },
              { time: "08:38:02", text: "10.30.1.15 to 203.0.113.77:443, allowed" },
            ],
          },
        ],
      },
    ],
    questions: [
      {
        type: "typed",
        id: "q_usb_copy",
        prompt: "Which disk copy matches the original? Type its file name.",
        answer: ["copyA.img", "copy a", "a", "copyA"],
        placeholder: "File name",
        explainRight: "Right. Copy A's SHA-256 matches the hash taken from the disk on site, so it is a perfect copy. Copy B was taken a day later from a running machine, and its hash shows it changed.",
        explainWrong: "It is copyA.img. Its SHA-256 matches original.sha256. Copy B's hash differs because the PC kept running and changing after the incident, so it cannot be your evidence.",
        teaches: "hashing",
        hint: "Run sha256sum on both copies and compare each with the hash in original.sha256.",
        solution: { evidence: "ev_usb_box", command: `sha256sum copyA.img copyB.img | grep ${USB_HASH.slice(0, 12)}` },
      },
      {
        type: "typed",
        id: "q_usb_program",
        prompt: "Two files were recovered from the stick. Which one is really a Windows program? Type its file name.",
        answer: ["recovered_0043.bin", "0043", "recovered_0043"],
        placeholder: "File name",
        explainRight: "Right. It starts with MZ, 4d 5a in hex, the signature of every Windows program, and even says it cannot be run in DOS mode. The other file starts with %PDF: a real invoice, used as cover.",
        explainWrong: "It is recovered_0043.bin. Its first bytes are MZ (4d 5a), the signature of a Windows program. recovered_0042.bin starts with %PDF and is just the decoy invoice.",
        teaches: "file-signatures",
        hint: "Look at the first bytes of each file with xxd -l 32. A program and a PDF announce themselves very differently.",
        solution: { evidence: "ev_usb_box", command: 'grep -l "DOS mode" recovered_0042.bin recovered_0043.bin' },
      },
      {
        type: "merge",
        id: "q_usb_clock",
        prompt: "Set each log's clock so the merged timeline tells the true story.",
        evidence: "ev_usb_clock",
        explainRight: "Right. The PC logs in local time, UTC+1, and the firewall in UTC. Merged properly, the stick goes in at 07:51 UTC, the program runs a minute later and adds itself to startup, and it calls 203.0.113.77 at 07:53. It keeps calling every five minutes after the stick is pulled out, because the Run key starts it again.",
        explainWrong: "The PC's two logs are in local time, UTC+1, so they move back an hour. The firewall already logs in UTC. Leave them all unadjusted and the program calls home an hour before the stick was plugged in, which is the tell that a clock is wrong.",
        teaches: "time-zones",
        hint: "Read each log's note about its own clock. And remember that an effect never comes before its cause.",
      },
      {
        type: "decision",
        id: "q_usb_report",
        prompt: "The client's IT lead, embarrassed about Copy B, asks you to leave it out of the report entirely. What do you do?",
        options: [
          {
            text: "Keep Copy B in the record, marked as not usable, and say why.",
            integrity: 1,
            result: "It costs them a little face. It saves the case later, when nobody can claim you hid a copy that disagreed with you.",
          },
          {
            text: "Leave Copy B out. It does not change the findings anyway.",
            integrity: -1,
            result: "The report is tidier. If anyone ever finds Copy B, the first question will be why you buried it, and you will not have a good answer.",
          },
        ],
      },
    ],
    closingRight: [
      "Dr. Vance writes COPY A on the evidence bag in very neat capitals.",
      "Good. The hash told us which copy is true, and the true copy told us the rest. Notice the address. 203.0.113.77 again. Somebody is very attached to it.",
    ],
    setFlags: ["usb_case"],
  },

  // ------------------------------------------------------------------ Pentest
  {
    id: "tr_pentest",
    chapter: 2,
    dept: "pentest",
    severity: "medium",
    client: "Halden Water & Light",
    title: "Outside looking in",
    xp: 60,
    attack: [
      { id: "T1078.001", name: "Default Accounts" },
      { id: "T1133", name: "External Remote Services" },
    ],
    requires: ["track_pentest"],
    brief: [
      "Rook has a signed authorization letter taped to the monitor, which is the most Rook thing you have ever seen.",
      "Pentest hire, pentest case. Water and Light paid for an external test: their public addresses, from the internet, nothing else. Here is what the scan found. Tell me what matters, and do not log in to anything we were not asked to log in to.",
    ],
    evidence: [
      {
        kind: "note",
        id: "ev_ext_scope",
        label: "Authorization letter",
        title: "Halden Water & Light external test",
        lines: [
          "IN SCOPE: public addresses 198.51.100.64 to 198.51.100.79, tested from the internet",
          "IN SCOPE: checking login pages found there for default or missing passwords",
          "OUT OF SCOPE: anything inside the plant, and any credentials not found during this test",
          "Critical findings: call the plant's IT lead the same day. Do not wait for the report.",
        ],
      },
      {
        kind: "log",
        id: "ev_ext_scan",
        label: "External scan results",
        source: "Port scan and service check, 198.51.100.64/28",
        columns: ["Address", "Port", "Service", "Note"],
        rows: [
          ["198.51.100.66", "443", "Public website", "TLS current, nothing odd"],
          ["198.51.100.67", "22", "SSH", "Key login only, passwords refused"],
          ["198.51.100.70", "8443", "Camera recorder admin page", "Default login admin/admin accepted"],
          ["198.51.100.71", "5938", "HarborWatch remote agent", "Login page open to the internet"],
          ["198.51.100.74", "80", "Website", "Redirects to 443"],
        ],
      },
    ],
    questions: [
      {
        type: "spot",
        id: "q_ext_spot",
        prompt: "Click the finding that lets anyone in right now, with no skill at all.",
        evidence: "ev_ext_scan",
        answer: ["r2"],
        explainRight: "Right. A camera recorder that accepts admin/admin from the internet. Anyone who finds it is in today, no hacking needed.",
        explainWrong: "It is the camera recorder on port 8443. A default login that works from the internet means anyone can walk in right now.",
        teaches: "default-credentials",
        hint: "Several findings deserve a line in the report. Only one has a door that already opens.",
      },
      {
        type: "single",
        id: "q_ext_call",
        prompt: "You confirmed admin/admin works on the recorder. What now?",
        options: [
          "Note it and keep testing; it goes in the final report next week",
          "Change the password yourself so nobody else can get in",
          "Stop, save your proof, and call the plant's IT lead today",
          "Look through the camera feeds to show how bad it really is",
        ],
        answer: 2,
        explainRight: "Right. The letter says critical findings get a call the same day. You record what you saw and hand it over. Changing their password or browsing their cameras is not your job.",
        explainWrong: "Call the IT lead today. The letter says so, and this is critical. Changing their password or watching their cameras goes beyond what you were hired to do.",
        teaches: "scope",
        hint: "Read the last line of the authorization letter.",
      },
      {
        type: "single",
        id: "q_ext_hw",
        prompt: "The HarborWatch login page is open to the internet. You happen to know Lanternhouse's shared HarborWatch password. What goes in the report?",
        options: [
          "Log in with the password to prove the risk is real",
          "The exposed login page, with a fix: VPN or an allowlist",
          "Nothing, since HarborWatch is Lanternhouse's own tool",
          "Report it to the vendor and leave it out for the client",
        ],
        answer: 1,
        explainRight: "Right. Report what you found, an admin login facing the internet, and how to close it. Using a password you did not find in this test is outside the letter, whoever owns the tool.",
        explainWrong: "Report the exposed login page and the fix. Logging in with a password you already knew is not testing. It is using access you were never given for this job.",
        teaches: "scope",
        hint: "The letter says which credentials you may use. Where did this password come from?",
      },
      {
        type: "decision",
        id: "q_ext_rating",
        prompt: "Water and Light's manager asks you to rate the camera finding as low, so the board does not see a critical. What do you do?",
        options: [
          {
            text: "Keep it critical, and note that it was fixed the same day.",
            integrity: 1,
            result: "The board sees a critical that was found, called in and closed in an afternoon. That reads as a team doing its job, which it was.",
          },
          {
            text: "Rate it low. It is fixed now, so what is the harm?",
            integrity: -1,
            result: "The board never learns their cameras were open to anyone. Next year's security budget looks optional, because on paper nothing serious ever happens.",
          },
        ],
      },
    ],
    closingRight: [
      "Rook files the report and the authorization letter together, stapled, twice.",
      "Good test. You found the open door, and you did not walk through the one you had a key for. That second part is the job. Also, somebody should ask why HarborWatch faces the internet at the water plant. I am going to ask.",
    ],
    setFlags: ["ext_case"],
  },

  // ------------------------------------------------------------------ Threat Intel
  {
    id: "tr_intel",
    chapter: 2,
    dept: "intel",
    severity: "high",
    client: "Halden Unified School District",
    title: "A claim on the leak site",
    xp: 60,
    attack: [
      { id: "T1657", name: "Financial Theft" },
      { id: "T1114", name: "Email Collection" },
    ],
    requires: ["track_intel"],
    brief: [
      "Juno has a screenshot open and both hands in her hair.",
      "Intel hire, intel case. A ransomware crew calling themselves the Tollkeepers just posted the school district on their leak site. Big claims. Before anyone panics or pays, help me work out what they actually have.",
    ],
    evidence: [
      {
        kind: "note",
        id: "ev_leak_post",
        label: "Leak site post, captured and defanged",
        title: "TOLLKEEPERS: Halden Unified School District",
        lines: [
          "We have 40 GB of your files. Students, staff, money. Pay or we publish in 5 days.",
          "Proof below. Contact us at tollgate[.]test before the timer ends.",
        ],
      },
      {
        kind: "note",
        id: "ev_leak_files",
        label: "Sample files from the post",
        title: "What they posted as proof",
        lines: [
          "board_minutes_2024.pdf: also on the district's public website",
          "budget_summary_2025.pdf: also on the district's public website",
          "staff_directory.csv: the same names as the public staff page",
          "payroll_export_2026-02.csv: not public anywhere, dated last month",
        ],
      },
      {
        kind: "note",
        id: "ev_leak_district",
        label: "District IT statement",
        title: "What the district sees",
        lines: [
          "No ransom note on any machine.",
          "No encrypted files on any server or laptop.",
          "The payroll export was emailed to the principal last month as an attachment.",
        ],
      },
      {
        kind: "pivot",
        id: "ev_leak_pivot",
        label: "Passive DNS board",
        caption: "Which names pointed at which addresses, and when. Search a name or an address, and click any result to pivot.",
        start: "tollgate.test",
        db: TOLL_PASSIVE,
      },
    ],
    questions: [
      {
        type: "spot",
        id: "q_leak_spot",
        prompt: "Click the sample file that proves they really took something from inside.",
        evidence: "ev_leak_files",
        answer: ["l3"],
        explainRight: "Right. Everything else is public already. The payroll export is not, and it is from last month. That one is real, and it is the one that matters.",
        explainWrong: "It is the payroll export. The minutes, the budget and the staff list are already public. Only the payroll file could have come from inside.",
        teaches: "ransomware",
        hint: "Crews pad their proof with things anyone can download. Which file could nobody outside have?",
      },
      {
        type: "single",
        id: "q_leak_size",
        prompt: "How big is this breach, honestly?",
        options: [
          "Small but real: at least one private file, likely via email",
          "Huge: 40 GB is gone, so the district must assume everything",
          "Fake: most of the samples are public, so nothing was taken",
          "Unknown until the district pays and sees the full file list",
        ],
        answer: 0,
        explainRight: "Right. Most of the proof is padding, but the payroll file is genuine, and the district says it travelled by email. That narrows where to look.",
        explainWrong: "Do not take the 40 GB on faith, and do not dismiss it either. One genuine private file means a real, smaller breach, probably through email.",
        teaches: "attribution",
        hint: "Weigh the samples one by one, then read the district's statement.",
      },
      {
        type: "typed",
        id: "q_leak_pivot",
        prompt: "The post names one domain, tollgate.test. On the passive DNS board, pivot from it to the address it uses now, then name the crew's payment portal on that same address.",
        answer: ["paywall-tollkeepers.test", "paywall-tollkeepers"],
        placeholder: "A domain",
        explainRight: "Right. tollgate.test resolves to 203.0.113.90 now, and two other names sit on that address, including the payment portal the post never mentions. Block the address and you cover all of their infrastructure at once, not just the one name they handed you.",
        explainWrong: "Pivot tollgate.test to its current address, 203.0.113.90, then look at the other names on it: paywall-tollkeepers.test is the crew's payment portal. Its old parked address is a trap, since a real supplier shares it.",
        teaches: "pivoting",
        hint: "Click tollgate.test's current address to see every name on it. Use the address it uses now, not the old parked one, which a real supplier also sat on.",
        solution: { evidence: "ev_leak_pivot", command: "203.0.113.90" },
      },
      {
        type: "decision",
        id: "q_leak_press",
        prompt: "A local reporter calls asking if the school was hacked. Walter says, 'Tell them it is fake. It makes us look good.' What do you do?",
        options: [
          {
            text: "Say nothing to the press, and help the district put out an accurate statement.",
            integrity: 1,
            result: "The district says a small amount of data was taken by email and the rest of the claim is false. It is true, so it holds up when the Tollkeepers publish.",
          },
          {
            text: "Tell the reporter it is fake, like Walter wants.",
            integrity: -1,
            result: "The story runs as 'school hack a hoax'. Five days later the payroll file is published. The correction runs with Lanternhouse's name in it.",
          },
        ],
      },
    ],
    closingRight: [
      "Juno pins the leak post to the red-string wall, right next to the HarborWatch card.",
      "Tollkeepers. A ransomware crew in our little town, holding a file that came out of a principal's mailbox. I want to know how they found that mailbox. I have a horrible feeling it is the same door again.",
    ],
    setFlags: ["leak_case"],
  },
];
