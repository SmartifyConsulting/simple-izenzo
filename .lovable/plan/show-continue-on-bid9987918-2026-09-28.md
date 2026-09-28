# Show Continue on BID9987918

## Cause
Continue only shows once the deal has a "both sides cleared" record for each party. When I marked KYC and KYB as passed for this test, I added the four check results but not those two clearance records. Earlier test deals (BID9640523, BID9477215) got them. BID9987918 has none, so the screen still thinks nobody has cleared.

## Fix (test data only, no app changes)
- Add two clearance records for BID9987918, one for the bidder (Izenzo) and one for the counterparty (Hanish1 G). Each has KYC passed and KYB passed, dated now.
- Nothing else changes. Each side's 3-token payment stays as it is, and the gate itself is unchanged.
- After that, Continue should appear next to Exit for both parties and open Legal Agreements.

## Going forward
Whenever I set a test deal's checks to passed, I'll add these two clearance records at the same time, so this gap doesn't happen again.

## Technical details
Insert into `engagement_diligence` for transaction `716854da-d6f9-4453-a012-214a90b50df2`: rows with reviewer_side `bidder` and `counterparty`, kyc_state and kyb_state set to `passed`, cleared_at set to now(). Then check that both rows exist.
