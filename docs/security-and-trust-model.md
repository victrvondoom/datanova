# Security and Trust Model (Campaign 03, Tasks 21–25)

**Implementation:** `engines/trust.ts`, `lineage.ts`, `authz.ts`, `tenant.ts`,
`adversarial.ts`; tests in `__tests__/m5.test.ts`.

## Trust boundaries (T21)

Zones rank internet(0) < dmz(1) < trusted(2) < privileged(3). Crossings carry a
trust delta. Rules: internet entries need `authn` (rate limit warning if
missing); entries into privileged need `encryption` OR service `authn`; flows
toward LOWER trust need `encryption`. A `securityNote` on a connection is a
documented, reviewed exception rendered as an INFO finding — never silently
accepted or silently flagged.

## Data lineage (T22)

Sensitive/pii entities trace
