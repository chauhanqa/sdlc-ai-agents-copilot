# GitHub Copilot Instructions — Agentic SDLC Framework

## Repository Purpose

This repository contains a reusable **Agentic Software Development Life Cycle (SDLC) framework** implemented with GitHub Copilot custom agents and reusable skills.

The framework must remain generic and reusable across application types, programming languages, frameworks, and technology stacks.

Do not introduce application-specific assumptions into the framework unless explicitly requested.

---

# Core SDLC Model

The governed lifecycle is:

1. Requirements
2. Architecture
3. Design Review
4. Implementation Planning
5. Implementation
6. Code Review
7. Verification
8. Pull Request

The canonical traceability chain is:

```text
User Story
→ FR / BR / NFR / AC
→ CMP / AD
→ DR
→ TASK
→ code / tests
→ CR
→ VC / VR
→ PR
```

Each lifecycle phase has a dedicated specialist agent.

The SDLC Orchestrator coordinates these agents but must not perform specialist lifecycle work itself.

---

# Agent Responsibilities

The repository contains the following lifecycle agents:

```text
requirements
architecture
design-review
implementation-planning
implementation
code-review
verification
pr
sdlc-orchestrator
```

Each specialist owns its lifecycle artifact.

Agents must respect artifact ownership and must not silently modify artifacts owned by another lifecycle phase.

When an earlier lifecycle artifact requires a material change, route the work back to the owning agent.

Do not repair upstream problems silently in downstream phases.

---

# Lifecycle Governance

Lifecycle phases must be completed in governed order unless the user explicitly requests a targeted phase or controlled remediation action.

Use the repository's `sdlc-governance` skill as the authoritative source for lifecycle gates, routing, remediation, stale-state handling, and completion rules.

Canonical lifecycle gates include:

```text
Requirements Status: APPROVED

Architecture Status: READY_FOR_DESIGN_REVIEW

Architecture Status: DESIGN_REVIEW_APPROVED

Design Review Status: DESIGN_REVIEW_APPROVED

Implementation Plan Status: READY_FOR_IMPLEMENTATION

Implementation Plan Approval: APPROVED

Implementation Status: READY_FOR_CODE_REVIEW

Code Review Status: CODE_REVIEW_APPROVED

Verification Status: VERIFICATION_PASSED

PR Status: PR_CREATED
or
PR Status: PR_UPDATED

Agentic SDLC Status: COMPLETE
```

Do not infer or fabricate approval.

Human approvals and human decisions must come from the user or an authorized reviewer.

---

# Human Decision Gates

Never fabricate:

- requirements clarification answers
- Requirements approval
- blocking Architecture Question answers
- Design Review finding decisions
- Implementation Planning clarification answers
- Implementation Plan approval
- Code Review finding decisions
- governed Verification finding decisions
- credentials
- authorization
- governance exceptions

When human input is required, stop at the appropriate lifecycle gate and clearly identify the required decision.

---

# Project Root

Distinguish between:

```text
GIT_REPOSITORY_ROOT
```

and:

```text
PROJECT_ROOT
```

For a new project, the Requirements Agent establishes the project root.

For an existing project, use the existing application root.

Lifecycle documents belong under:

```text
<PROJECT_ROOT>/docs/sdlc/
```

Custom agents belong under:

```text
.github/agents/
```

Reusable skills belong under:

```text
.github/skills/
```

---

# Shared Skills

Detailed procedures belong in reusable skills rather than being duplicated across agents or this instruction file.

Important shared skills include:

```text
sdlc-governance
git-baseline-safety
sdlc-traceability
review-findings
test-verification
source-ingestion
github-pr-operations
document-quality
agent-contract-validator
```

Agents should reference and follow the appropriate skills for their responsibilities.

Do not copy large portions of skill procedures into agent files unless necessary for a specific agent contract.

---

# Traceability

Use permanent lifecycle identifiers.

Supported namespaces include:

```text
RQ-###
FR-###
BR-###
NFR-###
AC-###
AQ-###
CMP-###
AD-###
ARISK-###
DR-###
PQ-###
TASK-###
CR-###
VC-###
VR-###
```

Never reuse identifiers for unrelated lifecycle items.

Never invent references to lifecycle items that do not exist.

Maintain traceability between requirements, architecture, review findings, implementation tasks, code changes, tests, verification cases, and PR evidence.

Use the `sdlc-traceability` skill for detailed rules.

---

# Review Findings

Design Review, Code Review, and Verification findings must use explicit finding lifecycles.

A human decision such as:

```text
ACCEPTED
```

does not mean:

```text
RESOLVED
```

The specialist responsible for remediation performs the change.

The independent review agent that created or owns the finding verifies the remediation and resolves it.

Do not allow implementation agents to mark Code Review or Verification findings as resolved.

Use the `review-findings` skill for finding lifecycle rules.

---

# Git Safety

Preserve unrelated user changes.

Do not use destructive Git commands unless explicitly authorized.

Avoid:

```text
git reset --hard
git clean -fd
git checkout -- .
git restore .
force push
history rewriting
```

Do not stage unrelated files.

Do not treat a commit as lifecycle approval.

Material implementation changes can invalidate Code Review or Verification baselines.

Use the `git-baseline-safety` skill for detailed baseline and repository safety rules.

---

# Testing and Verification

Never claim that a command, build, test, check, validator, workflow, or verification passed unless it was actually executed and its result was observed.

Use the following result vocabulary where applicable:

```text
PASS
FAIL
BLOCKED
NOT_APPLICABLE
NOT_VERIFIED
```

`BLOCKED` and `NOT_VERIFIED` are never equivalent to `PASS`.

Focused checks do not automatically satisfy full verification.

Evidence must correspond to the current candidate revision.

Use the `test-verification` skill for detailed testing and evidence requirements.

---

# Source Ingestion

External source acquisition for requirements must remain read-only.

Possible sources include:

- Jira
- Confluence
- Word documents
- repository files
- normalized user stories

Source ingestion must not create functional requirements, business requirements, non-functional requirements, acceptance criteria, or approvals.

The Requirements Agent owns requirements analysis.

Use the `source-ingestion` skill for source normalization and authority handling.

---

# Pull Request Operations

Pull Request operations must use the repository-approved GitHub capability hierarchy defined by the `github-pr-operations` skill.

Prefer:

1. approved GitHub integration, connector, or MCP capability
2. authenticated GitHub CLI when appropriate
3. explicit blocked state when the required operation is unavailable

Do not require GitHub CLI when another approved GitHub capability is available.

Never automatically merge a Pull Request.

The final merge remains a human or repository-governance responsibility.

---

# Documentation Quality

Lifecycle documents, changelogs, and Pull Request content must accurately represent the current repository state.

Do not fabricate:

- test evidence
- implementation details
- requirement coverage
- limitations
- file changes
- validation results

Use the `document-quality` skill for detailed quality checks.

---

# Orchestrator Behavior

When the user requests a complete SDLC workflow, lifecycle continuation, resume, status, or cross-phase remediation, use the `sdlc-orchestrator`.

The orchestrator must:

- determine the earliest unsatisfied lifecycle gate
- delegate specialist work to the correct agent
- respect human decision gates
- coordinate remediation and re-review loops
- preserve lifecycle artifact ownership
- track stale downstream phases
- avoid performing specialist work itself
- never merge the Pull Request

For controlled implementation requests such as:

```text
Implement TASK-007
```

execute only the requested work item unless the user explicitly asks to continue.

For:

```text
Run Step 5
```

the Implementation Agent may be invoked repeatedly, but each invocation handles only one governed implementation work item.

---

# Material Change Handling

Material changes to an upstream lifecycle artifact invalidate affected downstream approvals.

Examples:

```text
Requirements material change
→ Architecture and downstream phases may become stale

Architecture material change
→ Design Review and downstream phases may become stale

Implementation Plan material change
→ Implementation and downstream phases may become stale

Implementation material change after Code Review
→ Code Review approval becomes stale

Implementation material change after Verification
→ Code Review and Verification must be repeated as required
```

Use `sdlc-governance` and `git-baseline-safety` to determine exact routing.

---

# Framework Validation

Changes under:

```text
.github/agents/
.github/skills/
```

must preserve framework contracts.

Run:

```bash
python3 .github/skills/agent-contract-validator/validate_agents.py
```

The desired framework result is:

```text
Result: PASS
Errors: 0
Warnings: 0
```

Do not claim this result unless the validator was actually executed.

Local Git hooks and GitHub Actions may also invoke this validator.

---

# Repository Hooks

Repository-managed hooks are located under:

```text
.githooks/
```

Developer setup is performed using:

```bash
./scripts/setup-hooks.sh
```

The hooks provide local developer feedback.

They are not the authoritative SDLC lifecycle engine.

Do not implement lifecycle state transitions or human approval logic inside Git hooks.

---

# General Engineering Rules

Prefer the smallest safe change that satisfies the requested lifecycle work.

Preserve existing repository conventions.

Do not add unnecessary dependencies.

Do not introduce application-specific technology choices into this generic framework.

Do not expose secrets, credentials, tokens, or private configuration.

Do not claim actions were performed unless they were actually completed and verified.

When blocked, report the exact blocker rather than silently bypassing governance.

When requirements or evidence are insufficient, use the appropriate lifecycle clarification or blocked state instead of guessing.

---

# Framework Principle

The framework should maintain this separation of concerns:

```text
Copilot Instructions
→ repository-wide conventions

Skills
→ reusable detailed procedures

Specialist Agents
→ lifecycle-specific reasoning and artifact ownership

SDLC Orchestrator
→ routing and lifecycle coordination

Git Hooks
→ local fast feedback

GitHub Actions
→ repository validation

Repository Rules
→ optional merge enforcement

Human
→ approvals, governed decisions, and final merge
```

Maintain this separation when extending or refactoring the framework.