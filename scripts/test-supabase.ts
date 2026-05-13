/**
 * Script de test de connexion Supabase
 *
 * Usage:
 *   npx tsx scripts/test-supabase.ts
 *
 * Ce script vérifie que :
 * - La connexion à Supabase fonctionne
 * - Les credentials sont valides
 * - Les tables sont bien créées
 */

import { createClient } from '@supabase/supabase-js'

// Charger les variables d'environnement
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🔍 Test de connexion Supabase pour roxanetnous\n')

// Vérifier que les variables d'environnement sont définies
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Erreur: Variables d\'environnement manquantes')
  console.error('   Vérifie que .env.local contient :')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - NEXT_PUBLIC_SUPABASE_ANON_KEY\n')
  process.exit(1)
}

console.log('✅ Variables d\'environnement trouvées')
console.log(`   URL: ${SUPABASE_URL}`)
console.log(`   Anon Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...\n`)

// Créer le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testConnection() {
  console.log('🔌 Test de connexion...')

  try {
    // Test 1: Vérifier la connexion en listant les tables
    console.log('\n📋 Test 1: Vérification des tables')

    const tables = [
      'users',
      'accompagnants_profiles',
      'accompagnes_profiles',
      'subscriptions',
      'annonces_accompagnants',
      'annonces_accompagnes',
      'favoris',
      'conversations',
      'messages',
      'contrats',
      'signalements',
      'notifications_log',
      'badges_cache',
      'admin_actions_log',
    ]

    let successCount = 0

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .limit(1)

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = table vide (c'est OK)
        console.log(`   ❌ ${table}: ${error.message}`)
      } else {
        console.log(`   ✅ ${table}`)
        successCount++
      }
    }

    console.log(`\n   ${successCount}/${tables.length} tables accessibles`)

    if (successCount === tables.length) {
      console.log('\n✅ Toutes les tables sont créées et accessibles !')
    } else {
      console.log('\n⚠️  Certaines tables ne sont pas accessibles.')
      console.log('   As-tu bien exécuté la migration SQL ?')
      console.log('   Fichier: supabase/migrations/00_complete_setup.sql')
    }

    // Test 2: Vérifier l'authentification
    console.log('\n📋 Test 2: Vérification de l\'authentification')

    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError) {
      console.log(`   ⚠️  Erreur auth: ${authError.message}`)
    } else {
      console.log('   ✅ Module d\'authentification opérationnel')
      console.log(`   Session active: ${session ? 'Oui' : 'Non (normal si pas connecté)'}`)
    }

    // Test 3: Vérifier le Storage
    console.log('\n📋 Test 3: Vérification du Storage')

    const { data: buckets, error: storageError } = await supabase
      .storage
      .listBuckets()

    if (storageError) {
      console.log(`   ⚠️  Erreur storage: ${storageError.message}`)
    } else {
      console.log('   ✅ Module Storage opérationnel')
      console.log(`   Buckets trouvés: ${buckets.length}`)

      const expectedBuckets = ['justificatifs', 'contrats']
      for (const bucketName of expectedBuckets) {
        const found = buckets.some(b => b.name === bucketName)
        if (found) {
          console.log(`   ✅ Bucket "${bucketName}" trouvé`)
        } else {
          console.log(`   ❌ Bucket "${bucketName}" manquant`)
        }
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('🎉 Test de connexion terminé !')
    console.log('='.repeat(60))

    if (successCount === tables.length) {
      console.log('\n✅ Tout fonctionne parfaitement !')
      console.log('   Tu peux commencer à développer 🚀')
    } else {
      console.log('\n⚠️  Il reste des choses à configurer.')
      console.log('   Consulte le fichier SETUP_SUPABASE.md pour plus d\'infos.')
    }

  } catch (error) {
    console.error('\n❌ Erreur lors du test de connexion:')
    console.error(error)
    process.exit(1)
  }
}

testConnection()
