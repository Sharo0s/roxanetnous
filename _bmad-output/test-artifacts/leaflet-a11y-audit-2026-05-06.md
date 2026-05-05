# Audit a11y composant Leaflet — 2026-05-06

**Story** : 2.6.6 — Audit Leaflet et alternative clavier
**Auditeur** : dev-story (claude-opus-4-7) en mode statique (DOM Leaflet 1.9 documente, code react-leaflet 5.0 inspecte)
**Composant audite** : `components/ui/map-radius-inner.tsx` (57 lignes, MapContainer + TileLayer + Circle)
**Wrapper** : `components/ui/map-radius.tsx` (35 lignes, geocoding Adresse API + dynamic import SSR-disabled)

## 1. Contexte

Le composant `MapRadius` est rendu par 5 usagers (`accompagnante/profile-form`, `accompagnante/nouvelle-annonce-form`, `accompagnante/step-localisation`, `accompagnante/modifier-annonce-form`, `accompagne/nouvelle-annonce-form`). Il s'agit d'une carte indicative affichant un cercle de rayon (km) autour d'une ville geocodee. **Aucune interaction n'est requise** : la carte est strictement informative — l'utilisateur saisit ville + rayon dans des champs de formulaire dedies, et la carte reagit en consequence.

Versions : `leaflet@^1.9.4`, `react-leaflet@^5.0.0`.

## 2. Constats

### 2.1 DOM Leaflet rendu (Leaflet 1.9)

Le `<MapContainer>` de react-leaflet 5 instancie un Leaflet 1.9 `Map` dont le DOM racine est :

```html
<div class="leaflet-container leaflet-touch leaflet-fade-anim leaflet-grab leaflet-touch-drag leaflet-touch-zoom"
     tabindex="0"
     role="region"
     aria-label="Map">
  <div class="leaflet-pane leaflet-map-pane">
    <!-- tile layers, overlays (markers, circles, popups) -->
  </div>
  <div class="leaflet-control-container">
    <div class="leaflet-top leaflet-left">
      <div class="leaflet-control-zoom leaflet-bar leaflet-control">
        <a class="leaflet-control-zoom-in" href="#" title="Zoom in" role="button" aria-label="Zoom in">+</a>
        <a class="leaflet-control-zoom-out" href="#" title="Zoom out" role="button" aria-label="Zoom out">-</a>
      </div>
    </div>
    <div class="leaflet-bottom leaflet-right">
      <div class="leaflet-control-attribution leaflet-control">
        <span>&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a></span>
      </div>
    </div>
  </div>
</div>
```

**Constats clavier** :

- Le conteneur racine `tabindex="0"` rend la carte focusable. Une fois focus dessus, les fleches (↑↓←→) panent la carte, +/- zooment. Tab quitte le conteneur (pas de focus piege).
- Les boutons zoom +/- sont des `<a role="button">` focusables individuellement (Tab stop apres le conteneur).
- Le lien attribution OpenStreetMap est focusable et **pointe vers une URL externe** (`https://www.openstreetmap.org/copyright`) — risque de friction pour les utilisateurs clavier (Tab les emmene hors de l'application).

**Constats lecteur d'ecran (VoiceOver attendu)** :

- Annonce racine : « Map, region » (anglais — le `aria-label="Map"` n'est pas localise par Leaflet 1.9).
- Au focus sur les boutons zoom : « Zoom in, button », « Zoom out, button » (anglais).
- Au focus sur l'attribution : annonce du lien externe « OpenStreetMap, link » + URL.

### 2.2 Pollution du flux clavier/SR

- 4 a 5 elements focusables ajoutes par carte rendue (conteneur + 2 boutons zoom + 1 lien attribution + tile layer indirect).
- Avec 5 usagers et plusieurs cartes potentiellement visibles dans une meme page (cas non present aujourd'hui mais possible), la pollution est multipliee.
- Aucune des 5 pages usagers ne **necessite** l'interaction carte : les champs `<CityAutocomplete>` et `<input type="range">` ou `<input type="number">` rayon couvrent integralement la fonctionnalite.

### 2.3 Spec axe-core actuelle

La spec `tests/a11y/p2-recherche.spec.ts` exclut deja `.leaflet-container`, `.leaflet-pane`, `[data-a11y-deferred="map"]` du scan axe (l.18). C'est une exclusion historique — elle reconnait que la carte n'apporte pas de valeur a11y et evite les faux positifs sur le DOM Leaflet.

Note : `/recherche` ne rend **pas** Leaflet directement (la carte est uniquement dans les formulaires de creation/modification d'annonce et l'onboarding). Mais l'exclusion P2 reste en place par precaution.

## 3. Verdict

- **Leaflet 1.9 a une a11y natif correcte** (focus non piege, role/aria-label sur conteneur, boutons zoom labels). Pas de blocage structurel.
- **Mais** : la carte est purement **indicative** dans roxanetnous. Elle ne porte aucune information unique non couverte par les champs ville/rayon adjacents.
- L'inclure dans le flux clavier ajoute du bruit (5 tab stops par carte, libelles anglais non localises) sans gain fonctionnel pour l'utilisateur clavier ou SR.

## 4. Decision strategique

**Strategie 2 retenue** : `aria-hidden="true"` sur le conteneur Leaflet + texte alternatif visible adjacent.

Justifications :

1. **Indication pure** : la carte n'apporte pas d'information unique. Les champs ville (CityAutocomplete) et rayon (input range/number) constituent l'alternative non-visuelle complete et equivalente.
2. **Pollution evitee** : on retire ~5 tab stops par carte, on simplifie le flux clavier et SR.
3. **Coherence avec l'existant** : la spec axe-core P2 exclut deja `.leaflet-container`, donc la decision aligne le DOM rendu avec la realite testee.
4. **Time-box respectee** : Strategie 2 = 0,15 j d'implementation (vs 0,3 j Strategie 1), ce qui libere du budget pour la Task 7 (resorption `select-name`).
5. **Reversibilite** : si une evolution future (Lot C) ajoute des markers cliquables ou un panel de detail, on basculera Strategie 1 + ajout de panel custom (refonte ergonomique reportee Lot C — AC7 garde-fou).

## 5. Implementation

- `components/ui/map-radius-inner.tsx` :
  - `<MapContainer>` ne supporte pas directement `aria-hidden` via prop. Solution : envelopper dans une `<div aria-hidden="true">` (le contenu Leaflet hereditairement ignore par les SR).
  - Ajout d'un `<p>` adjacent : « Carte indicative de la zone d'intervention. Utilisez les champs ville et rayon ci-dessus pour ajuster. »

- `components/ui/map-radius.tsx` (wrapper) : pas de modification (logique geocoding inchangee).

- 5 usagers : aucune modification (heritage automatique via le composant). Verifie individuellement Task 4.

## 6. Hors scope (reporte Lot C)

- Refonte ergonomique avec markers cliquables, panel de description dynamique des coordonnees, controles clavier custom : reporte **Lot C** explicitement (AC7).
- Localisation des libelles Leaflet (« Map », « Zoom in/out ») : non pertinent puisque le conteneur est `aria-hidden` ; reporte Lot C uniquement si bascule future en Strategie 1.
- Page `/accessibilite` publique listant les decisions Leaflet : Lot C.

## 7. Verification post-livraison attendue

- `npm run a11y:axe:check` : OK (la carte etait deja exclue, devient maintenant nativement ignoree).
- VoiceOver sur `/accompagnante/onboarding` etape localisation : la carte est silencieuse, les champs ville/rayon prennent le relais, le texte alternatif est lu.
- Test clavier : Tab traverse les champs ville et rayon sans entrer dans la carte ni atterrir sur des boutons zoom anglais.

---

**Signature** : audit conduit en mode statique (inspection code source react-leaflet 5 + comportement documente Leaflet 1.9). Audit dynamique recommande au moment du test VoiceOver manuel par le User pour confirmer les hypotheses.
