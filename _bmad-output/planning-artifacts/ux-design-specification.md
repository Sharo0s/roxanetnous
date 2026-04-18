---
stepsCompleted: [1, 2]
inputDocuments:
  - prd.md
  - product-brief-roxanetnous-2026-02-09.md
  - architecture-technique-roxanetnous-2026-02-09.md
---

# UX Design Specification roxanetnous

**Author:** Sylvain
**Date:** 2026-02-10

---

## Executive Summary

### Vision Projet

Marketplace de confiance pour l'aide à domicile. Mise en relation directe entre auxiliaires de vie vérifiés et bénéficiaires (personnes âgées/dépendantes et leurs proches), sans intermédiaire. Abonnement symétrique avec hard paywall.

### Utilisateurs Cibles

| Persona | Profil | Compétence tech | Appareil principal |
|---------|--------|----------------|-------------------|
| **Sophie** (35 ans) | Auxiliaire indépendante, cherche des clients | Moyenne | Mobile/Desktop |
| **Marie** (78 ans) | Bénéficiaire âgée, assistée par un proche (Thomas, 42 ans) | Très faible (Marie) / Moyenne (Thomas) | Tablette |
| **Jean** (50 ans) | Proche d'une bénéficiaire, cherche à distance | Bonne | Desktop |
| **Sylvain** | Admin/fondateur, seul | Haute | Desktop |

### Défis UX Clés

1. **Double audience contradictoire** — Interface simple pour un proche de 78 ans sur tablette, complète pour une auxiliaire professionnelle. Servir les deux sans frustrer l'un ou l'autre.
2. **Parcours de confiance avant paywall** — Le visiteur doit être convaincu de payer avant de voir les profils. La landing page doit créer assez de confiance et de valeur perçue pour convertir.
3. **Flux de vérification sans friction** — Profil → upload documents → attente validation 24-48h → paiement → publication. Funnel long, chaque étape doit être claire et motivante.

### Opportunités UX

1. **Preuves sociales dynamiques** — Compteur "X auxiliaires vérifiés", badges visibles, témoignages éditoriaux (non publiés par les utilisateurs) → confiance visuelle dès la landing page, sans exposition au risque juridique des avis utilisateur.
2. **Boutons d'orientation** — "Je suis aidant" / "Je recherche un aidant" → parcours personnalisé dès la première seconde.
3. **Interface sobre et rassurante** — Couleurs chaudes, typographie lisible, espacement généreux. Design mature adapté au secteur aide à domicile.

---

## Flow admin — Validation auxiliaire (3 statuts intermédiaires)

Ajouté le 2026-04-18 suite à la décision FR11bis (validation par visio obligatoire). Le flux de validation d'une auxiliaire comporte désormais 3 statuts intermédiaires entre `en_attente` et `valide` :

1. **Queue `en_attente`** : revue documentaire (justificatifs + OCR). L'admin choisit entre « Passer en attente de visio », « Demander complément » ou « Refuser ».
2. **Décision intermédiaire** : à la transition vers `visio_a_planifier`, un email de convocation est envoyé automatiquement à l'auxiliaire.
3. **Queue `visio_a_planifier`** : auxiliaires dont le dossier est clean, en attente de créneau visio. L'admin convient d'un créneau (hors plateforme) puis, après la visio, saisit date + notes libres.
4. **Visio réalisée** : transition vers `visio_realisee`, tracée dans le log admin (`action_type='visio_realisee'`, payload `{ visio_date, notes? }`).
5. **Queue `visio_realisee`** : validation finale possible. Le bouton « Valider » est actif uniquement à ce stade (FR11ter).

Les décisions « Demander complément » et « Refuser » restent accessibles depuis tout statut intermédiaire. Une édition du profil par l'auxiliaire après passage en `visio_a_planifier` ou `visio_realisee` provoque un retour à `en_attente` (revue documentaire à refaire).
