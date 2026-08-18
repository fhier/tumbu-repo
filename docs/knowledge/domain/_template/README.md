# How to create new domain

1. Copy this _template folder to knowledge/domain/{newDomain}/
2. Rename files and replace INV-XXX with INV-NEWDOMAIN-001, etc.
3. Fill lifecycle, invariants, events
4. Ensure dependencies is correct per DependencyGraph.md
5. Run Quality Gate checklist in governance/QualityGate.md
6. Commit as feat(knowledge): lock {newDomain} v1.0.0 - STABLE
