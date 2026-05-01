# Security Specification - Codeathon 2k26

## Data Invariants
1. A Participant record must have a valid email and roll number.
2. A Coordinator record must have a matching coordinator ID.
3. Only authorized administrators (defined in an `admins` collection) can create or update records.
4. Public users can only read specific records if they provide the correct identifying fields (email, rollNo).

## The Dirty Dozen Payloads (Rejection Tests)
1. **Malicious Admin Creation**: Attempt to write to `/admins/` by a non-admin.
2. **Bulk Participant Read**: Attempt to list all participants without filters.
3. **Ghost Participant Creation**: Anonymous user trying to add a "Winner" record.
4. **Identity Spoofing**: User A trying to read User B's certificate by roll number only.
5. **ID Poisoning**: Using a 2KB string as a `participantId`.
6. **Field Injection**: Adding `isVerified: true` to a participant record during an update.
7. **Type Mismatch**: Sending `rollNo` as an integer.
8. **Email Spoofing**: Querying for an admin's email with a fake roll number.
9. **Role Escalation**: Participant trying to update their own role to "Winner".
10. **Resource Exhaustion**: Sending a participant name string of 1MB.
11. **Coordinator Bypass**: coordinatorId left empty but record created.
12. **Insecure List Query**: `db.collection('participants').get()` (should be rejected).

## Rules Logic
- `isValidId(id)`: Length and regex check.
- `isAdmin()`: Check if `request.auth.uid` exists in `/admins/`.
- `isValidParticipant(data)`: Schema validation (types, sizes, required keys).
- `isValidCoordinator(data)`: Schema validation.
- `allow list` on participants: Only if `request.query.limit <= 1` and filtered by `email` and `rollNo`. (Actually Firestore rules don't check query params directly like this, but we can check `resource.data` in the list rule).
