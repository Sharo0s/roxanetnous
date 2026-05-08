// Story 4.3 : helpers HTML purs reutilisables par le step `sendEmailViaResend`
// (lib/workflows/send-email-workflow.ts) et par les fonctions synchrones
// `sendWaitlist*Email` de lib/emails.ts (chemin fallback AC8).
//
// Pas d'I/O ni d'effet de bord ici — uniquement de la composition de strings
// HTML. Cela evite les contraintes du sandbox workflow function et facilite
// les tests unitaires futurs (story 4.4).

import { escapeHtml } from '@/lib/escape-html'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

export function renderWaitlistConfirmationHtml(params: {
  codeDepartement: string
  nomDepartement: string
}): string {
  return `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Merci pour votre inscription</h1>
          <p>Bonjour,</p>
          <p>Nous avons bien enregistré votre demande pour le département <strong>${escapeHtml(params.nomDepartement)}</strong> (${escapeHtml(params.codeDepartement)}).</p>
          <p>Nous vous enverrons un email automatique dès l'ouverture du service dans votre département.</p>
          <p style="margin-top: 24px;">
            <a href="${BASE_URL}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Retour sur roxanetnous
            </a>
          </p>
        </div>
      `
}

export function renderWaitlistOpeningHtml(params: {
  codeDepartement: string
  nomDepartement: string
}): string {
  // BASE_URL peut avoir un trailing slash en preview Vercel : on neutralise.
  // Code review patch #12 (story 3.5).
  const baseClean = (BASE_URL || '').replace(/\/+$/, '')
  // Code review 2026-05-08 P5 : pas de escapeHtml sur ctaUrl dans le href
  // (encodeURIComponent sur le param suffit ; & dans une URL est valide en
  // HTML). escapeHtml reste sur le label visible.
  const ctaUrl = `${baseClean}/recherche?code_departement=${encodeURIComponent(params.codeDepartement)}`
  return `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">Bonne nouvelle</h1>
          <p>Bonjour,</p>
          <p>Le service roxanetnous est désormais ouvert dans le département <strong>${escapeHtml(params.nomDepartement)}</strong> (${escapeHtml(params.codeDepartement)}).</p>
          <p>Vous pouvez dès maintenant explorer les profils disponibles dans votre zone.</p>
          <p style="margin-top: 24px;">
            <a href="${ctaUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; display: inline-block;">
              Découvrir roxanetnous dans ${escapeHtml(params.nomDepartement)}
            </a>
          </p>
        </div>
      `
}

export function buildWaitlistConfirmationSubject(nomDepartement: string): string {
  return `Vous etes sur la waitlist pour ${nomDepartement}`
}

export function buildWaitlistOpeningSubject(nomDepartement: string): string {
  return `Le service est ouvert dans ${nomDepartement}`
}

// Validation defensive : nomDepartement vide / trop long / contenant CRLF
// ferait planter le subject Resend ou ouvrirait une header injection.
// Code review patch #13/#14 (story 3.5).
export function isValidNomDepartement(nom: string | undefined | null): boolean {
  const trimmed = (nom || '').trim()
  return Boolean(trimmed) && trimmed.length <= 80 && !/[\r\n]/.test(trimmed)
}
