// Story 4.9 : module unique pour l'echappement HTML des templates email.
// Avant 4.9 : duplication dans lib/emails.ts:14 et lib/email-templates.ts:11.
// Couvert par tests/unit/escape-html.test.ts (vecteurs XSS classiques).
//
// La fonction n'est PAS idempotente (escape '&' systematiquement, meme deja-encode).
// La fonction n'echappe PAS le single quote (attributs HTML toujours en double quote).

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
