---
name: github-pr-operations
description: >
  Shared GitHub Pull Request operation procedure for the controlled Agentic
  SDLC. Use this skill when discovering GitHub repository identity, selecting
  an approved GitHub transport, checking for an existing Pull Request,
  pushing a governed feature branch, creating or updating a Pull Request,
  retrieving PR metadata or checks, determining base/head branches, handling
  GitHub authentication limitations, or preserving idempotency. Prefer an
  approved GitHub integration or MCP capability when available, fall back to
  authenticated GitHub CLI when necessary, and never merge automatically.
---

# Agentic SDLC GitHub PR Operations

This skill defines the reusable GitHub interaction procedure used primarily by:

`STEP 8 — Pull Request`

and by the SDLC Orchestrator when it needs to understand GitHub PR state.

It provides:

- GitHub capability selection
- repository identity validation
- branch push rules
- existing PR discovery
- PR creation
- PR update
- PR metadata retrieval
- CI/check status retrieval
- authentication handling
- idempotency
- safe failure behavior

It does NOT:

- determine whether implementation is correct
- approve Code Review
- approve Verification
- create production implementation
- modify requirements
- merge Pull Requests

The PR Agent remains responsible for deciding whether Step 8 gates have passed.

For detailed transport and permission rules, also read:

`github-operation-policy.md`

---

# 1. Core Principle

The required capability is:

`perform an approved GitHub operation`

not:

`use one specific executable`

Do not make GitHub CLI availability the only valid implementation path when an
approved GitHub integration or MCP capability is already available.

Transport choice must preserve:

- authorization
- repository identity
- branch safety
- lifecycle governance
- idempotency
- auditability

---

# 2. Supported Operation Channels

Approved GitHub operations may use:

## Preferred

`GITHUB_INTEGRATION`

Examples:

- approved GitHub MCP server
- approved GitHub connector
- organization-provided GitHub integration

Use only when the capability is actually exposed to the current agent and
authorized for the requested operation.

## Fallback

`GITHUB_CLI`

using:

`gh`

when:

- GitHub integration is unavailable for the required operation
- `gh` is installed
- authentication is valid
- repository access is authorized

## Local Git

`git`

is appropriate for repository-local operations such as:

- repository inspection
- branch inspection
- remote inspection
- normal feature-branch push

when authentication permits the push.

Do not require `gh` merely to execute:

`git push`

---

# 3. Transport Selection

For each GitHub operation:

1. identify the required capability
2. determine whether an approved GitHub integration exposes it
3. if yes, prefer the integration
4. otherwise check whether GitHub CLI supports it
5. if neither path is available, report the specific missing capability
6. do not substitute an unapproved transport

Do not assume that because one integration operation exists, every GitHub
operation exists.

Example:

An MCP capability may support:

`create Pull Request`

but not:

`push local Git commits`

Use Git for the push and MCP for PR creation when appropriate.

---

# 4. Capability-Specific Availability

Evaluate capabilities individually.

Common capabilities include:

`READ_REPOSITORY`

`READ_DEFAULT_BRANCH`

`READ_PULL_REQUEST`

`LIST_PULL_REQUESTS`

`CREATE_PULL_REQUEST`

`UPDATE_PULL_REQUEST`

`READ_PR_CHECKS`

`READ_CHANGED_FILES`

`REQUEST_REVIEWERS`

`PUSH_BRANCH`

Do not report:

`GitHub unavailable`

when only one specific capability is unavailable.

Prefer:

`CREATE_PULL_REQUEST capability unavailable`

or another precise condition.

---

# 5. Repository Identity

Before creating or updating a PR, establish:

- repository owner
- repository name
- remote URL
- current local Git repository
- current head branch
- intended base branch

Do not create a PR against a repository inferred only from a similarly named
folder.

Repository identity must be supported by actual Git/GitHub evidence.

---

# 6. Local Repository Validation

Use safe local Git inspection when available:

`git rev-parse --show-toplevel`

`git remote -v`

`git branch --show-current`

`git rev-parse HEAD`

Use the repository's Git baseline safety skill for detailed baseline
classification.

This skill does not duplicate Git-baseline approval logic.

---

# 7. Remote Resolution

Determine the intended GitHub remote.

Common remote:

`origin`

Do not blindly assume `origin` when:

- multiple remotes exist
- fork workflows are used
- repository policy defines another push remote

When ambiguity is material:

use known repository configuration or human guidance.

---

# 8. Base Branch Resolution

Resolve the intended PR base from:

1. explicit user instruction
2. repository/project policy
3. existing PR metadata
4. GitHub repository default branch

Do not invent:

`main`

or:

`master`

when repository metadata can determine the actual base.

---

# 9. Head Branch Resolution

The PR head must correspond to the governed feature/change branch.

Do not create a Pull Request where:

`head == base`

Do not knowingly package unreviewed work from another branch.

Use the Git baseline safety rules before Step 8.

---

# 10. Branch Push Capability

A local branch push normally uses:

`git push`

not:

`gh pr create`

The preferred safe pattern is:

`git push -u <remote> <head-branch>`

when:

- branch is authorized
- baseline is valid
- repository credentials permit push
- specialist contract authorizes Step 8 push

Do not force push.

---

# 11. Missing Push Authentication

If normal Git push fails because credentials are unavailable:

report:

`STEP 8 BLOCKED — FEATURE BRANCH PUSH AUTHENTICATION REQUIRED`

Do not convert the failure into:

`GITHUB CLI NOT AVAILABLE`

unless GitHub CLI is specifically required for the chosen push mechanism.

---

# 12. Existing Pull Request Discovery

Before creating a PR:

search for an open Pull Request with the same repository/head branch.

Prefer stable repository/head matching.

Do not rely only on PR title text.

Possible outcomes:

`NO_EXISTING_PR`

`EXISTING_OPEN_PR`

`EXISTING_CLOSED_PR`

`EXISTING_MERGED_PR`

For normal idempotency:

an existing appropriate open PR should be updated rather than duplicated.

---

# 13. Existing PR Through GitHub Integration

When approved GitHub integration supports PR search/list/read:

use it to identify:

- PR number
- PR state
- head branch
- base branch
- title
- URL
- current body

Use exact repository identity.

---

# 14. Existing PR Through GitHub CLI

When integration is unavailable and authenticated `gh` exists:

use repository-native commands such as:

`gh pr list`

`gh pr view`

Prefer structured output when practical.

Do not parse human-readable terminal output unnecessarily when structured
output is available.

---

# 15. Pull Request Creation

Create a new PR only when:

- all Step 8 lifecycle gates pass
- required branch has been pushed
- no appropriate open PR already exists
- title is finalized
- body is finalized
- base/head are known

The PR Agent owns the final PR content.

---

# 16. Pull Request Creation Through Integration

When approved GitHub integration supports PR creation:

provide:

- repository
- base branch
- head branch
- title
- body
- draft state when governed

Capture returned:

- PR number
- PR URL
- PR state

Do not assume success if the operation returns an error or incomplete result.

---

# 17. Pull Request Creation Through CLI

When `gh` fallback is required:

preferred pattern:

`gh pr create --base <base> --head <head> --title "<title>" --body-file <file>`

Use a temporary body file where practical.

Do not commit the temporary body file.

Do not expose secrets in shell arguments.

---

# 18. Pull Request Update

When an appropriate open PR already exists:

update the existing PR rather than create a duplicate.

Permitted metadata updates may include:

- title
- body
- draft/ready state when governed
- reviewers when explicitly authorized

Do not rewrite unrelated PR metadata unnecessarily.

---

# 19. Pull Request Update Through Integration

Use the approved GitHub integration update capability when available.

Preserve:

- correct PR number
- repository identity
- base/head relationship

Do not accidentally update another branch's PR.

---

# 20. Pull Request Update Through CLI

Fallback pattern:

`gh pr edit <PR> --title "<title>" --body-file <file>`

Use the exact PR identity.

Do not select a PR only because its title looks similar.

---

# 21. PR Content Responsibility

This skill performs GitHub operations.

It does NOT generate or own the required PR body sections.

The PR Agent owns:

- Summary
- Changes Made
- Test Evidence
- Known Limitations
- Reviewer Checklist

The GitHub operation must transmit the PR Agent's finalized content accurately.

---

# 22. Draft State

Default Step 8 behavior after:

`VERIFICATION_PASSED`

is normally a ready-for-review PR.

Use Draft only when:

- user explicitly requests it
- repository policy requires it
- governed workflow requires it

Do not use Draft as a way to bypass missing lifecycle gates.

---

# 23. Reviewer Assignment

Assign reviewers only when reviewer identity is deterministically available
from:

- explicit user instruction
- repository policy
- CODEOWNERS/governed configuration
- approved workflow configuration

Do not invent GitHub usernames.

The Reviewer Checklist inside the PR body is separate from actual reviewer
assignment.

---

# 24. PR Metadata Validation

After creation/update, retrieve the PR and confirm:

- PR exists
- repository is correct
- PR number exists
- PR URL exists
- title is correct
- base is correct
- head is correct
- required body was applied
- state is correct

Do not report success solely because an API/CLI command was attempted.

---

# 25. Check / CI Retrieval

When approved GitHub capability can read PR checks:

retrieve current check state when useful.

Possible states include:

`PASSING`

`FAILING`

`PENDING`

`NOT_AVAILABLE`

Do not convert:

`PENDING`

into:

`PASSING`

Do not invent CI results.

---

# 26. CLI CI Retrieval

When using `gh`, commands may include:

`gh pr checks`

or appropriate structured alternatives.

Do not wait indefinitely for CI unless the user/workflow explicitly requires
synchronous completion.

---

# 27. Pre-PR Verification Versus CI

`Verification Status: VERIFICATION_PASSED`

is the formal Step 7 lifecycle gate.

Post-PR CI is additional GitHub-hosted evidence.

CI does not retroactively manufacture a missing Step 7 Verification approval.

Likewise:

local Verification passing does not mean current PR CI has passed.

Keep these states distinct.

---

# 28. Authentication Detection — Integration

An approved GitHub integration may handle authentication outside the local
shell.

If the integration successfully performs the requested action:

do not additionally require:

`gh auth status`

The absence of GitHub CLI authentication is irrelevant when CLI is not being
used.

---

# 29. Authentication Detection — CLI

When CLI fallback is required:

validate:

`gh --version`

and:

`gh auth status`

before relying on `gh`.

If `gh` is missing but an approved GitHub integration can perform the needed
operation:

continue using the integration.

Do NOT block merely because `gh` is missing.

---

# 30. CLI Missing

Use:

`GITHUB_CLI_NOT_AVAILABLE`

only to describe the CLI capability.

It becomes a Step 8 blocker only when:

- the required GitHub operation cannot be performed through an approved
  integration
- and CLI is the required fallback
- and no other approved transport exists

---

# 31. Integration Missing

If GitHub integration/MCP is not available:

do not automatically block when authenticated `gh` can perform the operation.

Use the CLI fallback.

---

# 32. Both Paths Missing

If neither:

- approved GitHub integration
- authenticated GitHub CLI

can perform a required GitHub server operation:

report:

`STEP 8 BLOCKED — GITHUB PR OPERATION CAPABILITY REQUIRED`

Include the missing operation.

Example:

`Missing capability: CREATE_PULL_REQUEST`

Do not pretend the PR was created.

---

# 33. Read-Only Versus Write Capabilities

A GitHub integration may be authorized for read but not write.

Example:

repository metadata succeeds

but:

PR creation is denied.

Treat:

`READ_PULL_REQUEST`

and:

`CREATE_PULL_REQUEST`

as separate capabilities.

Do not infer write authorization from successful reads.

---

# 34. Permission Failure

When GitHub rejects an operation because of permissions:

report:

`PERMISSION_DENIED`

and the requested operation.

Do not attempt to bypass repository protections.

Do not escalate token scopes automatically.

---

# 35. Branch Protection

If push or PR creation conflicts with repository protection:

respect the protection.

Do not:

- force push
- disable protection
- push directly to base as a workaround
- use elevated credentials without authorization

Report the repository constraint.

---

# 36. No Merge

This skill must never automatically merge the Pull Request.

Do not invoke:

- merge PR
- squash merge
- rebase merge
- auto-merge

unless a future separately governed lifecycle explicitly authorizes merge.

For the current controlled SDLC:

PR creation/update is the terminal GitHub action.

---

# 37. No Auto-Close

Do not close an existing PR merely because:

- metadata is inconsistent
- a duplicate may exist
- Step 8 is rerun

Report the condition or update the appropriate open PR.

Closing PRs requires explicit authority.

---

# 38. No Issue Mutation

PR operations do not authorize unrelated:

- issue edits
- issue closure
- label mutation
- milestone mutation
- project board changes

unless explicitly governed.

Keep Step 8 scope narrow.

---

# 39. Idempotency

The same Step 8 operation should be safe to rerun.

Before writing:

- resolve repository
- resolve branch
- locate existing PR
- compare current metadata
- update only when needed

Do not create duplicate Pull Requests for the same controlled branch.

---

# 40. Retry Safety

If PR creation returns an uncertain failure:

before retrying:

search for an existing PR on the same head branch.

The first operation may have succeeded even if the response was interrupted.

Do not blindly retry creation.

---

# 41. Rate Limit / Temporary Failure

For temporary GitHub service failures:

do not claim success.

Record:

`TEMPORARY_GITHUB_FAILURE`

Retry only within the current controlled operation when reasonable.

Do not loop indefinitely.

---

# 42. Repository Forks

If the head branch comes from a fork:

identify:

- head repository
- base repository
- branch name

Do not assume same-repository PR semantics.

Follow repository policy.

If fork handling cannot be determined safely:

block and report the ambiguity.

---

# 43. Changed Files

When GitHub integration can return PR changed files:

use them as supporting evidence.

For pre-PR local preparation, Git remains the primary source for the actual
candidate diff.

Do not substitute an old remote PR diff for current unpushed local work.

---

# 44. Git Baseline Dependency

Before push/PR creation:

apply the repository's:

`git-baseline-safety`

skill.

This skill assumes the release candidate has already passed the required
baseline gates.

If baseline safety reports:

`MATERIAL_CHANGE_AFTER_VERIFICATION`

do not create/update the PR as a valid Step 8 result.

Route through the SDLC lifecycle.

---

# 45. SDLC Governance Dependency

Before any PR write action:

apply:

`sdlc-governance`

The required lifecycle gate is:

Requirements APPROVED
Architecture DESIGN_REVIEW_APPROVED
Design Review DESIGN_REVIEW_APPROVED
Implementation Plan READY_FOR_IMPLEMENTATION
Implementation Plan Approval APPROVED
Implementation READY_FOR_CODE_REVIEW
Code Review CODE_REVIEW_APPROVED
Verification VERIFICATION_PASSED

This skill must not bypass those gates.

---

# 46. Test Evidence Dependency

PR test evidence should come from:

`test-verification`

evidence produced by governed phases.

Do not rerun arbitrary checks solely to manufacture an attractive PR body.

The PR Agent may inspect current CI separately.

---

# 47. Sensitive Data

Never include in GitHub PR operations:

- access token
- credential
- API key
- password
- private key
- sensitive environment value

Do not log authentication material.

---

# 48. Temporary PR Body Files

When CLI requires a body file:

create it outside tracked project content where practical.

After use:

do not commit it.

Removal must not affect unrelated files.

---

# 49. Operation Evidence

Record successful PR operation evidence such as:

GitHub Transport:
Repository:
Base Branch:
Head Branch:
Operation:
PR Number:
PR URL:
PR State:
CI State:
Result:

Do not record secret authentication details.

---

# 50. Failure Evidence

When a GitHub operation fails, record:

Operation:
Transport:
Repository:
Reason:
Result:
Required Action:

Example:

Operation:
CREATE_PULL_REQUEST

Transport:
GITHUB_CLI

Reason:
Authentication required

Result:
BLOCKED

Required Action:
Authenticate GitHub CLI or provide an approved GitHub integration with PR
write capability.

---

# 51. Transport Does Not Change Governance

Whether Step 8 uses:

- GitHub MCP
- GitHub connector
- GitHub CLI

the SDLC rules are identical.

Transport choice must never change:

- required upstream approvals
- PR content requirements
- branch safety
- no-merge rule
- baseline validation
- human-review responsibility

---

# 52. Final Rule

Choose the safest authorized GitHub capability that is actually available.

Do not confuse:

`one tool is unavailable`

with:

`the GitHub operation is impossible`.

Block only when the required operation cannot be performed safely through any
approved available transport.