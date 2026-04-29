# roxanetnous
  Si vous voulez retrouver l'etat actuel carte france, il suffira de faire :             
  git show 1d7f077:components/landing/hero-carte.tsx

Plateforme de mise en relation entre accompagnantes de vie vérifiés et bénéficiaires.

## 🚀 Stack Technique

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, TailwindCSS
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime, RLS)
- **Paiements:** Stripe (Checkout, Customer Portal, Webhooks)
- **Déploiement:** Vercel
- **Email:** Resend + React Email

## 📦 Installation

### 1. Cloner le projet

```bash
git clone <your-repo>
cd roxanetnous
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Copier les credentials (URL et Keys)
3. Exécuter les migrations SQL :
   - `supabase/migrations/20260210_init_schema.sql`
   - `supabase/migrations/20260210_rls_policies.sql`
4. Créer les buckets Storage :
   - `justificatifs` (privé)
   - `contrats` (privé)

### 4. Variables d'environnement

Copier `.env.local.example` vers `.env.local` et remplir les valeurs :

```bash
cp .env.local.example .env.local
```

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Email
RESEND_API_KEY=re_...

# Cron
CRON_SECRET=your_random_secret

# Encryption
ENCRYPTION_KEY=your_32_byte_hex_key
```

### 5. Lancer le serveur de développement

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## 📚 Architecture

### Structure du projet

```
roxanetnous/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Routes d'authentification
│   ├── (public)/                 # Routes publiques
│   ├── accompagnante/               # Dashboard accompagnante
│   ├── accompagne/             # Dashboard bénéficiaire
│   ├── admin/                    # Dashboard admin
│   ├── api/                      # API Routes
│   │   ├── webhooks/stripe/      # Webhooks Stripe
│   │   ├── cron/                 # Jobs CRON
│   │   └── admin/                # Actions admin
│   ├── actions/                  # Server Actions
│   ├── layout.tsx                # Layout principal
│   └── page.tsx                  # Page d'accueil
│
├── components/                   # Composants React
│   └── ui/                       # Composants UI réutilisables
│
├── lib/                          # Librairies et utilitaires
│   ├── supabase/                 # Clients Supabase
│   │   ├── client.ts             # Client browser
│   │   ├── server.ts             # Client server
│   │   └── middleware.ts         # Middleware auth
│   ├── matching/                 # Algorithme de matching
│   ├── emails/                   # Templates email
│   ├── pdf/                      # Génération PDF
│   └── crypto/                   # Chiffrement
│
├── supabase/                     # Configuration Supabase
│   └── migrations/               # Migrations SQL
│       ├── 20260210_init_schema.sql
│       └── 20260210_rls_policies.sql
│
├── middleware.ts                 # Middleware Next.js
├── next.config.js                # Configuration Next.js
├── tailwind.config.js            # Configuration Tailwind
└── tsconfig.json                 # Configuration TypeScript
```

### Base de données

- `users` - Utilisateurs (extends auth.users)
- `accompagnantes_profiles` - Profils accompagnantes
- `accompagnes_profiles` - Profils bénéficiaires
- `subscriptions` - Abonnements Stripe
- `annonces_accompagnantes` - Annonces accompagnantes
- `annonces_accompagnes` - Annonces bénéficiaires
- `favoris` - Favoris (polymorphique)
- `conversations` - Conversations
- `messages` - Messages
- `signalements` - Signalements
- `notifications_log` - Log notifications email
- `badges_cache` - Cache badges
- `admin_actions_log` - Log actions admin
- `parrainages_codes` - Codes de parrainage uniques (1 par accompagnante validée)
- `parrainages` - Historique des relations marraine/filleule + audit anti-fraude

### Fonctionnalités principales

✅ **Inscription & Validation**
- Formulaire multi-étapes accompagnantes
- Upload justificatifs (identité + diplôme)
- Validation manuelle admin (objectif 48h)

✅ **Abonnements Stripe**
- Mensuel : 4,99€/mois
- Annuel : 49,99€/an
- Hard paywall (RLS)

✅ **Marketplace Bidirectionnelle**
- Annonces accompagnantes + bénéficiaires
- Recherche et filtres avancés
- Système de favoris

✅ **Matching Intelligent (6 critères)**
1. Spécialités (≥1 commune)
2. Zone géographique (rayon km)
3. Disponibilités horaires (jour×créneau)
4. Diplôme (si spécifié)
5. Expérience (si spécifiée)
6. Budget/Tarif avec badges PCH/APA

✅ **Système de Badges**
- 📢 Annonce active (priorisation recherche)
- 🥉🥈🥇 Ancienneté (1/3/5 ans)
- 💚 Tarif modulable PCH
- 💙 Tarif modulable APA

✅ **Notifications Email**
- Matching (standard, PCH, APA)
- Validation (acceptée, refusée, à compléter)
- Nouveau message
- Résumé hebdomadaire
- Alerte expiration abonnement

✅ **Messagerie Real-time**
- Chat WebSocket (Supabase Realtime)
- Conversations privées

✅ **Génération Contrats PDF**
- PDF automatique (jsPDF)
- Stockage sécurisé

✅ **Jobs CRON**
- Mise à jour badges (quotidien 2h)
- Résumé hebdomadaire (lundi 9h)
- Alerte expiration (quotidien 10h)
- Nettoyage logs (dimanche 3h)

✅ **Sécurité & RGPD**
- RLS complet
- Chiffrement AES-256
- Rate limiting
- Audit logging
- Droit à l'oubli
- Export données personnelles

## 🔐 Sécurité

- **Row Level Security (RLS)** sur toutes les tables
- **Chiffrement AES-256-GCM** pour données sensibles
- **Rate Limiting** via Upstash Redis
- **Audit Logging** des actions admin
- **HTTPS Only** en production
- **Webhook Signature Verification** (Stripe)
- **Input Validation** avec Zod

## 📄 Documentation

- [Architecture Technique](/_bmad-output/planning-artifacts/architecture-technique-roxanetnous-2026-02-09.md)
- [Product Brief](/_bmad-output/planning-artifacts/product-brief-roxanetnous-2026-02-09.md)

## 🚀 Déploiement Vercel

### 1. Push vers GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Déployer sur Vercel

1. Importer le projet depuis GitHub
2. Ajouter les variables d'environnement
3. Déployer

### 3. Configurer les CRON jobs

Créer `vercel.json` :

```json
{
  "crons": [
    {
      "path": "/api/cron/update-badges",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/send-weekly-digest",
      "schedule": "0 9 * * 1"
    },
    {
      "path": "/api/cron/check-expiring-subscriptions",
      "schedule": "0 10 * * *"
    },
    {
      "path": "/api/cron/cleanup-old-notifications",
      "schedule": "0 3 * * 0"
    }
  ]
}
```

## 📞 Support

Pour toute question : contact@roxanetnous.fr

## 📝 Licence

Propriétaire - Tous droits réservés
