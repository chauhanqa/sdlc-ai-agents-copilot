---
name: agent-contract-validator
description: >
  Read-only structural validator for the controlled Agentic SDLC framework.
  Use this skill when adding, removing, renaming, or refactoring custom agents
  or skills; before committing framework changes; when diagnosing orchestration
  or agent-discovery problems; or when verifying that specialist ownership,
  frontmatter, lifecycle terminal states, delegation boundaries, mandatory PR
  sections, and shared skill files remain intact. Runs a deterministic local
  validator and never modifies agent or skill files.
---

# Agentic SDLC Agent Contract Validator

This skill validates the structure and minimum contracts of the Agentic SDLC
framework itself.

It does NOT perform an SDLC phase.

It validates that the configured agents and skills remain structurally capable
of performing the governed lifecycle.

The primary validator is:

`validate_agents.py`

---

# 1. Purpose

Use this skill after changes to:

- `.github/agents/*.agent.md`
- `.github/skills/**`
- agent frontmatter
- agent names
- tool assignments
- lifecycle terminal statuses
- artifact ownership
- orchestration delegation
- PR contract sections

Its purpose is to detect accidental framework drift before that drift affects a
real application-development lifecycle.

---

# 2. Read-Only Rule

The validator is read-only.

It may:

- read files
- inspect directories
- parse agent frontmatter
- inspect skill frontmatter
- validate required markers
- print errors and warnings
- return a nonzero exit code

It must NOT:

- rewrite agent files
- rewrite skill files
- change lifecycle artifacts
- update production code
- commit changes
- push changes

---

# 3. Expected Agents

The controlled framework expects these agent IDs:

`requirements`

`architecture`

`design-review`

`implementation-planning`

`implementation`

`code-review`

`verification`

`pr`

`sdlc-orchestrator`

Corresponding repository files are expected under:

`.github/agents/`

---

# 4. Specialist Separation

The following are specialist agents:

- requirements
- architecture
- design-review
- implementation-planning
- implementation
- code-review
- verification
- pr

Specialists must not receive orchestration delegation authority merely because
they participate in the lifecycle.

The `agent` delegation tool belongs to:

`sdlc-orchestrator`

unless the framework is deliberately redesigned.

---

# 5. Orchestrator Contract

The Orchestrator must:

- exist
- be named `sdlc-orchestrator`
- expose the `agent` tool
- reference all eight specialist agents
- preserve lifecycle completion behavior
- remain manually/directly invoked rather than silently selected when the
  configured contract requires `disable-model-invocation: true`

The validator should fail when this contract is accidentally weakened.

---

# 6. Specialist Invocation Contract

The eight specialist agents are expected to remain:

`user-invocable: true`

and:

`disable-model-invocation: false`

unless a deliberate framework redesign changes that policy.

This supports direct specialist testing and orchestrated execution.

---

# 7. Base Specialist Tools

Current specialist agents require the basic capabilities:

- read
- search
- edit
- execute

The Requirements Agent additionally exposes approved Atlassian read operations
for Jira and Confluence acquisition.

The validator should not remove or alter tools.

It only reports structural deviations.

---

# 8. Artifact Ownership Contract

Minimum artifact ownership markers are:

| Agent | Owned Primary Artifact / Output |
|---|---|
| requirements | docs/sdlc/requirements.md |
| architecture | docs/sdlc/architecture.md |
| design-review | docs/sdlc/design-review.md |
| implementation-planning | docs/sdlc/impl-plan.md |
| implementation | docs/sdlc/implementation-log.md |
| code-review | docs/sdlc/code-review.md |
| verification | docs/sdlc/verification.md |
| pr | changelog/release note + Pull Request |
| sdlc-orchestrator | docs/sdlc/orchestration-state.md |

A specialist may reference other artifacts.

Reference is not ownership.

---

# 9. Minimum Lifecycle Markers

The validator checks important terminal or handoff states.

Requirements:

`APPROVED`

Architecture:

`READY_FOR_DESIGN_REVIEW`

and the approved Design Review state where applicable.

Design Review:

`DESIGN_REVIEW_APPROVED`

Implementation Planning:

`READY_FOR_IMPLEMENTATION`

and:

`Implementation Plan Approval`

Implementation:

`READY_FOR_CODE_REVIEW`

Code Review:

`CODE_REVIEW_APPROVED`

Verification:

`VERIFICATION_PASSED`

PR:

`PR_CREATED`

or:

`PR_UPDATED`

Orchestration:

`AGENTIC SDLC COMPLETE`

These checks prove that the critical lifecycle vocabulary was not accidentally
removed during refactoring.

They do not prove that an actual project currently satisfies the statuses.

---

# 10. PR Contract Validation

The PR Agent must retain these mandatory PR description sections:

`Summary`

`Changes Made`

`Test Evidence`

`Known Limitations`

`Reviewer Checklist`

The validator should fail if a refactor accidentally removes any of these
required contractual sections.

---

# 11. Work-Item Contract

Implementation must retain controlled support for:

`TASK-###`

`CR-###`

`VR-###`

and the one-controlled-work-item execution principle.

The validator does not execute work items.

It only ensures those core contract concepts remain present.

---

# 12. Finding Namespace Contract

Minimum finding namespaces are:

Design Review:

`DR-###`

Code Review:

`CR-###`

Verification:

`VC-###`

and:

`VR-###`

These namespaces must not disappear during skill-based refactoring.

---

# 13. Expected Shared Skills

The framework expects:

`sdlc-governance`

`git-baseline-safety`

`sdlc-traceability`

`review-findings`

`test-verification`

`source-ingestion`

`github-pr-operations`

`document-quality`

`agent-contract-validator`

Every skill must contain:

`SKILL.md`

and the frontmatter:

`name`

must match the skill directory.

---

# 14. Supporting Skill Files

The current framework additionally expects:

`sdlc-traceability/traceability-schema.md`

`review-findings/finding-lifecycle.md`

`test-verification/evidence-format.md`

`source-ingestion/source-authority.md`

`source-ingestion/extract_docx.py`

`github-pr-operations/github-operation-policy.md`

`document-quality/quality-checklist.md`

Do not delete these during agent refactoring without deliberately updating the
framework contract.

---

# 15. Validation Result

The validator produces:

`PASS`

when no contract errors exist.

It produces:

`FAIL`

when one or more contract errors exist.

Warnings may be displayed for non-fatal conditions.

Warnings do not automatically mean the framework is unusable.

---

# 16. Error Versus Warning

Use ERROR for conditions such as:

- required agent missing
- invalid/missing frontmatter
- duplicate agent name
- wrong expected agent name
- specialist unexpectedly has delegation tool
- orchestrator lacks delegation tool
- required lifecycle marker removed
- mandatory PR section removed
- required skill missing
- required skill support file missing
- skill frontmatter name mismatch

Use WARNING for non-fatal conditions such as:

- unexpected additional agent
- unexpected additional skill
- optional convention drift
- legacy helper still present during migration

---

# 17. Running the Validator

From the repository root:

`python .github/skills/agent-contract-validator/validate_agents.py`

Optional explicit root:

`python .github/skills/agent-contract-validator/validate_agents.py --repo-root .`

Machine-readable output:

`python .github/skills/agent-contract-validator/validate_agents.py --json`

---

# 18. When to Run It

Run after:

- creating a new skill
- refactoring an agent to use skills
- changing frontmatter
- renaming an agent
- changing orchestration logic
- removing duplicated content
- changing lifecycle status vocabulary
- modifying PR requirements

During the upcoming migration, run it after every individual agent refactor.

---

# 19. Validator Failure

A validator failure means:

the framework contract may have been broken.

Do not automatically rewrite files to satisfy the validator.

First determine whether:

1. the refactor accidentally broke the framework; or
2. the framework contract was intentionally redesigned.

For an intentional redesign:

update the validator deliberately as part of the same governed framework
change.

---

# 20. Validator Scope

The validator checks structural contracts.

It does NOT prove:

- requirements are correct
- architecture is good
- code is correct
- tests pass
- a review finding is valid
- Verification should pass
- a PR should be created

Those judgments belong to the specialist agents.

---

# 21. Final Principle

The validator exists to prevent:

`shared-skill refactoring`

from accidentally becoming:

`SDLC governance weakening`.

A smaller agent is good only when its important contract remains intact.
