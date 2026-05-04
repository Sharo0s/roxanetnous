# Story {{epic_num}}.{{story_num}}: {{story_title}}

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a {{role}},
I want {{action}},
so that {{benefit}}.

## Acceptance Criteria

1. [Add acceptance criteria from epics/PRD]

## Tasks / Subtasks

- [ ] Task 1 (AC: #)
  - [ ] Subtask 1.1
- [ ] Task 2 (AC: #)
  - [ ] Subtask 2.1

## Dev Notes

- Relevant architecture patterns and constraints
- Source tree components to touch
- Testing standards summary

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming)
- Detected conflicts or variances (with rationale)

### References

- Cite all technical details with source paths and sections, e.g. [Source: docs/<file>.md#Section]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## DoD a11y

A renseigner pour toute story avec impact UI (ignorer si pas de changement visuel/interactif) :

- [ ] Labels associes aux champs (`htmlFor` ou `aria-labelledby`)
- [ ] Erreurs liees aux champs via `aria-describedby` + `aria-invalid`
- [ ] Focus visible sur tous les elements interactifs (contraste >= 3:1)
- [ ] Contrastes texte >= 4,5:1 et UI >= 3:1
- [ ] ARIA states corrects sur composants dynamiques (`aria-expanded`, `aria-selected`, etc.)
- [ ] Navigation clavier complete (Tab, Enter, Escape, fleches selon pattern)
- [ ] Verification ponctuelle au lecteur d'ecran (VoiceOver ou NVDA) sur le composant touche
- [ ] Pas de regression `eslint-plugin-jsx-a11y` (`npm run lint:a11y-check` vert en CI)
