// The seeded "LinkedIn outreach" pipeline (ADR-0020): an ordered, CRUD-able status
// vocabulary that replaces the old fixed enum. Position 0 is the entry status.
// `Person.status` is a FK into one of these; the operator sets it directly and it is
// decoupled from whether any artifact exists.

export interface PipelineStatusDef {
  id: string;
  name: string;
  position: number;
  // A terminal column ends the active pipeline (Not Interested / Ghosted / On Hold).
  terminal?: boolean;
}

export const pipeline = {
  slug: "linkedin-outreach",
  name: "LinkedIn outreach",
};

export const pipelineStatuses: PipelineStatusDef[] = [
  { id: "ps-cold", name: "Cold", position: 0 },
  { id: "ps-cr-sent", name: "CR Sent", position: 1 },
  { id: "ps-cr-accepted", name: "CR Accepted", position: 2 },
  { id: "ps-fu-sent", name: "FU Sent", position: 3 },
  { id: "ps-conversation", name: "Conversation", position: 4 },
  { id: "ps-discovery", name: "Discovery call", position: 5 },
  { id: "ps-proposal", name: "Proposal Sent", position: 6 },
  { id: "ps-not-interested", name: "Not Interested", position: 7, terminal: true },
  { id: "ps-ghosted", name: "Ghosted", position: 8, terminal: true },
  { id: "ps-on-hold", name: "On Hold", position: 9, terminal: true },
];

export function statusById(id: string): PipelineStatusDef | undefined {
  return pipelineStatuses.find((status) => status.id === id);
}
