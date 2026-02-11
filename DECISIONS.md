# Decisions projet roxanetnous

Ce fichier documente les decisions prises pendant le developpement.
Il fait autorite sur les documents bmad en cas de contradiction.

---

## 2026-02-11 : Suppression tarif horaire, PCH et APA

**Decision :** Tout ce qui concerne le tarif horaire, la modulation tarifaire PCH, la modulation tarifaire APA et le type aide_sociale est supprime du projet.

**Perimetre supprime :**
- Colonnes BDD : tarif_horaire, modulation_pch, modulation_apa (auxiliaires_profiles), tarif_min, tarif_max (annonces_auxiliaires), tarif_max, aide_sociale (annonces_beneficiaires), tarif (contrats), tarif_modulable_pch, tarif_modulable_apa (badges_cache)
- Type ENUM : aide_sociale_type
- Trigger : trigger_update_badge_modulation + fonction update_badge_modulation_tarifaire()
- Composant : step-tarification.tsx
- Etape "Tarification" du formulaire onboarding auxiliaire

**Regle :** Ne jamais reintroduire ces elements sauf demande explicite du client.

---

## 2026-02-11 : Design noir et blanc

**Decision :** Toute l'interface est en noir et blanc (pas de couleurs primaires vertes ni autres). Le client n'a pas encore choisi les couleurs.

**Regle :** Ne jamais ajouter de couleurs (primary-600, green, blue, etc.) sauf gris, noir et blanc. Pas d'emojis dans le code.

---

## 2026-02-11 : Suppression bloc "Engagement social" de la landing page

**Decision :** Le bloc "Badges PCH/APA pour faciliter l'acces aux aides sociales" est supprime de la landing page.
