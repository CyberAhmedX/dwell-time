# Dwell Time 2.0: design

Status: draft for approval. Nothing here is built yet.

## The problem

The team you pick only changes the interview and one case in chapter two. Everything else is the same for every team, and almost every case is multiple choice. A forensics hire spends most of the game doing other teams' jobs by picking options from a list.

## The eight rules

1. **Same length.** A run stays about as long as it is now. Cases take 3 to 5 minutes, and chapters about 15.
2. **Every case is a different activity.** No two cases in a row use the same format.
3. **Your work feeds the story.** Things you find show up later. Things you miss make later cases harder.
4. **Change the pace.** Mix calm puzzles, timed pressure and people moments.
5. **Your team owns the finale.** In the live incident, you do your team's part.
6. **Each team finds a secret.** One piece of the truth only that team can see.
7. **Small surprises.** A red herring, a false alarm that turns out to be real, a funny case.
8. **Do the job, don't answer about it.** The main challenge of every case is hands-on. Multiple choice stays only for judgment calls and quick checks.

## Shape of a run

Each chapter has shared story cases that everyone plays, plus one case for your own team.

| Chapter | Shared (everyone) | Your team | Pace |
|---|---|---|---|
| 1 Fair Weather | Bakery phishing email | First day: learn your team's tool | Calm |
| 2 Overcast | Bakery mailbox, school DNS | Your team's first real case (exists today) | Investigating |
| 3 Squall | Clinic laptop and chain of custody | The clinic breach, through your team's eyes. You find the truth your own way, and your team's secret | Slow, heavy |
| 4 Gale | Juno's wall: everyone's findings, pinned | Your team's temptation to cross a line | Tense |
| 5 Storm Surge | The containment and evidence choices | Live incident: your team's part, against a clock | Urgent |

That is 10 main cases per run, against 9 today.

Today's forensics timeline (chapter 3) becomes the forensics team's chapter 3 case. Today's harbor pentest (chapter 4) becomes the pentest team's chapter 4 case. Every other team gets its own version of those beats.

## Hands-on tools

**Terminal (everyone).** A simulated shell over each case's files. It supports `ls`, `cat`, `head`, `tail`, `grep` (with `-i -c -v`), `sort`, `uniq -c`, `wc -l`, `cut`, `base64 -d`, `sha256sum` and pipes. Any command that turns up the evidence counts. There are a few hidden commands for fun.

The shared cases move from multiple choice to the terminal:
- Bakery mailbox: `grep` the sign-in log.
- School DNS: count queries per domain with `cut | sort | uniq -c`.
- Clinic laptop: `sha256sum` the original against the copy.

**One signature tool per team:**

- **SOC (Mags): SIEM search.** A small query language: `field=value`, `AND/OR/NOT`, `*`, `| stats count by field`, `| sort`. Later, write a detection rule and test it against attacks and false alarms.
- **Network (Priya): firewall rule editor.** Write ordered allow and deny rules, then replay traffic and watch what passes and what is blocked. It includes subnet (CIDR) checks.
- **Help Desk (Theo): admin console.** Users, sessions, MFA methods, mail rules and password resets. You fix accounts by doing the steps, in the right order. It also has a raw email header view (Received chain, SPF, DKIM, DMARC).
- **Forensics (Imani): timeline builder.** Merge events from sources whose clocks use different time zones. It also has a hex viewer that shows a file's real type from its first bytes.
- **Pentest (Rook): request editor.** Edit an HTTP request, send it, read the response. It also has a scope checker for address ranges and a CVSS calculator.
- **Threat Intel (Juno): pivot board.** Domain to IP to other domains through DNS-history and registration records. It also covers pulling indicators out of a report and defanging them, and mapping behavior to ATT&CK IDs.

## Team storylines

### SOC (Mags): SIEM search
- **Ch1, "Who keeps logging into the coffee machine?"** Learn search on the office's smart coffee machine logs. Gentle and silly.
- **Ch2, password spray** (exists). Rebuilt so you find the spray with `| stats count by src_ip, user`, then the one success.
- **Ch3, "The alerts that never fired."** Search five-year-old HarborWatch logs for the rule that silenced the clinic's alerts.
- **Ch4 temptation.** Walter calls the HarborWatch login alerts "noise" and asks you to suppress them. Hands-on: write a detection rule for shared-account logins from outside, and decide whether to ship the suppression instead.
- **Ch5 live.** Alerts stream in. Find the attacker's new host and session in time, so Mags can kill it.
- **Secret.** The alerts were not misconfigured. Walter's own account switched them off from inside the office, the night of the breach.

### Network (Priya): firewall rules
- **Ch1, "Why is the bakery wifi so slow?"** Learn to filter flows. A till PC is streaming football. Write your first rule.
- **Ch2, guest wifi** (exists). Rebuilt: write the corrected rule set and replay the visitor's traffic.
- **Ch3, "Where did the clinic's data go?"** Trace five-year-old flows from the clinic, through HarborWatch, to the outside.
- **Ch4 temptation.** Walter wants an allow-any rule for HarborWatch "so monitoring survives the storm".
- **Ch5 live.** Cut the attacker off from the control network without cutting the plant's own safety sensors. Block too much and the chlorine readings go dark.
- **Secret.** BRACKISH's traffic and the Tollkeepers' traffic come from different networks. They are two actors, not one.

### Help Desk (Theo): admin console
- **Ch1, "Locked out on day one."** A teacher is locked out. Learn the console: verify the caller, unlock, reset properly.
- **Ch2, MFA fatigue** (exists). Rebuilt: actually sign her out, remove the rule and fix MFA in the console.
- **Ch3, "The clinic's staff are scared."** Clinic staff flood the line after the news. Find the accounts with sessions that should not exist. In the old ticket system you find a ticket from five years ago.
- **Ch4 temptation.** Walter asks you to reset Mags's password quietly, "so I can see what she is telling the regulator".
- **Ch5 live.** Kill lh-admin, revoke every session and switch MFA, while frightened staff keep calling.
- **Secret.** Nadia filed a ticket two days before the breach: "HarborWatch alerts are not reaching my console." Walter closed it as "won't fix".

### Forensics (Imani): timeline builder
- **Ch1, "The cake order that wasn't."** A "PDF" order from a customer. The hex viewer shows `MZ`: it is a program. Learn hex and hashing.
- **Ch2, two copies** (exists). Rebuilt with `sha256sum` and the hex viewer.
- **Ch3, building the timeline** (exists today as multiple choice). Rebuilt: merge the clinic server (UTC), the HarborWatch console (local time) and the VPN log, and get the time zones right.
- **Ch4 temptation.** Walter asks you to move one timestamp in your report, so the breach starts on Nadia's shift.
- **Ch5 live.** Capture what disappears first (memory, network connections) before containment wipes it, so the evidence holds up afterwards.
- **Secret.** A deleted draft on the clinic laptop: Walter's email blaming the junior analyst, written before the investigation had even finished.

### Pentest (Rook): request editor
- **Ch1, "Is it in scope?"** Learn the scope checker and send your first request to the bakery's site. robots.txt lists `/admin`.
- **Ch2, external test** (exists). Rebuilt with the scope checker and the request editor.
- **Ch3, "How did they get in?"** Rebuild the old HarborWatch in the lab and test its login: no lockout, and the shared password still works.
- **Ch4, harbor pentest** (exists). Rebuilt: find the booking bug yourself by changing the id in the request editor. The OT scope temptation stays.
- **Ch5 live.** Under emergency authorization, check which boundary ports still answer the old credential, so the fix is proven.
- **Secret.** The shared password was also on Lanternhouse's own staff wiki, readable by everyone, including the old intern account. Anyone could have had it.

### Threat Intel (Juno): pivot board
- **Ch1, "Defang it."** Pull the indicators out of Theo's phishing write-up, defang them, and make your first pivot from domain to IP.
- **Ch2, leak site** (exists). Rebuilt: pivot from the Tollkeepers' contact domain to their other infrastructure.
- **Ch3, "Who used that address before?"** DNS history for 203.0.113.77 links the mailbox domain, the leak site and an older domain.
- **Ch4 temptation.** A contact offers the login to the Tollkeepers' server, to "take the data back". Hacking back is a crime, whoever the target is.
- **Ch5 live.** Map what the attacker is doing to ATT&CK, predict the next step, and feed Mags a block list in time.
- **Secret.** A week before the first case, BRACKISH registered a domain and tried to warn Lanternhouse about the Tollkeepers. The warning sat unread in a shared inbox.

## How findings carry forward

- Each team case produces one finding (an account, a hash, an address, a domain). It gets pinned on Juno's wall in chapter 4.
- Miss it or botch the case, and the pin is missing. The chapter 4 wall case then has an extra step, and the finale gives you less time.
- Your team's secret, if found, adds a line to your ending and unlocks a Case Files entry in the endings gallery.
- Finding all six secrets across runs earns **Six Sides of the Story**.

## The line you cross in chapter 4

Every team's chapter 4 temptation, if you take it, sets `crossed_line`. Today, crossing scope removes the clean finale option, which forces Dead Water.

**Proposed instead:** crossing the line halves your time in the live finale, because the attacker uses the door you opened. You can still win, but it is much harder. Dead Water then comes from failing the finale, not from one earlier click.

## Timers and accessibility

- Live cases show a clock. They pause while a dialogue line is on screen.
- A **Relaxed timers** setting doubles every timer. Reduced motion is respected throughout.
- Every tool works with a keyboard, and on a phone.

## Build order

1. **Tools:** terminal, then the six team tools, each with unit tests.
2. **Chapter 1:** six first-day cases, plus the shared phishing case rebuilt with raw headers.
3. **Chapters 2 and 3:** existing cases rebuilt as hands-on; six chapter 3 team cases with secrets.
4. **Chapter 4:** the wall with carried-forward pins, and six temptation cases.
5. **Chapter 5:** six live finales, and the finale rule above.
6. **Payoff:** secrets in the endings, Case Files, Six Sides.
7. **Pacing pass, browser tests on every team, release v2.0.**
