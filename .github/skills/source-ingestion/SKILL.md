---
name: source-ingestion
description: >
  Read-only source acquisition and normalization procedure for the controlled
  Agentic SDLC. Use this skill when retrieving or extracting requirement
  sources from Jira, Confluence, Microsoft Word DOCX, repository files,
  SharePoint or OneDrive sources, or multiple approved sources; when recording
  source provenance; when detecting inaccessible, unsupported, incomplete, or
  conflicting source material; or when preparing a normalized source packet
  for the Requirements Agent. This skill never modifies authoritative external
  sources and does not create requirements itself.
---

# Agentic SDLC Source Ingestion

This skill defines the reusable source-acquisition procedure used before
requirements analysis.

Its responsibility is:

`identify source`
→ `retrieve safely`
→ `extract content`
→ `preserve provenance`
→ `normalize source material`
→ `surface access or conflict conditions`
→ `hand normalized evidence to Requirements`

It does NOT:

- create Functional Requirements
- create Business Rules
- create NFRs
- create Acceptance Criteria
- answer Requirements clarification questions
- approve Requirements
- silently resolve material source conflicts

Those responsibilities remain with the Requirements Agent.

For source authority and conflict behavior, also read:

`source-authority.md`

---

# 1. Core Principle

Source ingestion is evidence acquisition.

Requirements analysis is interpretation.

Keep these responsibilities separate.

The ingestion process should answer:

- What source did we receive?
- Can it be accessed?
- What content does it actually contain?
- Where did each piece of content come from?
- Are multiple sources present?
- Are there obvious material contradictions?
- Is anything missing or unreadable?

It should NOT decide:

- what the final business requirement should be
- which ambiguous interpretation is correct
- whether the human approves the requirement

---

# 2. Supported Source Categories

Supported source categories may include:

`JIRA`

`CONFLUENCE`

`DOCX`

`REPOSITORY_FILE`

`SHAREPOINT_WORD`

`ONEDRIVE_WORD`

`USER_PROVIDED_TEXT`

`OTHER_APPROVED_SOURCE`

Support depends on available approved tools.

Do not claim access to a source provider when the required connector or tool is
not configured.

---

# 3. Source Provenance

For every source, capture when available:

- Source Type
- Source Identifier
- Source Title
- Source Location
- Source Revision / Version
- Source Retrieval Time when relevant
- Retrieval Method
- Retrieval Status
- Referenced Parent Story or Document
- Notes

Do not invent missing metadata.

Use:

`Not Available`

when appropriate.

---

# 4. Read-Only Principle

Source acquisition is read-only by default.

Do NOT modify:

- Jira issues
- Jira fields
- Jira comments
- Jira workflow state
- Confluence pages
- Confluence comments
- Word documents
- SharePoint documents
- OneDrive documents

unless a separate explicit workflow authorizes such modification.

Requirements ingestion never requires external-source mutation.

---

# 5. Source Retrieval Status

Use:

`ACCESSED`

when the requested source was successfully retrieved.

Use:

`PARTIAL`

when only part of the approved source could be retrieved.

Use:

`NOT_FOUND`

when the requested source cannot be found.

Use:

`ACCESS_DENIED`

when access exists in principle but permission prevents retrieval.

Use:

`TOOL_NOT_AVAILABLE`

when the required integration is not configured.

Use:

`UNSUPPORTED_FORMAT`

when the source format cannot be safely read.

Use:

`INVALID_SOURCE`

when the supplied source cannot be interpreted as the claimed source type.

Do not treat any failure state as ACCESSED.

---

# 6. Jira Acquisition

When a Jira issue key or Jira URL is provided:

use the configured read-only Atlassian capability.

Retrieve applicable:

- issue key
- summary
- description
- issue type
- acceptance criteria when stored in Jira
- labels/components when relevant
- linked requirement material explicitly relevant to the request
- referenced Confluence pages when approved for ingestion

Do not modify Jira.

Do not transition Jira workflow state.

Do not create comments.

---

# 7. Jira Scope

Retrieve only enough Jira information to understand the approved source.

Do not recursively retrieve:

- an entire Jira project
- unrelated epics
- unrelated linked issues
- every historical comment

unless the user or governing workflow explicitly requires that scope.

Prefer least necessary source retrieval.

---

# 8. Jira Failure

If a Jira source cannot be retrieved:

record the exact retrieval state.

Example:

`Retrieval Status: ACCESS_DENIED`

or:

`Retrieval Status: NOT_FOUND`

Do not invent story content.

If another approved representation exists, it may be ingested separately.

Example:

Jira unavailable

but:

approved user-story.md exists

The available source may still be normalized with provenance indicating that
the Jira source itself was unavailable.

---

# 9. Confluence Acquisition

When a Confluence page title or URL is supplied:

use the configured read-only Atlassian capability.

Retrieve applicable:

- page title
- page identifier
- page content
- relevant version information when available
- explicitly referenced child/supporting content when necessary

Do not modify Confluence.

---

# 10. Confluence Scope

Do not recursively ingest an entire Confluence space merely because one page
was requested.

Retrieve:

the specified page

plus only directly relevant referenced material required for the approved
source scope.

Large-space discovery requires explicit authorization or a clear retrieval
need.

---

# 11. Confluence Failure

When a requested page cannot be retrieved:

record:

`NOT_FOUND`

`ACCESS_DENIED`

`TOOL_NOT_AVAILABLE`

or another appropriate status.

Do not reconstruct missing page content from assumptions.

---

# 12. Local DOCX

When a local `.docx` document is supplied:

1. verify that the file exists
2. verify that the extension is `.docx`
3. do not modify the file
4. use the approved read-only extraction helper
5. preserve the original source path as provenance
6. analyze extracted text as source evidence
7. do not commit the source DOCX unless explicitly requested

Preferred helper bundled with this skill:

`extract_docx.py`

---

# 13. DOCX Extraction Boundary

The bundled helper extracts readable paragraph text from:

`word/document.xml`

inside the DOCX package.

It is intentionally minimal and read-only.

It does not guarantee extraction of every possible Word feature.

Potentially incomplete content may include:

- complex tables
- diagrams
- SmartArt
- embedded objects
- tracked-change semantics
- headers/footers
- comments
- images
- text contained only in non-standard XML structures

If those elements materially affect requirements:

do not claim the extracted plain text is complete.

Report:

`PARTIAL`

and request/use an approved richer reader when available.

---

# 14. Legacy DOC

Legacy binary:

`.doc`

is not handled by the bundled DOCX extraction helper.

If no approved `.doc` reader exists:

record:

`UNSUPPORTED_FORMAT`

Do not attempt unsafe conversion with arbitrary downloaded software.

Preferred remediation:

obtain an approved `.docx`, PDF, text export, or configured supported source.

---

# 15. SharePoint and OneDrive Word Sources

When a Word document is stored in SharePoint or OneDrive:

use an approved configured connector when available.

Retrieve read-only content.

Do not modify the remote file during requirements ingestion.

If no connector exists:

record:

`TOOL_NOT_AVAILABLE`

and use an approved local `.docx` or alternate source representation when
available.

---

# 16. Repository Files

Repository-based requirement sources may include:

- user-story.md
- specification Markdown
- text documents
- JSON/YAML requirement definitions
- approved design input
- local DOCX

Use repository files as sources when the user or governed workflow identifies
them as requirement evidence.

Do not automatically treat every repository document as an approved
requirement source.

---

# 17. Existing Source Code

Existing source code may be inspected as:

`CURRENT_STATE_EVIDENCE`

It is not automatically:

`DESIRED_REQUIREMENT`

Examples:

Existing code may prove:

- current API behavior
- current validation logic
- current schema
- current UI state

It does NOT prove that the current behavior is what the new story requires.

The Requirements Agent owns interpretation of current versus desired behavior.

---

# 18. User-Provided Text

When the user provides requirement/story text directly:

treat it as an approved source for the current conversation unless context
indicates otherwise.

Record provenance such as:

`Source Type: USER_PROVIDED_TEXT`

Do not invent external identifiers.

---

# 19. Multiple Sources

A single requirement analysis may have multiple approved sources.

Example:

`Jira story`
+
`Confluence business rules`
+
`Word compliance specification`

Retrieve each source independently.

Do not flatten provenance.

Every important source-derived statement should remain attributable to its
origin.

---

# 20. Primary and Supporting Sources

Where the user or workflow identifies source roles, preserve:

`PRIMARY`

and:

`SUPPORTING`

Example:

Jira story:

`PRIMARY`

Confluence policy:

`SUPPORTING`

Word regulatory specification:

`SUPPORTING`

Do not invent source priority merely from file format.

See:

`source-authority.md`

---

# 21. Source Conflict Detection

During normalization, surface apparent material contradictions.

Examples:

Jira:

`Phone number is optional.`

Confluence:

`Phone number is mandatory.`

Do NOT resolve this silently.

Record the conflict.

The Requirements Agent determines whether an RQ clarification is required.

---

# 22. Material Conflict

A material source conflict affects:

- user behavior
- business rule
- mandatory/optional status
- validation
- security
- permissions
- data retention
- compliance
- system boundary
- acceptance behavior
- performance/reliability obligations
- other implementation-significant behavior

Do not collapse materially different statements into one normalized sentence.

---

# 23. Non-Material Difference

Not every wording difference is a conflict.

Example:

Source A:

`The user enters their email address.`

Source B:

`An email address is supplied by the user.`

These may express equivalent behavior.

Preserve meaning without manufacturing unnecessary conflict.

The Requirements Agent makes the final interpretation when ambiguity matters.

---

# 24. Source Conflict Record

Recommended format:

```text
Conflict ID:
SRC-CONFLICT-###

Source A:
<source identifier>

Statement A:
<concise source-supported statement>

Source B:
<source identifier>

Statement B:
<concise source-supported statement>

Materiality:
MATERIAL / POSSIBLY_MATERIAL / NON_MATERIAL

Reason:
<why the statements may conflict>

Resolution:
UNRESOLVED
```

Source conflict IDs are temporary ingestion identifiers.

They are NOT replacements for:

`RQ-###`

The Requirements Agent owns clarification-question IDs.

---

# 25. Missing Source Content

If an expected source section is empty or unavailable:

record that condition.

Do not generate replacement business content.

Examples:

`Acceptance Criteria section present but empty.`

`Referenced Confluence page not accessible.`

`DOCX text extraction returned no readable paragraphs.`

---

# 26. Referenced Sources

A source may reference another source.

Example:

Jira:

`See Confluence page Profile Business Rules.`

Do not automatically retrieve every reference.

Retrieve the referenced source when:

- it is explicitly part of the approved request
- it is necessary to understand the requirement
- configured access permits retrieval

Otherwise record the reference for Requirements analysis.

---

# 27. Recursive Retrieval Limit

Avoid unbounded retrieval chains.

Example:

Jira
→ Confluence
→ another Confluence page
→ spreadsheet
→ another project

Stop when additional retrieval is no longer clearly required for the approved
story scope.

If uncertainty materially affects requirements:

surface it to the Requirements Agent.

---

# 28. Source Confidentiality

Treat source documents according to their sensitivity.

Do not copy confidential external documents into the repository merely for
convenience.

Prefer extracting only the content necessary for Requirements analysis.

Do not commit source files unless explicitly required.

---

# 29. Secret Handling

If a source unexpectedly contains:

- password
- API key
- access token
- private key
- credential
- sensitive connection string

do not reproduce the secret in normalized output.

Record that sensitive content was detected and redact it.

Requirement meaning may be preserved without retaining the secret value.

---

# 30. Normalization

Normalize retrieved material into a consistent source packet.

Normalization may:

- remove presentation-only noise
- preserve headings
- preserve bullet structure
- preserve source-specific identifiers
- make paragraphs readable
- associate content with provenance

Normalization must NOT:

- invent missing business rules
- silently choose between conflicting statements
- rewrite ambiguous statements into false certainty
- add requirements not supported by the sources

---

# 31. Normalized Source Packet

Recommended structure:

```text
# Normalized Source Packet

## Source Summary

### SOURCE-001
Source Type:
Source Role:
Source Identifier:
Source Title:
Source Location:
Revision:
Retrieval Method:
Retrieval Status:

## Extracted Content

### SOURCE-001
<normalized source-supported content>

## Source References

<references to additional sources>

## Source Conflicts

<detected conflicts>

## Missing / Inaccessible Content

<known gaps>

## Sensitive Content Handling

<redaction notes if applicable>

## Ingestion Result

COMPLETE / PARTIAL / BLOCKED
```

This packet may be conceptual or persisted only when the owning workflow
explicitly requires it.

Do not automatically create a repository artifact unless the Requirements
Agent contract requests one.

---

# 32. Source IDs

For temporary normalized ingestion, source IDs may use:

`SOURCE-001`

`SOURCE-002`

etc.

These IDs exist only to maintain provenance during ingestion.

They do not replace:

- Jira keys
- Confluence IDs
- FR IDs
- RQ IDs
- TASK IDs

Preserve the original source identifier alongside the temporary source ID.

---

# 33. Ingestion Result

Use:

`COMPLETE`

when all approved requested sources were retrieved sufficiently for analysis.

Use:

`PARTIAL`

when useful source evidence exists but one or more approved sources or
important sections were not fully available.

Use:

`BLOCKED`

when the requested requirement analysis cannot safely proceed because required
source evidence cannot be obtained.

The Requirements Agent determines lifecycle impact.

---

# 34. Source Quality

Source ingestion may flag:

- missing content
- unreadable content
- duplicated content
- obvious internal contradiction
- stale version information
- ambiguous references

It does not rewrite the source to improve it.

---

# 35. Latest Human Clarification

Human clarification can supersede an ambiguous interpretation during
Requirements analysis.

However, ingestion should preserve what the original source said.

Do not rewrite original source evidence to match later clarification.

The Requirements artifact may record the clarification separately.

See:

`source-authority.md`

---

# 36. Source Versioning

When version or modification information is available:

record it.

If source versions differ materially:

surface the version distinction.

Do not assume the most recently retrieved source is necessarily the governing
business authority unless that authority is defined.

---

# 37. Retrieval Evidence

Record enough evidence to explain:

- which source was used
- whether retrieval succeeded
- what method was used
- whether extraction was complete
- whether limitations existed

Do not store excessive raw connector/tool output in Requirements artifacts.

---

# 38. Error Reporting

When ingestion fails:

report the actual condition.

Examples:

`Jira issue SCRUM-6 was not found.`

`Confluence access is unavailable.`

`The supplied DOC file is unsupported.`

`DOCX extraction succeeded but table content may be incomplete.`

Do not obscure errors behind generic:

`Unable to process source.`

when a useful safe explanation exists.

---

# 39. Tool Boundaries

Use only configured approved tools.

Do not:

- install arbitrary document converters
- bypass provider authentication
- scrape inaccessible private pages
- use write operations when read-only access is sufficient
- expose external-source credentials

---

# 40. Handoff to Requirements

After ingestion, provide the Requirements Agent with:

- source inventory
- normalized source content
- provenance
- missing/inaccessible evidence
- potential conflicts
- extraction limitations

The Requirements Agent then owns:

- requirement extraction
- current versus desired behavior
- requirement IDs
- clarification questions
- conflict resolution through human input
- requirements.md
- approval

---

# 41. Final Rule

Never convert:

`source acquisition uncertainty`

into:

`invented requirement certainty`.

When evidence is incomplete:

preserve the uncertainty and hand it to the Requirements Agent.