# 🚀 Prochaines Étapes - roxanetnous

## ✅ Ce qui est déjà fait

- [x] Projet Next.js 15 initialisé avec TypeScript et TailwindCSS
- [x] Configuration Supabase (clients browser/server/middleware)
- [x] Schéma de base de données complet (18 tables + ENUMs)
- [x] RLS Policies (40+ policies de sécurité)
- [x] Composants UI de base (Button, Input, Badge, Card)
- [x] Middleware de protection des routes
- [x] README et documentation complète
- [x] Script de test Supabase

---

## 📋 À Faire MAINTENANT (Configuration Supabase)

### 1. Configurer ton projet Supabase (10 min)

**Suis le guide :** `SETUP_SUPABASE.md`

**Checklist :**
- [ ] Créer projet sur supabase.com
- [ ] Copier les credentials dans `.env.local`
- [ ] Exécuter `supabase/migrations/00_complete_setup.sql`
- [ ] Créer les buckets Storage (justificatifs, contrats)
- [ ] Tester avec `npm run test:supabase`

**Résultat attendu :** Le script de test affiche "✅ Tout fonctionne parfaitement !"

---

## 🎯 Prochaines Étapes de Développement

### Phase 1 : Authentification (2-3h)

**Objectif :** Permettre aux users de s'inscrire et se connecter

**À implémenter :**
1. Page `/login` (connexion)
2. Page `/register` (choix rôle: accompagnante ou bénéficiaire)
3. Page `/register/accompagnante` (inscription accompagnante simple)
4. Page `/register/accompagne` (inscription bénéficiaire simple)
5. Server actions pour auth (signup, login, logout)

**Fichiers à créer :**
```
app/(auth)/
  ├── login/page.tsx
  ├── register/page.tsx
  ├── register/accompagnante/page.tsx
  └── register/accompagne/page.tsx

app/actions/
  └── auth.ts
```

---

### Phase 2 : Inscription Accompagnante Multi-étapes (4-5h)

**Objectif :** Formulaire complet d'inscription accompagnante avec upload de justificatifs

**À implémenter :**
1. Formulaire multi-étapes (6 étapes)
   - Étape 1: Informations de base
   - Étape 2: Diplôme + Expérience
   - Étape 3: Spécialités (sélection multiple)
   - Étape 4: Tarification + Badges PCH/APA
   - Étape 5: Localisation + Rayon
   - Étape 6: Upload justificatifs (identité + diplôme)

**Fichiers à créer :**
```
app/accompagnante/
  └── onboarding/page.tsx

components/accompagnante/
  ├── OnboardingStep1.tsx
  ├── OnboardingStep2.tsx
  ├── OnboardingStep3.tsx
  ├── OnboardingStep4.tsx
  ├── OnboardingStep5.tsx
  └── OnboardingStep6.tsx

app/actions/
  └── accompagnante.ts
```

---

### Phase 3 : Dashboard Admin (3-4h)

**Objectif :** Interface pour valider les accompagnantes

**À implémenter :**
1. Liste des accompagnantes en attente
2. Page de détail accompagnante avec justificatifs
3. Actions : Valider / Refuser / Demander complément
4. Envoi d'emails selon décision

**Fichiers à créer :**
```
app/admin/
  ├── validation/page.tsx
  └── validation/[id]/page.tsx

components/admin/
  ├── AccompagnantesList.tsx
  ├── AccompagnanteDetail.tsx
  └── ValidationActions.tsx

app/actions/
  └── admin.ts
```

---

### Phase 4 : Intégration Stripe (2-3h)

**Objectif :** Gérer les abonnements

**À implémenter :**
1. Configuration Stripe (products + prices)
2. Page de checkout (choix mensuel/annuel)
3. Webhook Stripe pour synchronisation
4. Customer Portal pour gestion abonnement

**Fichiers à créer :**
```
app/api/
  ├── webhooks/stripe/route.ts
  └── checkout/route.ts

app/subscribe/page.tsx

lib/stripe/
  ├── client.ts
  └── server.ts
```

---

### Phase 5 : Marketplace & Recherche (4-5h)

**Objectif :** Permettre la recherche et création d'annonces

**À implémenter :**
1. Page de recherche accompagnantes (pour bénéficiaires)
2. Formulaire création annonce accompagnante
3. Formulaire création annonce bénéficiaire
4. Page détail annonce avec badge système
5. Système de favoris

**Fichiers à créer :**
```
app/accompagne/
  ├── recherche/page.tsx
  ├── annonces/page.tsx
  └── annonces/nouvelle/page.tsx

app/accompagnante/
  ├── annonces/page.tsx
  └── annonces/nouvelle/page.tsx

components/
  ├── AnnonceCard.tsx
  ├── AccompagnanteCard.tsx
  └── SearchFilters.tsx
```

---

### Phase 6 : Matching Intelligent & Notifications (3-4h)

**Objectif :** Algorithme de matching + emails

**À implémenter :**
1. Moteur de matching (6 critères)
2. Templates email React (matching standard, PCH, APA)
3. Configuration Resend
4. Déclenchement notifications sur publication annonce

**Fichiers à créer :**
```
lib/matching/
  └── engine.ts

lib/emails/
  ├── send.ts
  ├── templates/
  │   ├── matching-standard.tsx
  │   ├── matching-pch.tsx
  │   └── matching-apa.tsx

app/api/cron/
  └── update-badges/route.ts
```

---

### Phase 7 : Messagerie Real-time (3-4h)

**Objectif :** Chat entre accompagnantes et bénéficiaires

**À implémenter :**
1. Liste des conversations
2. Interface de chat avec Supabase Realtime
3. Notifications nouveaux messages

**Fichiers à créer :**
```
app/messages/page.tsx
app/messages/[id]/page.tsx

components/messages/
  ├── ConversationsList.tsx
  ├── ChatWindow.tsx
  └── MessageInput.tsx
```

---

### Phase 8 : Features Avancées (5-6h)

**Objectif :** Compléter les fonctionnalités

**À implémenter :**
1. Génération PDF contrats
2. Jobs CRON (badges, digest hebdomadaire)
3. Dashboard stats

---

## ⚡ Quick Start (Ordre Recommandé)

### Aujourd'hui (2-3h)
1. ✅ Configurer Supabase (`SETUP_SUPABASE.md`)
2. ✅ Tester la connexion (`npm run test:supabase`)
3. 🚀 Créer les pages d'authentification (login, register)

### Demain (4-5h)
1. 🚀 Formulaire inscription accompagnante multi-étapes
2. 🚀 Upload de justificatifs

### Après-demain (3-4h)
1. 🚀 Dashboard admin validation
2. 🚀 Emails de notification validation

---

## 💡 Conseils

### Développement Incrémental
- ✅ Teste chaque feature avant de passer à la suivante
- ✅ Commit régulièrement sur Git
- ✅ Utilise le script `npm run test:supabase` pour vérifier la connexion

### Priorités
1. **Authentification** = Bloquant pour tout le reste
2. **Inscription accompagnante** = Permet de tester le flow complet
3. **Dashboard admin** = Permet de valider les accompagnantes
4. **Stripe** = Permet de monétiser
5. **Reste** = Selon tes priorités

### Debug
- Console navigateur (F12)
- Logs Supabase (Dashboard > Logs)
- Logs Vercel (en production)

---

## 🔐 Variables d'environnement requises en production

Ces variables doivent être configurées sur Vercel avant le go-live Bretagne. Le script `npm run check:env` (lancé au build via `vercel.json`) vérifie leur présence, leur forme (shape regex / longueur min) et rejette les valeurs placeholder (`your_*`, `XXX*`, `changeme*`).

**Total : 14 REQUIRED + 5 OPTIONAL_ON_PREVIEW = 19 vars vérifiées.**

**Comportement par environnement** (story 4.8 + 7.A.2) :
- **Production** (`VERCEL_ENV=production`) : la build casse (exit 1) si une variable REQUIRED ou OPTIONAL_ON_PREVIEW est absente, mal formée, ou contient un placeholder.
- **Preview** (`VERCEL_ENV=preview`) : la build casse (exit 1) si une variable `requiredOnPreview` (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) est absente OU si une var présente échoue au shape / placeholder check. Les autres REQUIRED et OPTIONAL_ON_PREVIEW sont tolérées absentes silencieusement.
- **Dev local** (sans `VERCEL_ENV`) : silencieux, aucun check shape ni placeholder (préserve l'expérience locale avec `.env.local` incomplets).

### REQUIRED (14 vars — obligatoires en production)

Dont 2 également obligatoires en preview (`requiredOnPreview: true`, marquées ⚠ ci-dessous).

- `ADMIN_NOTIFICATIONS_EMAIL` — destinataire des alertes anti-fraude parrainage.
- `RESEND_API_KEY` — API Resend pour tous les emails transactionnels (shape `re_*`).
- `RESEND_FROM_EMAIL` — adresse expéditeur Resend production (sans : fallback sandbox `onboarding@resend.dev` -> bounces massifs). **Promu 7.A.2.**
- `NEXT_PUBLIC_BASE_URL` — URL canonique de production (https://roxanetnous.fr).
- ⚠ `NEXT_PUBLIC_SUPABASE_URL` — URL projet Supabase (assertion `!` runtime -> crash si absente). **Promu 7.A.2, requiredOnPreview.**
- ⚠ `NEXT_PUBLIC_SUPABASE_ANON_KEY` — clé anon Supabase (assertion `!` runtime). **Promu 7.A.2, requiredOnPreview.**
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — paywall et webhook subscriptions (shape `sk_*` / `whsec_*`).
- `SUPABASE_SERVICE_ROLE_KEY` — server actions admin.
- `CRON_SECRET` — auth des routes `/api/cron/*` (>=32 chars).
- `PARRAINAGE_INTERNAL_SECRET` — auth du helper de révocation validation filleule (story 2.3, >=32 chars).
- `ENCRYPTION_KEY` — chiffrement justificatifs accompagnants (64 hex chars).
- `OPTOUT_TOKEN_SECRET` — HMAC liens opt-out emails de rappel (>=32 chars).
- `SENTRY_AUTH_TOKEN` — token upload sourcemaps Sentry build-time (sans : stack traces minifiées silencieusement en prod). **Promu 7.A.2.**

### OPTIONAL_ON_PREVIEW (5 vars — obligatoires production uniquement)

- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` — alerting Sentry transverse (story 4.1). Tolérées absentes en preview pour éviter la création d'un projet Sentry preview-only.
- `RATE_LIMIT_HASH_SALT` — sel HMAC pour irréversibilité hash IP rate-limit (story 4.1 patch review, >=32 chars). Toléré absent en preview (dégradation gracieuse SHA-256 non-salé, acceptable pour debug local).

> **Promotion 7.A.2 :** `RESEND_FROM_EMAIL` + `SENTRY_AUTH_TOKEN` + `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` désormais bloquantes en prod (étaient passées silencieusement avant 7.A.2). Pré-flight obligatoire avant chaque deploy : `vercel env ls --environment production` puis `npm run env:push` (dry-run).

Voir aussi `TODO-LAUNCH.md` (checklist détaillée pré-go-live) et `.env.local.example` (template).

---

## 📞 Besoin d'Aide ?

Si tu es bloqué sur une étape, demande-moi et je t'aiderai à :
- Implémenter une feature spécifique
- Debugger une erreur
- Optimiser le code
- Déployer en production

---

**Bon développement ! 🚀**
