# Document Quality Checklist

Use this reference when a detailed content-quality review is required.

---

# 1. Universal Checklist

For each applicable document check:

| Check | Question |
|---|---|
| Existence | Does the required document exist? |
| Readability | Can the intended reader understand it? |
| Completeness | Are required sections/content present? |
| Accuracy | Are factual claims supported? |
| Internal Consistency | Does the document contradict itself? |
| Cross-Artifact Consistency | Does it agree with authoritative related artifacts? |
| Traceability | Are lifecycle references valid? |
| Implementation Consistency | Does it match actual implementation where relevant? |
| Placeholder Detection | Are unresolved placeholders/template instructions present? |
| Duplicate Content | Is material content accidentally duplicated? |
| Links / References | Are referenced paths/links valid when verifiable? |
| Formatting | Is the structure syntactically/readably valid? |
| Language | Is the content professionally understandable? |
| Security | Does it expose secrets/sensitive information? |

---

# 2. Result Vocabulary

For each check use:

`PASS`

`FAIL`

`NOT_APPLICABLE`

`NOT_VERIFIED`

Overall result must not be PASS when a material required check is FAIL.

---

# 3. Requirements Checklist

Check:

- Metadata
- Business Objective
- Source Traceability
- Current Behavior
- Desired Behavior
- Actors
- In Scope
- Out of Scope
- Functional Requirements
- Business Rules
- NFRs
- Data Requirements
- Integration Requirements
- Error / Edge Cases
- Acceptance Criteria
- Dependencies / Constraints
- Assumptions
- Requirement Traceability
- Open Questions
- Human Decisions
- Approval

Also validate:

```text
Requirements Status: APPROVED
```

only when human approval is actually recorded.

---

# 4. Architecture Checklist

Check:

- approved Requirements baseline
- architectural drivers
- current architecture where applicable
- target architecture
- system context
- technology stack
- components
- data
- interfaces
- security
- reliability
- performance
- observability
- deployment
- configuration
- decisions
- traceability
- risks
- assumptions
- open architecture questions
- Design Review readiness / approval state

---

# 5. Design Review Checklist

Check:

- reviewed baseline
- independent review role
- findings
- permanent DR IDs
- severity
- evidence
- decisions
- architecture-change requirement
- finding statuses
- remediation history
- deferred risks
- final gate
- final decision

Use review-findings rules for state transitions.

---

# 6. Implementation Plan Checklist

Check:

- approved upstream gates
- implementation scope
- TASK IDs
- task objectives
- requirement mappings
- architecture mappings
- DR mappings
- priorities
- waves
- dependencies
- completion criteria
- testing obligations
- security obligations
- documentation obligations
- plan status
- human approval

Required before Step 5:

```text
Implementation Plan Status: READY_FOR_IMPLEMENTATION
Implementation Plan Approval: APPROVED
```

---

# 7. Implementation Log Checklist

Check:

- TASK/remediation identity
- execution state
- upstream traceability
- implementation summary
- files added/modified/removed
- tests
- commands/checks
- completion criteria
- deviations
- known issues
- escalations
- result

Compare material file claims with repository evidence when required.

---

# 8. Code Review Checklist

Check:

- reviewed revision/baseline
- mandatory review areas
- CR IDs
- severity
- evidence
- decisions
- code-change requirement
- remediation status
- independent re-review
- deferred risks
- final gate
- final decision

Ensure final:

```text
Code Review Status: CODE_REVIEW_APPROVED
```

does not contradict unresolved blocking findings.

---

# 9. Verification Checklist

Check:

- verified baseline
- Code Review baseline
- VC identifiers
- unit evidence
- integration evidence
- build/static evidence
- Requirements verification
- AC verification
- security
- regression
- migration/compatibility
- final output documents
- VR findings
- remediation/reverification history
- blocked/not-verified items
- final verification gate
- final decision

Ensure:

```text
Verification Status: VERIFICATION_PASSED
```

is supported by required evidence.

---

# 10. Final Product Documentation Checklist

For README/API/runbook/user docs check:

- document exists
- intended scope is clear
- commands are real
- paths are real
- environment variables are real
- APIs match implementation
- limitations are current
- no stale TODOs remain
- no secrets appear
- examples are safe
- formatting is readable

---

# 11. Changelog Checklist

Check:

- correct changelog mechanism used
- appropriate unreleased/current section
- verified behavior only
- no duplicate entry
- no invented release/version
- meaningful user/reviewer-facing language
- security changes described appropriately
- no secrets
- no unrelated implementation detail

---

# 12. PR Description Checklist

Required sections:

```text
## Summary
## Changes Made
## Test Evidence
## Known Limitations
## Reviewer Checklist
```

Validate every section contains meaningful content.

---

# 13. PR Summary Checklist

Check:

- 2–3 sentences where required
- explains what
- explains why
- matches approved scope
- contains no unsupported claims

---

# 14. PR Changes Made Checklist

Check actual Git diff against the section.

Every material changed file must be:

- individually represented
- or unambiguously represented by an accurate group

No unrelated file should be hidden.

---

# 15. PR Test Evidence Checklist

Check:

- actual Verification evidence
- actual CI evidence where claimed
- actual commands/results
- no fabricated counts
- no stale evidence
- blocked checks not represented as PASS

---

# 16. PR Known Limitations Checklist

Check applicable:

- out of scope
- deferred risks
- accepted limitations
- unavailable optional integrations
- unresolved non-blocking source/output limitation

Do not list normal expected 404/Not Found behavior as a limitation unless it
represents missing functionality.

---

# 17. Reviewer Checklist Checklist

Yes, review the checklist itself.

Ensure:

- each item starts unchecked
- items are actionable
- security/test/documentation review included where applicable
- Known Limitations review included
- changelog review included
- no reviewer decision is preselected

---

# 18. Placeholder Patterns

Inspect context around strings such as:

```text
TODO
TBD
FIXME
XXX
PLACEHOLDER
<insert
<replace
your-value-here
example-only
```

Do not automatically fail safe sample configuration values.

Judge context.

---

# 19. Secret Patterns

Be cautious around potential:

- password assignments
- bearer tokens
- API keys
- private key blocks
- database URLs with credentials
- authentication headers

Never copy suspected complete secrets into findings.

---

# 20. Quality Summary Template

```text
Document:
<path/name>

Overall Result:
PASS / FAIL / NOT_VERIFIED

Material Findings:
<count>

Cosmetic Findings:
<count>

Checks:
- Existence:
- Completeness:
- Accuracy:
- Internal Consistency:
- Cross-Artifact Consistency:
- Traceability:
- Placeholder Detection:
- Security:
- Formatting:
- Language:

Owning Specialist:
<agent>

Required Action:
<none / correction / upstream reconciliation>
```

---

# 21. Multi-Document Matrix

```text
| Document | Existence | Completeness | Accuracy | Consistency | Traceability | Placeholders | Security | Formatting | Language | Overall |
|---|---|---|---|---|---|---|---|---|---|---|
```

---

# 22. Final Principle

Do not optimize documents for looking complete.

Optimize them for being:

`accurate + traceable + usable + safe`.