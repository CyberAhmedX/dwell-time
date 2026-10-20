A cozy-to-dark cybersecurity career simulation.

Play online: https://cyberahmedx.github.io/dwell-time/

Or download **dwell-time.html** below and open it in any browser. It is fully self-contained and runs offline, no install required.

## What's new in v2.2.1

- **Cases that change between runs.** Some cases are now generated fresh each run, so the addresses, account names and logs are not the same twice. Replaying means reading the evidence again, not recalling an answer.
- **New-player onboarding.** The first time you meet a hands-on tool (SIEM, terminal, firewall, admin console, timeline builder, pivot board, CVSS calculator, detection rules, reports and more), a one-line tip shows how to drive it, with an example.
- **Skip scenes you have already read.** A new setting steps past story you have seen before on a replay. It never skips a scene with a choice.
- **A "Why?" button.** Long answer explanations fold behind a tap, so feedback stays short at a glance.
- **A "Stuck?" link in every case**, and judgment-call choices now show their weight the moment you make them.

## Fixes

- Fixed a SIEM search that could crash on an unusually long or malformed value. Added adversarial tests so the terminal, SIEM, firewall, detection-rule and request tools all handle bad input gracefully instead of breaking.
- Fixed a late-game decision that could still be offered after it no longer changed the outcome, and made an earlier choice actually carry through to how the story ends.
- Tidied unused story flags, added a missing test for the finale timer, and removed an unused unsafe HTML code path.

**Full changelog:** https://github.com/CyberAhmedX/dwell-time/compare/v2.1.0...v2.2.1
