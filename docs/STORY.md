# Dwell Time: Story Bible

> **Dwell time** (noun): how long an attacker stays inside a network before anyone notices.

## Premise

Port Halden is a small, rainy harbor town. Its bakeries, schools, clinic, port and water plant all pay the same company to keep them safe: **Lanternhouse Security**, a fourteen-person managed security provider working out of an old harbor-pilot station next to the lighthouse.

You arrive as a new hire. You close tickets, learn the trade and climb the ranks. Then the tickets start to rhyme. A forwarding rule at the bakery. A DNS tunnel at the school. A password spray at the clinic. Same infrastructure every time. Somebody has been inside Port Halden for a long while, and the trail leads back to Lanternhouse.

## The truth (spoilers, for writers only)

1. **Five years ago** St. Brennan's Clinic was breached. Lanternhouse ran its remote management tool, **HarborWatch**, with one shared admin password and no MFA, because Walter Abernathy (the founder) refused to pay for the upgrade.
2. Walter covered it up. He told the clinic the breach was their fault, and he fired the junior analyst on shift that night, **Nadia Sorel**, for "missing the alerts". The alerts never reached her: the HarborWatch console had silenced them. Nadia was blacklisted and never worked in security again.
3. Walter never rotated the shared HarborWatch password.
4. Nadia kept a copy of it. Now, as **BRACKISH**, she is quietly walking through every Lanternhouse client to collect proof that the hole was never fixed. She plans to publish it.
5. She is not alone. To pay for infrastructure she rented access to a ransomware crew, **the Tollkeepers**. They found her tunnels and want more than proof. Their target is **Halden Water & Light**, the town's water plant.
6. Logs show the backdoor account `svc_tidewatch` was created by `w.abernathy`. That is Walter's username, but it was Nadia typing, from Tollkeeper infrastructure, with the password Walter never changed. *A username in a log is not a person.*

## Tone

Cozy first, then colder. Early chapters are warm: coffee, the cat, jokes about printers. Every chapter the weather turns and the office gets darker. The last chapter happens during a storm blackout lit by emergency red lights. Humor never disappears, it just gets quieter.

Rules for all writing:
- No em dashes. Use commas, periods, colons or parentheses.
- Characters talk like people at work, not like brochures. Short lines. Specific details.
- Every technical detail must be something a real analyst would see or do.
- All IPs come from documentation ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) or private ranges. All domains use the reserved `.example` or `.test` TLDs. URLs are defanged (`hxxp`, `[.]`). Nothing in the game points at a real system.
- All people, companies and places are fictional.

## Cast

| Character | Role | Voice |
|---|---|---|
| **You** | New hire, player-named | Whatever you choose |
| **Walter Abernathy** | Founder and CEO | Cardigans, remembers birthdays, warm until cornered |
| **Mags Okafor** | SOC lead | Dry, exact, ex-Navy signals. "Logs don't lie. People summarize them badly." |
| **Theo Lindqvist** | Help Desk lead | Friendly, frazzled, runs the coffee fund, knows every printer by name |
| **Priya Raman** | Network engineer | Blunt, funny, always bets the problem is DNS |
| **Dr. Imani Vance** | Forensics (DFIR) lead | Quiet and precise. Keeps a sourdough starter named Exhibit A |
| **Rook** (Danny Ferreira) | Pentest lead | Hoodie and lockpicks, but the strictest person in the building about scope |
| **Juno Park** | Threat intel | Red-string corkboard, names every threat actor, collects old modems |
| **Celeste Morrow** | GRC and compliance | Deadpan, quotes policy section numbers, carries a label maker |
| **Packet** | Office cat | Chief Morale Officer. Walks on keyboards |
| **Nadia Sorel** | Former analyst, now BRACKISH | Only appears as text in an encrypted chat |

## Clients

- **Brightloaf Bakery Co.**: six-shop bakery chain. Finance team is a target.
- **Halden Unified School District**: underfunded, many shared PCs.
- **St. Brennan's Clinic**: the site of the old breach.
- **Port Halden Harbor Authority**: cranes, ferries, an OT network.
- **Halden Water & Light**: the town's water treatment plant.

## Structure

| Chapter | Title | Weather / light | Focus |
|---|---|---|---|
| Prologue | Application | Bright lobby | Pick a career track, then a real interview |
| 1 | Fair Weather | Sunny morning | Help Desk and SOC basics |
| 2 | Overcast | Grey afternoon | Network and SOC |
| 3 | Squall | Rainy evening, desk lamps | Forensics |
| 4 | Gale | Storm at night, lightning | Pentest and threat intel |
| 5 | Storm Surge | Blackout, emergency lights | Full incident response |
| Epilogue | One of four endings | Depends on you | |

## Choices that matter

| Where | Choice | Effect |
|---|---|---|
| Ch1 | Theo asks you to bulk-close stale tickets unread | Integrity |
| Ch2 | Walter tells you to approve a vendor "allow any" firewall rule | Integrity, or leave a door open for the finale |
| Ch3 | Walter asks you to skip chain of custody | Keeps or breaks the evidence chain |
| Ch3 | An anonymous message arrives. Reply, tell Mags, or tell Walter | Trust with Nadia, integrity, or loyalty |
| Ch4 | Someone suggests testing the out-of-scope OT network | Integrity |
| Ch4 | Walter offers you a promotion to bury the St. Brennan's link | Loyalty or integrity |
| Ch5 | What you do with the evidence | Picks the ending |

## The four endings

1. **The Lighthouse.** You hand everything to the client, the regulator and the National Cyber Response Office. Walter's cover-up comes out, the Tollkeepers are stopped, Nadia faces charges but her name is cleared. Lanternhouse survives under new leadership and you run the SOC. *Needs an unbroken chain of custody.*
2. **Low Tide.** You give the evidence to Nadia and she publishes it. Lanternhouse collapses. The water stays clean. You and a few colleagues start a small co-op security shop on the pier. *Needs Nadia's trust.*
3. **Company Keeper.** You stop the attack and bury the truth. Walter makes you Director of Operations. The office is quiet now and nobody brings their cat. *Always available.*
4. **Dead Water.** The finale goes badly. The Tollkeepers reach the plant, the town is put under a boil-water notice, and somebody needs to take the blame. It is you, the same way it was Nadia. *Happens if the finale response fails. Earlier choices, like the open firewall door or silencing Nadia, make that much more likely.*

## Rank ladder

Probationary Analyst, Analyst I, Analyst II, Senior Analyst, Lead Analyst. The ending sets your final title.
