# Agentic SDLC Framework Architecture

## 1. Purpose

This document describes the high-level architecture of the Agentic SDLC Framework.

The framework uses:

- GitHub Copilot custom agents
- reusable skills
- explicit lifecycle gates
- human decisions
- traceability identifiers
- independent review agents
- remediation loops
- Git baseline validation
- test and verification evidence
- Git hooks
- GitHub Actions
- optional repository merge enforcement

The framework is intentionally application-agnostic.

---

# 2. Architecture Goals

The architecture is designed to provide:

1. **Separation of concerns**
   Each lifecycle phase is handled by a specialist agent.

2. **Independent review**
   Review agents do not silently repair the work they review.

3. **Human governance**
   Important approvals and decisions cannot be fabricated by agents.

4. **Traceability**
   Requirements can be traced through architecture, tasks, implementation, review, verification, and Pull Request evidence.

5. **Reusable behavior**
   Cross-cutting procedures are implemented as shared skills.

6. **Safe automation**
   Git and repository operations preserve unrelated developer work.

7. **Evidence integrity**
   Tests and checks are never reported as passed unless actually executed.

8. **Framework validation**
   Agent and skill contracts can be checked deterministically.

---

# 3. High-Level Architecture

```mermaid
flowchart TB

    USER["Developer / Human Reviewer"]

    ORCH["SDLC Orchestrator<br/>Coordination & Routing"]

    subgraph SPECIALISTS["Specialist SDLC Agents"]
        direction LR

        REQ["Requirements<br/>Agent"]
        ARCH["Architecture<br/>Agent"]
        DR["Design Review<br/>Agent"]
        PLAN["Implementation Planning<br/>Agent"]
        IMPL["Implementation<br/>Agent"]
        CR["Code Review<br/>Agent"]
        VER["Verification<br/>Agent"]
        PR["PR<br/>Agent"]
    end

    subgraph SHARED["Shared Skills"]
        direction LR

        GOV["SDLC<br/>Governance"]
        TRACE["SDLC<br/>Traceability"]
        GIT["Git Baseline<br/>Safety"]
        FIND["Review<br/>Findings"]
        TEST["Test<br/>Verification"]
        INGEST["Source<br/>Ingestion"]
        GH["GitHub PR<br/>Operations"]
        DOC["Document<br/>Quality"]
        CONTRACT["Agent Contract<br/>Validator"]
    end

    subgraph PLATFORM["Repository / Platform Controls"]
        direction LR

        INSTRUCTIONS["Copilot<br/>Instructions"]
        HOOKS["Git<br/>Hooks"]
        CI["GitHub<br/>Actions"]
        RULES["Optional<br/>Repository Rules"]
    end

    USER --> ORCH

    ORCH --> REQ
    ORCH --> ARCH
    ORCH --> DR
    ORCH --> PLAN
    ORCH --> IMPL
    ORCH --> CR
    ORCH --> VER
    ORCH --> PR

    REQ --> SHARED
    ARCH --> SHARED
    DR --> SHARED
    PLAN --> SHARED
    IMPL --> SHARED
    CR --> SHARED
    VER --> SHARED
    PR --> SHARED

    INSTRUCTIONS --> SPECIALISTS
    CONTRACT --> HOOKS
    CONTRACT --> CI
    CI --> RULES
```

---

# 4. Lifecycle Architecture

The governed lifecycle is:

```mermaid
flowchart LR

    STORY["User Story"]

    R["Step 1<br/>Requirements"]
    A["Step 2<br/>Architecture"]
    D["Step 3<br/>Design Review"]
    P["Step 4<br/>Implementation Planning"]
    I["Step 5<br/>Implementation"]
    C["Step 6<br/>Code Review"]
    V["Step 7<br/>Verification"]
    PR["Step 8<br/>Pull Request"]

    STORY --> R
    R --> A
    A --> D
    D --> P
    P --> I
    I --> C
    C --> V
    V --> PR
```

Lifecycle phases are sequential at the governance level, but remediation may temporarily route execution back to an earlier owning phase.

---

# 5. Orchestration Model

The SDLC Orchestrator is a coordinator rather than a specialist.

```mermaid
flowchart TB

    REQUEST["User Request"]

    ORCH["SDLC Orchestrator"]

    STATE["Read Lifecycle State"]
    GATE["Find Earliest<br/>Unsatisfied Gate"]
    ROUTE["Select Owning<br/>Specialist"]
    DELEGATE["Delegate Work"]
    RESULT["Inspect Specialist Result"]

    HUMAN{"Human input<br/>required?"}
    BLOCKED{"Blocked?"}
    COMPLETE{"Target or lifecycle<br/>complete?"}

    WAIT["WAITING_FOR_HUMAN"]
    STOP["BLOCKED"]
    NEXT["Advance to Next Gate"]
    DONE["COMPLETE"]

    REQUEST --> ORCH
    ORCH --> STATE
    STATE --> GATE
    GATE --> ROUTE
    ROUTE --> DELEGATE
    DELEGATE --> RESULT

    RESULT --> HUMAN
    HUMAN -->|Yes| WAIT
    HUMAN -->|No| BLOCKED

    BLOCKED -->|Yes| STOP
    BLOCKED -->|No| COMPLETE

    COMPLETE -->|No| NEXT
    NEXT --> GATE

    COMPLETE -->|Yes| DONE
```

The orchestrator must not create specialist lifecycle artifacts itself.

---

# 6. Specialist Ownership Model

```mermaid
flowchart LR

    REQ["Requirements Agent"]
    REQA["requirements.md"]

    ARCH["Architecture Agent"]
    ARCHA["architecture.md"]

    DR["Design Review Agent"]
    DRA["design-review.md"]

    PLAN["Implementation Planning Agent"]
    PLANA["impl-plan.md"]

    IMPL["Implementation Agent"]
    IMPLA["implementation-log.md<br/>code + tests"]

    CR["Code Review Agent"]
    CRA["code-review.md"]

    VER["Verification Agent"]
    VERA["verification.md"]

    ORCH["SDLC Orchestrator"]
    ORCHA["orchestration-state.md"]

    REQ --> REQA
    ARCH --> ARCHA
    DR --> DRA
    PLAN --> PLANA
    IMPL --> IMPLA
    CR --> CRA
    VER --> VERA
    ORCH --> ORCHA
```

Artifact ownership is exclusive for lifecycle authority.

A downstream agent can identify an upstream issue but must route remediation back to the owning specialist.

---

# 7. Requirements-to-Delivery Traceability

```mermaid
flowchart LR

    STORY["User Story"]

    REQ["FR / BR / NFR"]
    AC["AC"]

    ARCH["CMP / AD"]
    DR["DR"]

    TASK["TASK"]

    CODE["Code"]
    TESTS["Tests"]

    CR["CR"]

    VC["VC"]
    VR["VR"]

    PR["Pull Request"]

    STORY --> REQ
    REQ --> AC

    REQ --> ARCH
    AC --> ARCH

    ARCH --> DR

    REQ --> TASK
    AC --> TASK
    ARCH --> TASK
    DR --> TASK

    TASK --> CODE
    TASK --> TESTS

    CODE --> CR
    TESTS --> CR

    REQ --> VC
    AC --> VC
    CODE --> VC
    TESTS --> VC

    VC --> VR

    CR --> PR
    VC --> PR
    VR --> PR
```

The model supports many-to-many traceability.

For example:

```text
FR-003
 ├── AC-004
 ├── AC-005
 ├── CMP-002
 ├── TASK-006
 ├── TASK-007
 ├── VC-010
 └── VC-011
```

---

# 8. Human Approval Gates

Human participation is intentionally preserved.

```mermaid
flowchart TB

    REQ["Requirements"]
    RH{"Requirements<br/>approved?"}

    ARCH["Architecture"]
    DR["Design Review"]
    DH{"Review findings<br/>decided?"}

    PLAN["Implementation Plan"]
    PH{"Plan<br/>approved?"}

    IMPL["Implementation"]
    CR["Code Review"]
    CH{"Review findings<br/>decided?"}

    VER["Verification"]
    PR["Pull Request"]
    MERGE["Human / Repository<br/>Merge Decision"]

    REQ --> RH
    RH -->|Yes| ARCH
    RH -->|No| REQ

    ARCH --> DR
    DR --> DH

    DH -->|Approved / resolved| PLAN
    DH -->|Changes required| ARCH

    PLAN --> PH
    PH -->|Yes| IMPL
    PH -->|No| PLAN

    IMPL --> CR
    CR --> CH

    CH -->|Approved / resolved| VER
    CH -->|Changes required| IMPL

    VER --> PR
    PR --> MERGE
```

Agents may prepare decisions for humans but cannot fabricate the human response.

---

# 9. Design Review Remediation Loop

The Design Review Agent acts as an independent reviewer.

```mermaid
sequenceDiagram

    participant O as SDLC Orchestrator
    participant D as Design Review Agent
    participant H as Human Reviewer
    participant A as Architecture Agent

    O->>D: Review architecture
    D->>D: Create DR findings

    alt Blocking findings exist
        D->>H: Request finding decisions
        H->>D: ACCEPTED / REJECTED / DEFERRED

        alt Architecture remediation required
            D->>O: ARCHITECTURE_CHANGES_REQUIRED
            O->>A: Remediate accepted DR finding
            A->>O: READY_FOR_DESIGN_REVIEW
            O->>D: Re-review finding
            D->>D: Validate remediation
            D->>O: RESOLVED / further finding
        end

    else No blocking findings
        D->>O: DESIGN_REVIEW_APPROVED
    end
```

The Architecture Agent performs architecture remediation.

The Design Review Agent decides whether the remediation resolves the review finding.

---

# 10. Code Review Remediation Loop

```mermaid
sequenceDiagram

    participant O as SDLC Orchestrator
    participant C as Code Review Agent
    participant H as Human Reviewer
    participant I as Implementation Agent

    O->>C: Review implementation
    C->>C: Create CR findings

    alt Blocking finding
        C->>H: Request decision
        H->>C: ACCEPTED

        C->>O: IMPLEMENTATION_CHANGES_REQUIRED
        O->>I: Remediate one CR finding
        I->>O: READY_FOR_REREVIEW
        O->>C: Re-review implementation
        C->>C: Verify remediation
        C->>O: RESOLVED / further action

    else Clean review
        C->>O: CODE_REVIEW_APPROVED
    end
```

The Implementation Agent must never mark a `CR-###` finding resolved.

---

# 11. Verification Remediation Loop

```mermaid
sequenceDiagram

    participant O as SDLC Orchestrator
    participant V as Verification Agent
    participant I as Implementation Agent
    participant C as Code Review Agent

    O->>V: Verify reviewed candidate
    V->>V: Execute VC cases

    alt Verification defect found
        V->>V: Create VR finding
        V->>O: REMEDIATION_REQUIRED
        O->>I: Remediate one VR

        alt Material implementation change
            I->>O: Implementation changed
            O->>C: Re-review changed candidate
            C->>O: CODE_REVIEW_APPROVED
        end

        O->>V: Re-run original VC + regression
        V->>V: Resolve VR if evidence passes

    else All required verification passes
        V->>O: VERIFICATION_PASSED
    end
```

Material implementation changes after Code Review invalidate the prior reviewed baseline.

---

# 12. Shared Skill Architecture

Skills implement reusable procedures across agents.

```mermaid
flowchart TB

    subgraph CORE["Governance Skills"]
        GOV["sdlc-governance"]
        TRACE["sdlc-traceability"]
        GIT["git-baseline-safety"]
    end

    subgraph REVIEW["Review & Quality"]
        FIND["review-findings"]
        TEST["test-verification"]
        DOC["document-quality"]
    end

    subgraph INTEGRATION["Integration"]
        SOURCE["source-ingestion"]
        GH["github-pr-operations"]
    end

    subgraph FRAMEWORK["Framework Integrity"]
        VALIDATOR["agent-contract-validator"]
    end

    CORE --> REVIEW
    REVIEW --> INTEGRATION
    INTEGRATION --> FRAMEWORK
```

The skills are not lifecycle phases.

They provide reusable behavior to the specialist agents.

---

# 13. Repository Validation Architecture

```mermaid
flowchart LR

    DEV["Developer"]

    EDIT["Agent / Skill Change"]

    PRE["pre-commit"]
    COMMIT["Git Commit"]
    MSG["commit-msg"]
    PUSH["git push"]
    PREPUSH["pre-push"]

    GITHUB["GitHub"]
    ACTION["Framework Validation<br/>GitHub Action"]

    OPTIONAL["Optional<br/>Repository Rules"]

    MERGE["PR Merge"]

    DEV --> EDIT
    EDIT --> PRE

    PRE -->|"PASS"| COMMIT
    PRE -->|"FAIL"| EDIT

    COMMIT --> MSG
    MSG -->|"PASS"| PUSH
    MSG -->|"FAIL"| EDIT

    PUSH --> PREPUSH
    PREPUSH -->|"PASS"| GITHUB
    PREPUSH -->|"FAIL"| EDIT

    GITHUB --> ACTION

    ACTION -->|"PASS"| OPTIONAL
    ACTION -->|"FAIL"| EDIT

    OPTIONAL --> MERGE
```

Local hooks provide fast feedback.

GitHub Actions provides independent repository-side validation.

Repository protection rules are optional for the learning project but can turn successful validation into a required merge gate.

---

# 14. Contract Validator

The deterministic contract validator is located at:

```text
.github/skills/agent-contract-validator/validate_agents.py
```

It checks framework-level contracts such as:

- expected agents
- expected skills
- agent frontmatter
- specialist tooling boundaries
- orchestrator delegation capability
- lifecycle markers
- artifact ownership markers
- traceability identifier namespaces
- required PR sections

Execute it with:

```bash
python3 .github/skills/agent-contract-validator/validate_agents.py
```

The desired result is:

```text
Result: PASS
Errors: 0
Warnings: 0
```

The validator supplements AI reasoning with deterministic structural validation.

---

# 15. Test Evidence Model

```mermaid
flowchart LR

    CODE["Candidate Code"]

    TEST["Execute Check"]
    RESULT{"Observed Result"}

    PASS["PASS"]
    FAIL["FAIL"]
    BLOCKED["BLOCKED"]
    NA["NOT_APPLICABLE"]
    NV["NOT_VERIFIED"]

    EVIDENCE["Evidence Record"]

    CODE --> TEST
    TEST --> RESULT

    RESULT --> PASS
    RESULT --> FAIL
    RESULT --> BLOCKED
    RESULT --> NA
    RESULT --> NV

    PASS --> EVIDENCE
    FAIL --> EVIDENCE
    BLOCKED --> EVIDENCE
    NA --> EVIDENCE
    NV --> EVIDENCE
```

Only executed checks can be reported as passed.

`BLOCKED` and `NOT_VERIFIED` are never equivalent to `PASS`.

---

# 16. Baseline Integrity

Three concepts must remain distinct:

```text
Current Git Candidate
Reviewed Candidate
Verified Candidate
```

Conceptually:

```mermaid
flowchart LR

    CODE["Implementation Candidate"]

    CR["Code Review"]
    REVIEWED["Reviewed Baseline"]

    VER["Verification"]
    VERIFIED["Verified Baseline"]

    PR["Pull Request"]

    CODE --> CR
    CR -->|"Approved"| REVIEWED
    REVIEWED --> VER
    VER -->|"Passed"| VERIFIED
    VERIFIED --> PR
```

If code materially changes after Code Review:

```text
Code Review becomes stale.
```

If code materially changes after Verification:

```text
Code Review and Verification may both become stale.
```

The Git Baseline Safety skill governs these conditions.

---

# 17. Pull Request Boundary

The PR Agent operates only after the lifecycle gates are satisfied.

```mermaid
flowchart TB

    R["Requirements Approved"]
    A["Architecture Approved"]
    D["Design Review Approved"]
    P["Plan Approved"]
    I["Implementation Complete"]
    C["Code Review Approved"]
    V["Verification Passed"]

    READY{"All gates current?"}

    PR["PR Agent"]

    BODY["Create / Update PR<br/><br/>Summary<br/>Changes Made<br/>Test Evidence<br/>Known Limitations<br/>Reviewer Checklist"]

    HUMAN["Human Review / Merge"]

    R --> READY
    A --> READY
    D --> READY
    P --> READY
    I --> READY
    C --> READY
    V --> READY

    READY -->|Yes| PR
    READY -->|No| BLOCK["Route to earliest<br/>unsatisfied gate"]

    PR --> BODY
    BODY --> HUMAN
```

The PR Agent never performs the final merge.

---

# 18. Separation of Concerns

The intended architecture boundary is:

```text
Copilot Instructions
        ↓
Repository-wide conventions

Skills
        ↓
Reusable procedures

Specialist Agents
        ↓
Lifecycle reasoning and artifact ownership

SDLC Orchestrator
        ↓
Routing and lifecycle coordination

Git Hooks
        ↓
Fast local repository feedback

GitHub Actions
        ↓
Independent repository validation

Repository Rules
        ↓
Optional merge enforcement

Humans
        ↓
Approvals, governed decisions and final merge
```

This separation should be preserved when extending the framework.

---

# 19. Key Architecture Decisions

The framework intentionally uses:

**Separate Requirements and Architecture Agents**
Requirements define what the system must do. Architecture defines how the system should be structured.

**Independent Design Review**
The Architecture Agent must not review and silently approve its own architecture.

**Independent Code Review**
The Implementation Agent must not approve its own implementation.

**Separate Verification**
Passing implementation-level tests does not replace independent final verification.

**Shared Skills**
Cross-cutting procedures are centralized rather than copied into every agent.

**Explicit Human Gates**
AI automation must stop when a governed human decision is necessary.

**Persistent Traceability IDs**
Lifecycle relationships remain auditable across phases.

**Deterministic Contract Validation**
A Python validator checks framework structure independently of model reasoning.

---

# 20. Future Architecture Extensions

Potential learning extensions include:

```text
Agent behavioral evaluation suite
        ↓
Scenario-based orchestration tests
        ↓
Machine-readable artifact metadata
        ↓
Lifecycle event observability
        ↓
Architecture Decision Records
        ↓
Example completed SDLC project
        ↓
Framework versioning and releases
```

The priority should be proving the existing architecture end-to-end before introducing additional lifecycle agents.
