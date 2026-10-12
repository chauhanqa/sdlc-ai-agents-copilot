from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


EXPECTED_AGENTS = {
    "requirements": {
        "file": "requirements.agent.md",
        "artifact_markers": ["docs/sdlc/requirements.md"],
        "contract_markers": ["APPROVED"],
        "finding_markers": [],
        "disable_model_invocation": False,
    },
    "architecture": {
        "file": "architecture.agent.md",
        "artifact_markers": ["docs/sdlc/architecture.md"],
        "contract_markers": [
            "READY_FOR_DESIGN_REVIEW",
            "DESIGN_REVIEW_APPROVED",
        ],
        "finding_markers": [],
        "disable_model_invocation": False,
    },
    "design-review": {
        "file": "design-review.agent.md",
        "artifact_markers": ["docs/sdlc/design-review.md"],
        "contract_markers": ["DESIGN_REVIEW_APPROVED"],
        "finding_markers": ["DR-###"],
        "disable_model_invocation": False,
    },
    "implementation-planning": {
        "file": "implementation-planning.agent.md",
        "artifact_markers": ["docs/sdlc/impl-plan.md"],
        "contract_markers": [
            "READY_FOR_IMPLEMENTATION",
            "Implementation Plan Approval",
        ],
        "finding_markers": ["TASK-###"],
        "disable_model_invocation": False,
    },
    "implementation": {
        "file": "implementation.agent.md",
        "artifact_markers": ["docs/sdlc/implementation-log.md"],
        "contract_markers": ["READY_FOR_CODE_REVIEW"],
        "finding_markers": [
            "TASK-###",
            "CR-###",
            "VR-###",
        ],
        "disable_model_invocation": False,
    },
    "code-review": {
        "file": "code-review.agent.md",
        "artifact_markers": ["docs/sdlc/code-review.md"],
        "contract_markers": ["CODE_REVIEW_APPROVED"],
        "finding_markers": ["CR-###"],
        "disable_model_invocation": False,
    },
    "verification": {
        "file": "verification.agent.md",
        "artifact_markers": ["docs/sdlc/verification.md"],
        "contract_markers": ["VERIFICATION_PASSED"],
        "finding_markers": [
            "VC-###",
            "VR-###",
        ],
        "disable_model_invocation": False,
    },
    "pr": {
        "file": "pr.agent.md",
        "artifact_markers": [],
        "contract_markers": [
            "PR_CREATED",
            "PR_UPDATED",
            "Summary",
            "Changes Made",
            "Test Evidence",
            "Known Limitations",
            "Reviewer Checklist",
        ],
        "finding_markers": [],
        "disable_model_invocation": False,
    },
    "sdlc-orchestrator": {
        "file": "sdlc-orchestrator.agent.md",
        "artifact_markers": ["docs/sdlc/orchestration-state.md"],
        "contract_markers": ["AGENTIC SDLC COMPLETE"],
        "finding_markers": [],
        "disable_model_invocation": True,
    },
}


SPECIALIST_NAMES = {
    "requirements",
    "architecture",
    "design-review",
    "implementation-planning",
    "implementation",
    "code-review",
    "verification",
    "pr",
}


EXPECTED_SKILLS = {
    "sdlc-governance": ["SKILL.md"],
    "git-baseline-safety": ["SKILL.md"],
    "sdlc-traceability": [
        "SKILL.md",
        "traceability-schema.md",
    ],
    "review-findings": [
        "SKILL.md",
        "finding-lifecycle.md",
    ],
    "test-verification": [
        "SKILL.md",
        "evidence-format.md",
    ],
    "source-ingestion": [
        "SKILL.md",
        "source-authority.md",
        "extract_docx.py",
    ],
    "github-pr-operations": [
        "SKILL.md",
        "github-operation-policy.md",
    ],
    "document-quality": [
        "SKILL.md",
        "quality-checklist.md",
    ],
    "agent-contract-validator": [
        "SKILL.md",
        "validate_agents.py",
    ],
}


BASE_SPECIALIST_TOOLS = {
    "read",
    "search",
    "edit",
    "execute",
}


REQUIRED_REQUIREMENTS_TOOLS = {
    "atlassian/getAccessibleAtlassianResources",
    "atlassian/discover",
    "atlassian/executeRead",
    "atlassian/getJiraIssue",
    "atlassian/searchJiraIssuesUsingJql",
    "atlassian/getConfluenceContent",
    "atlassian/searchConfluence",
}


@dataclass
class Finding:
    level: str
    code: str
    message: str
    path: str | None = None

    def as_dict(self) -> dict[str, str | None]:
        return {
            "level": self.level,
            "code": self.code,
            "message": self.message,
            "path": self.path,
        }


def find_repo_root(explicit: str | None) -> Path:
    if explicit:
        return Path(explicit).expanduser().resolve()

    script_path = Path(__file__).resolve()

    # Expected:
    # <repo>/.github/skills/agent-contract-validator/validate_agents.py
    candidate = script_path.parents[3]

    if (candidate / ".github").is_dir():
        return candidate

    current = Path.cwd().resolve()

    for parent in [current, *current.parents]:
        if (parent / ".github").is_dir():
            return parent

    raise RuntimeError(
        "Could not locate repository root. "
        "Use --repo-root to specify it explicitly."
    )


def extract_frontmatter(text: str) -> str | None:
    match = re.match(
        r"\A---\s*\r?\n(.*?)\r?\n---\s*(?:\r?\n|\Z)",
        text,
        re.DOTALL,
    )

    if not match:
        return None

    return match.group(1)


def scalar_value(frontmatter: str, key: str) -> str | None:
    pattern = rf"(?m)^{re.escape(key)}:\s*(.*?)\s*$"
    match = re.search(pattern, frontmatter)

    if not match:
        return None

    value = match.group(1).strip()

    if value in {">", "|"}:
        return value

    return value.strip("\"'")


def bool_value(frontmatter: str, key: str) -> bool | None:
    value = scalar_value(frontmatter, key)

    if value is None:
        return None

    lowered = value.lower()

    if lowered == "true":
        return True

    if lowered == "false":
        return False

    return None


def list_block(frontmatter: str, key: str) -> list[str]:
    lines = frontmatter.splitlines()
    items: list[str] = []

    start = None

    for index, line in enumerate(lines):
        if re.match(rf"^{re.escape(key)}:\s*$", line):
            start = index + 1
            break

    if start is None:
        return items

    for line in lines[start:]:
        if line and not line[0].isspace():
            break

        match = re.match(r"^\s*-\s+(.+?)\s*$", line)

        if match:
            items.append(match.group(1).strip().strip("\"'"))

    return items


def contains_marker(text: str, marker: str) -> bool:
    return marker.lower() in text.lower()


def contains_identifier_namespace(text: str, marker: str) -> bool:
    """
    Validate an SDLC identifier namespace.

    Accepts either the generic notation:
        VC-###

    or an actual three-digit identifier:
        VC-001
        VC-012

    The supplied marker is expected in the form:
        VC-###
        CR-###
        DR-###
        TASK-###
        VR-###
    """
    if marker.endswith("-###"):
        prefix = marker[:-4]

        pattern = rf"\b{re.escape(prefix)}-(?:###|\d{{3}})\b"

        return re.search(
            pattern,
            text,
            re.IGNORECASE,
        ) is not None

    return contains_marker(text, marker)


def add(
    findings: list[Finding],
    level: str,
    code: str,
    message: str,
    path: Path | str | None = None,
) -> None:
    findings.append(
        Finding(
            level=level,
            code=code,
            message=message,
            path=str(path) if path is not None else None,
        )
    )


def validate_agent(
    agent_name: str,
    spec: dict,
    agent_path: Path,
    findings: list[Finding],
) -> tuple[str | None, set[str]]:
    if not agent_path.is_file():
        add(
            findings,
            "ERROR",
            "AGENT_MISSING",
            f"Required agent '{agent_name}' is missing.",
            agent_path,
        )
        return None, set()

    text = agent_path.read_text(encoding="utf-8")
    frontmatter = extract_frontmatter(text)

    if frontmatter is None:
        add(
            findings,
            "ERROR",
            "FRONTMATTER_MISSING",
            f"Agent '{agent_name}' has no valid YAML frontmatter block.",
            agent_path,
        )
        return None, set()

    actual_name = scalar_value(frontmatter, "name")

    if not actual_name:
        add(
            findings,
            "ERROR",
            "AGENT_NAME_MISSING",
            f"Agent '{agent_name}' has no frontmatter name.",
            agent_path,
        )
    elif actual_name != agent_name:
        add(
            findings,
            "ERROR",
            "AGENT_NAME_MISMATCH",
            (
                f"Expected agent name '{agent_name}' but frontmatter declares "
                f"'{actual_name}'."
            ),
            agent_path,
        )

    description = scalar_value(frontmatter, "description")

    if description is None:
        add(
            findings,
            "ERROR",
            "DESCRIPTION_MISSING",
            f"Agent '{agent_name}' has no description field.",
            agent_path,
        )

    include_custom = bool_value(
        frontmatter,
        "include-custom-instructions",
    )

    if include_custom is not True:
        add(
            findings,
            "ERROR",
            "CUSTOM_INSTRUCTIONS_CONTRACT",
            (
                f"Agent '{agent_name}' must keep "
                "include-custom-instructions: true."
            ),
            agent_path,
        )

    user_invocable = bool_value(frontmatter, "user-invocable")

    if user_invocable is not True:
        add(
            findings,
            "ERROR",
            "USER_INVOCABLE_CONTRACT",
            f"Agent '{agent_name}' must remain user-invocable.",
            agent_path,
        )

    disable_model = bool_value(
        frontmatter,
        "disable-model-invocation",
    )

    expected_disable = spec["disable_model_invocation"]

    if disable_model is not expected_disable:
        add(
            findings,
            "ERROR",
            "MODEL_INVOCATION_CONTRACT",
            (
                f"Agent '{agent_name}' expected "
                f"disable-model-invocation: "
                f"{str(expected_disable).lower()}."
            ),
            agent_path,
        )

    tools = set(list_block(frontmatter, "tools"))

    if agent_name in SPECIALIST_NAMES:
        missing_tools = sorted(BASE_SPECIALIST_TOOLS - tools)

        if missing_tools:
            add(
                findings,
                "ERROR",
                "SPECIALIST_TOOLS_MISSING",
                (
                    f"Agent '{agent_name}' is missing base tool(s): "
                    f"{', '.join(missing_tools)}."
                ),
                agent_path,
            )

        if "agent" in tools:
            add(
                findings,
                "ERROR",
                "SPECIALIST_DELEGATION_VIOLATION",
                (
                    f"Specialist '{agent_name}' unexpectedly exposes the "
                    "'agent' delegation tool."
                ),
                agent_path,
            )

    if agent_name == "requirements":
        missing_atlassian = sorted(
            REQUIRED_REQUIREMENTS_TOOLS - tools
        )

        if missing_atlassian:
            add(
                findings,
                "ERROR",
                "REQUIREMENTS_SOURCE_TOOLS_MISSING",
                (
                    "Requirements Agent is missing approved Atlassian "
                    f"read tool(s): {', '.join(missing_atlassian)}."
                ),
                agent_path,
            )

    if agent_name == "sdlc-orchestrator":
        expected_tools = BASE_SPECIALIST_TOOLS | {"agent"}
        missing_tools = sorted(expected_tools - tools)

        if missing_tools:
            add(
                findings,
                "ERROR",
                "ORCHESTRATOR_TOOLS_MISSING",
                (
                    "Orchestrator is missing required tool(s): "
                    f"{', '.join(missing_tools)}."
                ),
                agent_path,
            )

    for marker in spec["artifact_markers"]:
        if not contains_marker(text, marker):
            add(
                findings,
                "ERROR",
                "ARTIFACT_CONTRACT_MISSING",
                (
                    f"Agent '{agent_name}' no longer references required "
                    f"artifact marker '{marker}'."
                ),
                agent_path,
            )

    for marker in spec["contract_markers"]:
        if not contains_marker(text, marker):
            add(
                findings,
                "ERROR",
                "LIFECYCLE_MARKER_MISSING",
                (
                    f"Agent '{agent_name}' no longer contains required "
                    f"contract marker '{marker}'."
                ),
                agent_path,
            )

    for marker in spec["finding_markers"]:
        if not contains_identifier_namespace(text, marker):
            add(
                findings,
                "ERROR",
                "IDENTIFIER_CONTRACT_MISSING",
                (
                    f"Agent '{agent_name}' no longer contains required "
                    f"identifier namespace '{marker}'."
                ),
                agent_path,
            )

    return actual_name, tools


def validate_orchestrator_specialists(
    path: Path,
    findings: list[Finding],
) -> None:
    if not path.is_file():
        return

    text = path.read_text(encoding="utf-8")

    for specialist in sorted(SPECIALIST_NAMES):
        if not contains_marker(text, specialist):
            add(
                findings,
                "ERROR",
                "ORCHESTRATOR_SPECIALIST_MISSING",
                (
                    "Orchestrator no longer references required specialist "
                    f"'{specialist}'."
                ),
                path,
            )


def validate_pr_contract(
    path: Path,
    findings: list[Finding],
) -> None:
    if not path.is_file():
        return

    text = path.read_text(encoding="utf-8")

    required_sections = [
        "Summary",
        "Changes Made",
        "Test Evidence",
        "Known Limitations",
        "Reviewer Checklist",
    ]

    for section in required_sections:
        if not contains_marker(text, section):
            add(
                findings,
                "ERROR",
                "PR_SECTION_CONTRACT_MISSING",
                (
                    "PR Agent no longer contains mandatory PR section "
                    f"'{section}'."
                ),
                path,
            )


def validate_implementation_work_items(
    path: Path,
    findings: list[Finding],
) -> None:
    if not path.is_file():
        return

    text = path.read_text(encoding="utf-8")

    required = [
        "TASK-###",
        "CR-###",
        "VR-###",
    ]

    for marker in required:
        if not contains_marker(text, marker):
            add(
                findings,
                "ERROR",
                "IMPLEMENTATION_WORK_ITEM_MISSING",
                (
                    "Implementation Agent no longer contains controlled "
                    f"work-item marker '{marker}'."
                ),
                path,
            )

    one_item_signals = [
        "one controlled work item",
        "one-work-item",
        "exactly one",
    ]

    if not any(contains_marker(text, item) for item in one_item_signals):
        add(
            findings,
            "ERROR",
            "ONE_WORK_ITEM_CONTRACT_MISSING",
            (
                "Implementation Agent no longer clearly states the "
                "one-work-item execution boundary."
            ),
            path,
        )


def validate_skill(
    skill_name: str,
    required_files: list[str],
    skill_dir: Path,
    findings: list[Finding],
) -> str | None:
    if not skill_dir.is_dir():
        add(
            findings,
            "ERROR",
            "SKILL_MISSING",
            f"Required skill '{skill_name}' is missing.",
            skill_dir,
        )
        return None

    for filename in required_files:
        file_path = skill_dir / filename

        if not file_path.is_file():
            add(
                findings,
                "ERROR",
                "SKILL_FILE_MISSING",
                (
                    f"Skill '{skill_name}' is missing required file "
                    f"'{filename}'."
                ),
                file_path,
            )

    skill_file = skill_dir / "SKILL.md"

    if not skill_file.is_file():
        return None

    text = skill_file.read_text(encoding="utf-8")
    frontmatter = extract_frontmatter(text)

    if frontmatter is None:
        add(
            findings,
            "ERROR",
            "SKILL_FRONTMATTER_MISSING",
            f"Skill '{skill_name}' has no valid frontmatter.",
            skill_file,
        )
        return None

    declared_name = scalar_value(frontmatter, "name")

    if not declared_name:
        add(
            findings,
            "ERROR",
            "SKILL_NAME_MISSING",
            f"Skill '{skill_name}' does not declare a name.",
            skill_file,
        )
    elif declared_name != skill_name:
        add(
            findings,
            "ERROR",
            "SKILL_NAME_MISMATCH",
            (
                f"Skill directory '{skill_name}' declares name "
                f"'{declared_name}'."
            ),
            skill_file,
        )

    if scalar_value(frontmatter, "description") is None:
        add(
            findings,
            "ERROR",
            "SKILL_DESCRIPTION_MISSING",
            f"Skill '{skill_name}' has no description.",
            skill_file,
        )

    return declared_name


def warn_unexpected_agents(
    agents_dir: Path,
    findings: list[Finding],
) -> None:
    if not agents_dir.is_dir():
        return

    expected_files = {
        spec["file"]
        for spec in EXPECTED_AGENTS.values()
    }

    actual_files = {
        path.name
        for path in agents_dir.glob("*.agent.md")
        if path.is_file()
    }

    for filename in sorted(actual_files - expected_files):
        add(
            findings,
            "WARNING",
            "UNEXPECTED_AGENT",
            (
                f"Additional agent file '{filename}' is not part of the "
                "current canonical nine-agent framework."
            ),
            agents_dir / filename,
        )


def warn_unexpected_skills(
    skills_dir: Path,
    findings: list[Finding],
) -> None:
    if not skills_dir.is_dir():
        return

    actual = {
        path.name
        for path in skills_dir.iterdir()
        if path.is_dir()
    }

    for name in sorted(actual - set(EXPECTED_SKILLS)):
        add(
            findings,
            "WARNING",
            "UNEXPECTED_SKILL",
            (
                f"Additional skill '{name}' is not part of the current "
                "canonical shared-skill set."
            ),
            skills_dir / name,
        )


def check_duplicate_names(
    names: Iterable[tuple[str, str | None]],
    kind: str,
    findings: list[Finding],
) -> None:
    seen: dict[str, str] = {}

    for path, name in names:
        if not name:
            continue

        if name in seen:
            add(
                findings,
                "ERROR",
                f"DUPLICATE_{kind.upper()}_NAME",
                (
                    f"Duplicate {kind} name '{name}' found in "
                    f"'{seen[name]}' and '{path}'."
                ),
                path,
            )
        else:
            seen[name] = path


def run_validation(repo_root: Path) -> list[Finding]:
    findings: list[Finding] = []

    agents_dir = repo_root / ".github" / "agents"
    skills_dir = repo_root / ".github" / "skills"

    if not agents_dir.is_dir():
        add(
            findings,
            "ERROR",
            "AGENTS_DIRECTORY_MISSING",
            "Required .github/agents directory is missing.",
            agents_dir,
        )
        return findings

    if not skills_dir.is_dir():
        add(
            findings,
            "ERROR",
            "SKILLS_DIRECTORY_MISSING",
            "Required .github/skills directory is missing.",
            skills_dir,
        )
        return findings

    agent_names: list[tuple[str, str | None]] = []

    for agent_name, spec in EXPECTED_AGENTS.items():
        path = agents_dir / spec["file"]
        actual_name, _ = validate_agent(
            agent_name,
            spec,
            path,
            findings,
        )
        agent_names.append((str(path), actual_name))

    check_duplicate_names(
        agent_names,
        "agent",
        findings,
    )

    validate_orchestrator_specialists(
        agents_dir / EXPECTED_AGENTS["sdlc-orchestrator"]["file"],
        findings,
    )

    validate_pr_contract(
        agents_dir / EXPECTED_AGENTS["pr"]["file"],
        findings,
    )

    validate_implementation_work_items(
        agents_dir / EXPECTED_AGENTS["implementation"]["file"],
        findings,
    )

    warn_unexpected_agents(
        agents_dir,
        findings,
    )

    skill_names: list[tuple[str, str | None]] = []

    for skill_name, required_files in EXPECTED_SKILLS.items():
        path = skills_dir / skill_name
        declared_name = validate_skill(
            skill_name,
            required_files,
            path,
            findings,
        )
        skill_names.append((str(path), declared_name))

    check_duplicate_names(
        skill_names,
        "skill",
        findings,
    )

    warn_unexpected_skills(
        skills_dir,
        findings,
    )

    legacy_docx = (
        repo_root
        / ".github"
        / "scripts"
        / "extract_docx.py"
    )

    if legacy_docx.is_file():
        add(
            findings,
            "WARNING",
            "LEGACY_DOCX_HELPER_PRESENT",
            (
                "Legacy .github/scripts/extract_docx.py still exists. "
                "This is expected during the source-ingestion migration, "
                "but it can be removed after requirements.agent.md uses "
                "the skill-local helper."
            ),
            legacy_docx,
        )

    return findings


def print_human(
    repo_root: Path,
    findings: list[Finding],
) -> None:
    errors = [f for f in findings if f.level == "ERROR"]
    warnings = [f for f in findings if f.level == "WARNING"]

    print("Agentic SDLC Contract Validation")
    print(f"Repository: {repo_root}")
    print()

    if not findings:
        print("Result: PASS")
        print("Errors: 0")
        print("Warnings: 0")
        return

    for finding in findings:
        location = f" [{finding.path}]" if finding.path else ""
        print(
            f"{finding.level}: "
            f"{finding.code}: "
            f"{finding.message}"
            f"{location}"
        )

    print()
    print(f"Errors: {len(errors)}")
    print(f"Warnings: {len(warnings)}")
    print(
        "Result: "
        + ("FAIL" if errors else "PASS")
    )


def print_json(
    repo_root: Path,
    findings: list[Finding],
) -> None:
    errors = [f for f in findings if f.level == "ERROR"]
    warnings = [f for f in findings if f.level == "WARNING"]

    payload = {
        "repository": str(repo_root),
        "result": "FAIL" if errors else "PASS",
        "error_count": len(errors),
        "warning_count": len(warnings),
        "findings": [
            finding.as_dict()
            for finding in findings
        ],
    }

    print(json.dumps(payload, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Validate the Agentic SDLC custom-agent and skill contracts."
        )
    )

    parser.add_argument(
        "--repo-root",
        help="Repository root. Defaults to automatic discovery.",
    )

    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON output.",
    )

    args = parser.parse_args()

    try:
        repo_root = find_repo_root(args.repo_root)
        findings = run_validation(repo_root)
    except Exception as exc:
        if args.json:
            print(
                json.dumps(
                    {
                        "result": "ERROR",
                        "message": str(exc),
                    },
                    indent=2,
                )
            )
        else:
            print(
                f"Validator error: {exc}",
                file=sys.stderr,
            )

        return 2

    if args.json:
        print_json(repo_root, findings)
    else:
        print_human(repo_root, findings)

    has_errors = any(
        finding.level == "ERROR"
        for finding in findings
    )

    return 1 if has_errors else 0


if __name__ == "__main__":
    sys.exit(main())