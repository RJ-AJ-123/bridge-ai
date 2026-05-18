# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

## Triage state labels (5 canonical roles)

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Because this repo uses local markdown for issue tracking (see `issue-tracker.md`), a label is recorded as a `Status:` line near the top of each issue file. Example:

```markdown
# Fix login redirect loop

Status: needs-triage
Labels: bug
```

## Type labels (project-specific)

In addition to the triage state, every issue should carry one or more type labels to describe its category. Record these as a `Labels:` line near the top of the issue file (comma-separated when multiple apply).

| Label         | Meaning                                                        |
| ------------- | -------------------------------------------------------------- |
| `bug`         | Something is broken or behaving incorrectly                    |
| `feature`     | New capability that doesn't exist yet                          |
| `enhancement` | Improvement to an existing capability                          |
| `docs`        | Documentation work (READMEs, ADRs, comments, guides)           |
| `refactor`    | Internal restructuring without changing external behavior      |
| `test`        | Adding or improving tests                                      |
| `blocked`     | Cannot proceed until some external dependency is resolved      |

Triage state labels and type labels are orthogonal — an issue typically has exactly one of each (except `blocked`, which can stack with another type label).

Edit either table later if the vocabulary changes.
