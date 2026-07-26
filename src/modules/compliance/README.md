# compliance

**Bounded context:** legal acceptance and regulated age verification.

## Owns
`legal_acceptances` (append-only), `age_verifications`

## Depends on
`identity` (user id)

## Publishes (later)
LegalAccepted, AgeVerificationSubmitted, AgeVerificationDecided

## Must not
Gate checkout logic here — `orders` / `catalog` consume verification status via query or event.

## Notes
Liquor age gate (423) reads verification status; documents are encrypted at app layer.
