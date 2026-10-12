# Source Authority and Conflict Rules

This reference defines how multiple source inputs are preserved and how
authority should be represented during source ingestion.

It does not replace Requirements Agent judgment.

---

# 1. Preserve Source Identity

Every source remains independently identifiable.

Example:

```text
SOURCE-001
Type: Jira
Identifier: SP-12
Role: PRIMARY
```

```text
SOURCE-002
Type: Confluence
Identifier: Profile Business Rules
Role: SUPPORTING
```

Do not merge them into an unattributed block.

---

# 2. Source Role

Allowed source roles:

`PRIMARY`

`SUPPORTING`

`CURRENT_STATE_EVIDENCE`

`HUMAN_CLARIFICATION`

`OTHER_APPROVED`

Source role should come from the user's request, governed workflow, or clear
source context.

Do not invent priority merely from source type.

Jira is not automatically more authoritative than Confluence.

Confluence is not automatically more authoritative than Word.

---

# 3. Explicit Human Clarification

A direct explicit human clarification may resolve ambiguity in source material.

Example:

Jira:

`Phone may be omitted.`

Confluence:

`Phone is mandatory.`

Human clarification:

`Phone is optional for this story.`

The Requirements Agent may use the human clarification as the decision for the
current requirement baseline.

However:

the original source conflict must not be erased from provenance.

---

# 4. Human Clarification Boundary

Human clarification should be:

- explicit
- relevant to the specific ambiguity
- captured by the Requirements workflow

Do not treat casual unrelated statements as authoritative overrides.

---

# 5. Material External Constraint

Human clarification must not silently override a known externally controlled
constraint when the human lacks authority to do so.

Examples may include:

- regulatory requirement
- mandated security policy
- legal restriction
- externally governed API contract

When such a conflict exists:

surface it.

The Requirements Agent determines the correct escalation.

---

# 6. Multiple Sources Agree

When multiple sources materially agree:

preserve their provenance.

Example:

```text
FR-003 supported by:
- Jira SP-12
- Confluence Profile Rules
```

Do not discard supporting-source attribution simply because statements agree.

---

# 7. Multiple Sources Conflict

When sources materially conflict:

do not select one silently.

Record:

- both sources
- both statements
- nature of conflict
- unresolved state

Then hand the issue to Requirements analysis.

---

# 8. Primary Does Not Mean Ignore Supporting Sources

A PRIMARY source defines the central requested work.

Supporting sources may still contain mandatory:

- business rules
- validation
- security requirements
- data constraints
- compliance obligations

Do not ignore them merely because they are not PRIMARY.

---

# 9. Current-State Evidence

Existing implementation, documentation, or configuration may demonstrate the
current system.

Classify it as:

`CURRENT_STATE_EVIDENCE`

unless it has been explicitly approved as desired requirement authority.

Current behavior does not automatically define future required behavior.

---

# 10. Stale Source

If a source appears stale:

record available version/date evidence.

Do not discard it without authority.

Do not automatically treat newer modification time as governing authority.

Surface the issue when material.

---

# 11. Derived Content

Ingestion output may summarize source text for readability.

Clearly distinguish:

`source-supported normalization`

from:

`Requirements interpretation`

Do not add derived business meaning during ingestion.

---

# 12. Conflict Example

```text
Conflict ID:
SRC-CONFLICT-001

Source A:
Jira SP-12

Statement:
Phone number is optional.

Source B:
Confluence Profile Business Rules

Statement:
Phone number is mandatory.

Materiality:
MATERIAL

Resolution:
UNRESOLVED

Required Handoff:
Requirements Agent should create or use an RQ clarification if no governing
authority already resolves the conflict.
```

---

# 13. Source Access Failure

A source that cannot be accessed is:

`unavailable evidence`

not:

`evidence that no requirement exists`.

Example:

Confluence page referenced by Jira cannot be retrieved.

Do not conclude:

`No additional business rules exist.`

Instead record:

`Referenced supporting source unavailable.`

---

# 14. Unsupported Source

An unsupported file format must remain unsupported unless an approved reader is
available.

Do not silently convert content through arbitrary external services.

---

# 15. Final Authority Principle

Source ingestion preserves evidence.

The Requirements Agent establishes the approved requirements baseline.

The human approval gate establishes lifecycle authorization.

These are separate steps:

```text
Source
→ Ingestion
→ Requirements Analysis
→ Clarification
→ Requirements Baseline
→ Human Approval
```