# GitHub Operation Policy

This reference defines capability selection for Agentic SDLC GitHub operations.

---

# 1. Capability Matrix

| Operation | Preferred | Fallback |
|---|---|---|
| Read repository metadata | GitHub integration | `gh repo view` |
| Resolve default branch | GitHub integration | `gh repo view` |
| Find existing PR | GitHub integration | `gh pr list/view` |
| Read PR | GitHub integration | `gh pr view` |
| Create PR | GitHub integration | `gh pr create` |
| Update PR | GitHub integration | `gh pr edit` |
| Read PR checks | GitHub integration | `gh pr checks` |
| Push local branch | normal `git push` | repository-approved alternative |
| Read local diff | local Git | N/A |
| Validate working tree | local Git | N/A |

Do not require GitHub CLI for an operation already supported by an approved
GitHub integration.

---

# 2. Transport Decision

```text
Required GitHub operation
        │
        ▼
Approved GitHub integration exposes operation?
        │
    ┌───┴───┐
   YES      NO
    │        │
    ▼        ▼
Use       Is authenticated gh
integration available for operation?
             │
         ┌───┴───┐
        YES      NO
         │        │
         ▼        ▼
       use gh    BLOCK
```

---

# 3. Push Decision

```text
Feature branch must be pushed
        │
        ▼
Correct remote resolved?
        │
       YES
        │
        ▼
Normal git push authorized?
        │
    ┌───┴───┐
   YES      NO
    │        │
    ▼        ▼
git push   BLOCK
```

GitHub CLI is not inherently required for branch push.

---

# 4. Example — MCP Available, gh Missing

State:

```text
GitHub integration:
CREATE_PULL_REQUEST = available

gh:
not installed

git push:
available
```

Result:

```text
Do NOT block for missing gh.

Use:
git push
→ GitHub integration CREATE_PULL_REQUEST
```

---

# 5. Example — MCP Read-Only, gh Available

State:

```text
GitHub integration:
READ_PULL_REQUEST = available
CREATE_PULL_REQUEST = unavailable

gh:
installed and authenticated
```

Result:

```text
Use integration for reads where useful.

Use gh for PR creation.
```

---

# 6. Example — gh Available, No MCP

State:

```text
GitHub integration:
unavailable

gh:
installed and authenticated
```

Result:

```text
Use gh.
```

---

# 7. Example — Neither Write Path Available

State:

```text
GitHub integration:
read only

gh:
not installed / unauthenticated
```

Required operation:

```text
CREATE_PULL_REQUEST
```

Result:

```text
STEP 8 BLOCKED — GITHUB PR OPERATION CAPABILITY REQUIRED

Missing capability:
CREATE_PULL_REQUEST
```

---

# 8. Existing PR Idempotency

Before:

`CREATE_PULL_REQUEST`

always perform:

`FIND_EXISTING_PR_FOR_HEAD`

If found:

```text
UPDATE_PULL_REQUEST
```

when metadata needs updating.

If already correct:

no duplicate write is required.

---

# 9. Retry Rule

After uncertain create failure:

```text
search existing PR
```

before:

```text
retry create
```

This prevents duplicate PRs.

---

# 10. Write Permission Rule

Successful:

`READ_REPOSITORY`

does not prove:

`CREATE_PULL_REQUEST`

permission.

Validate the capability required by the specific operation.

---

# 11. Merge Policy

Current Agentic SDLC policy:

```text
CREATE/UPDATE PR:
ALLOWED by Step 8 contract

MERGE PR:
NOT AUTHORIZED
```

Transport availability never changes this rule.

---

# 12. Operation Result Vocabulary

Use:

`SUCCESS`

`BLOCKED`

`PERMISSION_DENIED`

`NOT_AVAILABLE`

`TEMPORARY_FAILURE`

`INVALID_REQUEST`

`UNKNOWN`

Do not report SUCCESS until the resulting GitHub state is verified.

---

# 13. Required PR Creation Evidence

After creation verify:

```text
PR Number
PR URL
Repository
Base Branch
Head Branch
Title
State
```

The final PR Agent additionally validates mandatory body sections.

---

# 14. Governing Principle

Select transport by capability.

Select lifecycle action by SDLC governance.

Those are different decisions.