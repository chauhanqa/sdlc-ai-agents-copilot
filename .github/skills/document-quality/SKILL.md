---
name: document-quality
description: >
  Shared content-quality validation procedure for the controlled Agentic SDLC.
  Use this skill when checking requirements documents, architecture or review
  artifacts, implementation documentation, final output documents, changelog
  entries, release notes, or Pull Request content for existence, completeness,
  accuracy, internal consistency, traceability, placeholders, formatting,
  language quality, broken references, sensitive information, and consistency
  with the implemented and verified behavior. This skill evaluates document
  quality but does not silently rewrite another specialist's governed artifact.
---

# Agentic SDLC Document Quality

This skill defines the shared procedure for validating document and textual
artifact quality.

It applies to:

- requirements documents
- architecture documents
- design-review reports
- implementation plans
- implementation logs
- code-review reports
- verification reports
- README and product documentation
- API documentation
- runbooks
- operational documentation
- changelog entries
- release notes
- generated reports
- Pull Request descriptions
- other governed textual deliverables

This skill does NOT change lifecycle artifact ownership.

The owning specialist remains responsible for modifying its artifact.

For the canonical validation matrix, also read:

`quality-checklist.md`

---

# 1. Core Principle

Document quality is not only grammar or formatting.

A high-quality SDLC document must be:

- present when required
- complete for its governed scope
- factually accurate
- internally consistent
- consistent with authoritative upstream artifacts
- consistent with implementation where applicable
- traceable
- readable
- free of unresolved placeholders
- free of leaked secrets
- structurally usable

A polished but inaccurate document is not high quality.

---

# 2. Result Vocabulary

Use:

`PASS`

`FAIL`

`NOT_APPLICABLE`

`NOT_VERIFIED`

Do not use PASS when sufficient evidence was not available.

---

# 3. Existence

For every required document, first determine whether it exists.

Use:

`PASS`

when the required artifact exists.

Use:

`FAIL`

when a required artifact is missing.

Use:

`NOT_APPLICABLE`

only when the governing lifecycle genuinely does not require that document.

Do not create the missing document merely to make the quality check pass unless
the current specialist owns its creation.

---

# 4. Readability

Evaluate whether the document can be reasonably understood by its intended
audience.

Check:

- meaningful headings
- understandable sentences
- logical grouping
- reasonable paragraph/bullet structure
- unambiguous terminology
- clear status information

Do not require stylistic perfection.

Focus on usability.

---

# 5. Completeness

Completeness means the document contains the content required by its governing
contract.

Examples:

requirements.md should contain required requirement and approval sections.

code-review.md should contain review evidence and final status.

verification.md should contain required verification evidence.

PR content must contain all mandatory PR sections.

Do not invent required sections that the owning agent contract does not
require.

---

# 6. Accuracy

Validate factual claims against authoritative evidence.

Examples:

A document says:

`Code Review Status: CODE_REVIEW_APPROVED`

Verify that the authoritative Code Review artifact supports that state.

A README says:

`Run npm start`

Verify that the repository actually supports that command.

A PR says:

`45 tests passed`

Verify that actual recorded evidence supports that count.

Unsupported claims are quality defects.

---

# 7. Internal Consistency

A document must not contradict itself.

Examples of contradictions:

Metadata:

`Code Review Status: AWAITING_HUMAN_DECISIONS`

but final section:

`Code Review Status: CODE_REVIEW_APPROVED`

or:

Requirements say:

`phone is optional`

while another final requirement says:

`phone is mandatory`

without explanation.

Internal contradiction is a quality failure until reconciled by the owning
specialist.

---

# 8. Cross-Artifact Consistency

Where relevant, compare the document with authoritative related artifacts.

Examples:

Implementation Plan task references must exist in requirements/architecture.

Verification evidence must correspond to current reviewed implementation.

PR Summary must match actual verified changes.

Changelog must describe behavior actually delivered.

Use:

`sdlc-traceability`

for identifier validation.

Use:

`git-baseline-safety`

for revision/baseline validity.

---

# 9. Implementation Consistency

For documents describing actual implementation, validate against the repository.

Examples:

- listed file exists
- described API path exists
- documented environment variable exists
- documented test command exists
- claimed architecture component is implemented as described
- changelog behavior exists in code

Do not rely only on another documentation file when actual repository evidence
is available.

---

# 10. Requirement Consistency

Final product documentation should not contradict approved requirements.

If implementation and requirements differ:

do not silently rewrite the document to match whichever is easier.

Report the mismatch.

Use SDLC governance to determine the owning phase.

---

# 11. Status Consistency

Lifecycle documents must use statuses consistently.

Validate applicable:

- Requirements Status
- Architecture Status
- Design Review Status
- Implementation Plan Status
- Implementation Plan Approval
- Implementation Status
- Code Review Status
- Verification Status
- PR Status

A stale or contradictory status is not merely a formatting problem.

It may be a lifecycle-governance defect.

---

# 12. Identifier Integrity

Validate references such as:

- FR-###
- BR-###
- NFR-###
- AC-###
- CMP-###
- AD-###
- DR-###
- TASK-###
- CR-###
- VC-###
- VR-###

Use the `sdlc-traceability` skill.

Do not guess which ID a broken reference was intended to mean.

---

# 13. Placeholder Detection

Search for unresolved placeholder content.

Examples:

`TODO`

`TBD`

`FIXME`

`PLACEHOLDER`

`<insert here>`

`<description>`

`XXX`

template instructions accidentally left in final content

Placeholders are not automatically defects in every document.

Assess context.

Example:

A planned future section explicitly marked TBD before approval may be valid.

A final approved PR containing:

`<test evidence>`

is invalid.

---

# 14. Template Residue

Check for template instructions that were accidentally preserved.

Examples:

`Replace this text`

`Add details here`

`Delete this section if not applicable`

Such residue normally fails final-document quality.

---

# 15. Empty Required Sections

A heading existing does not prove completeness.

Example:

`## Test Evidence`

with no meaningful content

does not satisfy the PR Test Evidence requirement.

Check content, not only headings.

---

# 16. Duplicated Content

Identify material accidental duplication.

Examples:

- same finding listed twice
- duplicated requirement with different IDs
- repeated changelog bullet
- repeated PR section
- duplicated document block caused by regeneration

Do not flag intentional summaries that repeat information for usability.

---

# 17. Conflicting Duplicate Content

Duplicate statements are especially important when they conflict.

Example:

one section says:

`PORT defaults to 3000`

another says:

`PORT is mandatory`

Verify which is supported.

Do not choose silently.

---

# 18. Broken Links

When a document includes links:

validate them when practical and relevant.

Examples:

- repository-relative file links
- headings/anchors
- referenced documentation
- PR/issue links

Do not require network access for every link if the current environment does not
support it.

Use:

`NOT_VERIFIED`

when external link validity cannot be determined.

---

# 19. File References

Validate repository-relative file paths when the document claims a file exists.

Example:

`docs/database.md`

should exist if documented as a deliverable.

A renamed or missing path is a quality defect.

---

# 20. Formatting

Evaluate whether formatting is structurally valid for the document type.

For Markdown, check applicable:

- heading hierarchy
- malformed tables
- broken code fences
- broken lists
- malformed links
- accidental raw template syntax
- unreadable long blocks

Use repository-native format checks when configured.

---

# 21. Language Quality

Evaluate:

- clarity
- grammar sufficient for professional use
- spelling
- ambiguous phrasing
- incomplete sentences
- inconsistent terminology

Do not rewrite valid domain terminology simply to make it stylistically
different.

Accuracy takes precedence over stylistic preference.

---

# 22. Terminology Consistency

Use consistent names for:

- project
- components
- services
- actors
- statuses
- requirement concepts
- APIs
- configuration

Example:

Do not alternate without reason between:

`User Service`

`Profile Service`

`Account API`

if they refer to one governed component.

---

# 23. Audience Appropriateness

Check that content is appropriate for its intended audience.

Examples:

README:

developer/user onboarding

architecture.md:

technical architecture reasoning

PR:

reviewer-focused summary and evidence

verification.md:

auditable verification evidence

Do not require every document to include every technical detail.

---

# 24. Concision Versus Completeness

Avoid both:

- missing critical information
- excessive raw detail that obscures the result

Example:

PR Test Evidence should summarize meaningful results rather than paste thousands
of log lines.

Verification may contain more detailed evidence than the PR.

---

# 25. Sensitive Information

Check for accidental exposure of:

- passwords
- API keys
- tokens
- private keys
- connection credentials
- secret environment values
- sensitive internal logs
- prohibited personal information

Do not reproduce suspected secret values in the quality report.

Report location/category safely.

---

# 26. Example Values

Do not automatically treat obvious safe placeholders in example configuration
as leaked secrets.

Example:

`replace-with-a-local-password`

is not necessarily a secret.

However, verify that examples cannot reasonably be mistaken for real
credentials.

---

# 27. Logs and Error Output

Documentation may include diagnostics.

Ensure logs do not leak:

- secret environment values
- connection strings with passwords
- bearer tokens
- authentication headers

Redact sensitive data.

---

# 28. Changelog Quality

A changelog entry should:

- describe verified delivered behavior
- use the repository's established format
- avoid unsupported claims
- avoid implementation-noise overload
- avoid duplicate entries
- avoid unreleased version invention
- preserve meaningful security fixes where relevant

The changelog does not need the same detail as implementation-log.md.

---

# 29. Release Note Quality

Release notes should communicate user/reviewer-relevant outcomes.

Check:

- delivered capability
- material behavior change
- important migration/compatibility information
- material limitations
- security-relevant information where appropriate

Do not expose confidential implementation detail unnecessarily.

---

# 30. PR Summary Quality

A PR Summary should accurately explain:

- what was built
- why it was built

For the current Agentic SDLC contract:

Summary should normally be 2–3 sentences.

Do not invent business motivation absent from Requirements.

---

# 31. PR Changes Made Quality

The PR Changes Made section must reflect the actual Git diff.

Validate:

- files/groups accounted for
- reason for each material change
- no hidden unrelated files
- no file claimed changed when absent from diff

Use Git baseline/diff evidence.

---

# 32. PR Test Evidence Quality

PR Test Evidence must come from real executed evidence.

Validate:

- verification status
- test result
- build result
- applicable static/security checks
- CI state when claimed

Never fabricate test counts or CI status.

---

# 33. PR Known Limitations Quality

Known Limitations should include material:

- out-of-scope behavior
- deferred risks
- unresolved accepted limitations
- inaccessible optional dependency
- relevant Not Found conditions

Do not list normal expected error behavior as a project limitation.

If none exist:

state that clearly.

---

# 34. PR Reviewer Checklist Quality

Reviewer Checklist items should be:

- actionable
- relevant
- initially unchecked
- specific enough to guide review

Do not pre-check:

`- [x]`

items on behalf of the reviewer.

---

# 35. Requirements Document Quality

When used for requirements quality, check applicable:

- source traceability
- business objective
- scope
- FR
- BR
- NFR
- AC
- dependencies
- assumptions
- open questions
- human decisions
- approval state

Do not create missing requirements while merely validating quality.

The Requirements Agent owns corrections.

---

# 36. Architecture Document Quality

Check applicable:

- requirement baseline
- current/target architecture
- component responsibilities
- decisions
- security
- reliability
- data
- interfaces
- deployment
- traceability
- risks
- review readiness

The Architecture Agent owns corrections.

---

# 37. Review Artifact Quality

For Design Review and Code Review:

check:

- findings have permanent IDs
- evidence exists
- decisions/statuses are consistent
- remediation state is valid
- final phase status is consistent with findings

Use:

`review-findings`

for lifecycle validation.

---

# 38. Implementation Plan Quality

Check applicable:

- TASK IDs
- dependencies
- execution waves
- traceability
- scope
- testing obligations
- completion criteria
- approval state

Do not restructure the plan from another phase.

---

# 39. Implementation Log Quality

Check:

- TASK/remediation identity
- traceability
- files changed
- tests/checks
- result
- known issues
- escalation
- claimed evidence versus actual repository

Do not assume log claims are correct without evidence when accuracy matters.

---

# 40. Verification Report Quality

Check:

- baseline
- Verification Status
- VC identifiers
- requirement/AC coverage
- test evidence
- document quality results
- findings
- remediation history
- final gate

Verification itself owns the final determination.

---

# 41. Generated Document Stability

For generated final documents, when repeatable generation is part of scope:

check for:

- duplicated sections
- missing content
- unstable ordering
- data loss
- unexpected nondeterministic output

Do not require deterministic byte-for-byte output unless governed.

---

# 42. Not Found Content

The phrase:

`Not Found`

requires context.

It may represent:

## Valid Expected Behavior

Example:

HTTP 404 Not Found for unknown resource.

No document defect exists merely because this phrase appears.

## Missing Required Content

Example:

Required output document not found.

This is a defect.

## Source Unavailability

Example:

Referenced file not found.

This may be a limitation or blocker.

Classify based on meaning.

---

# 43. Cross-Document Duplication

Some lifecycle information intentionally appears in multiple artifacts.

Example:

requirements status referenced by architecture.

Do not mark this as duplicate content.

Flag duplication only when it introduces:

- maintenance risk
- contradiction
- accidental repeated blocks
- excessive copied detail with no purpose

---

# 44. Evidence-Based Correction

A document should only be corrected based on:

- authoritative lifecycle source
- actual implementation
- actual test evidence
- explicit human clarification
- repository policy

Do not "correct" content based on assumption.

---

# 45. Ownership Boundary

This skill evaluates quality.

It does not authorize modification of another specialist's governed artifact.

Examples:

Verification discovers requirements.md inconsistency.

Verification must not silently edit requirements.md.

Route to Requirements.

PR Agent detects verification.md contradiction.

PR Agent must not silently rewrite Verification.

Route to Verification.

---

# 46. Correctable Local Content

An owning specialist may fix quality problems in artifacts it owns.

Examples:

PR Agent may correct its own:

- PR description
- changelog packaging entry

Verification Agent may correct:

- its own verification.md formatting or internal reporting error

provided the correction does not falsify lifecycle evidence.

---

# 47. Material Versus Cosmetic Defect

Classify quality defects as:

`MATERIAL`

or:

`COSMETIC`

Material examples:

- incorrect lifecycle status
- missing required section
- false test claim
- broken requirement reference
- leaked secret
- contradiction affecting meaning

Cosmetic examples:

- minor grammar issue
- harmless spacing
- non-material formatting inconsistency

Do not block lifecycle completion solely for trivial cosmetic issues unless
repository quality policy requires it.

---

# 48. Quality Finding Structure

Recommended:

Document:
Section:
Check:
Result:
Materiality:
Evidence:
Issue:
Required Outcome:
Owning Specialist:

Do not create a new DR/CR/VR identifier unless the owning phase contract calls
for one.

---

# 49. Document Quality Matrix

Recommended:

| Document | Existence | Completeness | Accuracy | Consistency | Traceability | Placeholders | Security | Formatting | Language | Overall |
|---|---|---|---|---|---|---|---|---|---|---|

Use only applicable columns.

---

# 50. Quality Gate

A required document passes quality when:

- it exists
- required content is present
- material claims are accurate
- no material contradiction remains
- required traceability is valid
- no unresolved final placeholders remain
- no sensitive information is exposed
- formatting is usable
- language is sufficiently clear
- content agrees with relevant implementation/governed evidence

---

# 51. NOT_VERIFIED

Use:

`NOT_VERIFIED`

when an important claim cannot be checked with available evidence.

Do not convert uncertainty into PASS.

Example:

External documentation link cannot be accessed.

Record:

`Link validity: NOT_VERIFIED`

rather than claiming it works.

---

# 52. Evidence Sources

Possible evidence sources include:

- authoritative SDLC artifacts
- actual repository files
- Git diff
- project manifests
- test evidence
- source code
- generated output
- CI evidence
- explicit human clarification

Prefer primary evidence over summaries when available.

---

# 53. Integration With Other Skills

Use:

`sdlc-governance`

for lifecycle-state validity.

Use:

`sdlc-traceability`

for identifier/reference validation.

Use:

`review-findings`

for DR/CR/VR decision/status lifecycle.

Use:

`git-baseline-safety`

for revision and actual-diff validity.

Use:

`test-verification`

for test evidence integrity.

This skill focuses on textual/document quality.

---

# 54. Final Rule

A document is not high quality merely because it looks professional.

It must tell the truth about the governed system, lifecycle state, and evidence.

When presentation and factual accuracy conflict:

preserve factual accuracy.