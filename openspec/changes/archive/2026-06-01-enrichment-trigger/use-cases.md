# Use-cases view: out of scope for this change

No new actor or system-boundary goal. This change refines *when* an existing step fires, not who interacts with the system. The relevant interactions - a CRM user optionally enriches a prospect (from its detail, or a batch grid multi-select), or enables an auto-enrich setting - are realized by the `enrichment` and `prospect-list` capabilities and the prototype, not introduced here. The existing CRM-user goal ("find, qualify, and act on prospects") is unchanged.
