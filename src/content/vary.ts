import type { Ticket } from "../engine/types";
import { clinicVpnEvents, schoolDnsLog } from "./logs";
import { socSprayTicket } from "./tracks";
import { schoolDnsTicket } from "./tickets";

/**
 * Rebuild a ticket's per-run data from the save's seed. Both the game (when a
 * case is opened) and the e2e bot call this with the same seed, so what is on
 * screen and the expected answers are built from one source and never drift.
 * A ticket with no per-run data is returned unchanged.
 */
export function withRunData(ticket: Ticket, seed: number): Ticket {
  switch (ticket.id) {
    case "tr_soc":
      return socSprayTicket(clinicVpnEvents(seed));
    case "t2_school_dns":
      return schoolDnsTicket(schoolDnsLog(seed));
    default:
      return ticket;
  }
}
