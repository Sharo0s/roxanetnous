import { expect, type Page } from '@playwright/test'

// Page objects minimaux pour la story 7.C.1 (infra E2E).
// 7.C.2/3/4 ajouteront a la demande : DashboardAccompagnantPage, MessagesPage,
// AdminPage, ParrainagePage, etc.

export class LandingPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/')
  }

  async clickConnexion(): Promise<void> {
    // Le lien "Connexion" est rendu par components/layout/header-auth-link.tsx
    // quand l'utilisateur n'est pas authentifie.
    await this.page.getByRole('link', { name: 'Connexion' }).click()
  }
}

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/login')
  }

  // Le formulaire est un wizard 2 etapes (cf. components/auth/login-form.tsx).
  // fillCredentials remplit email + clique "Continuer", puis remplit password.
  // submit() clique le bouton "Se connecter" et laisse le caller attendre la
  // redirection role-aware (cf. helpers session.loginAs).
  async fillCredentials(email: string, password: string): Promise<void> {
    await this.page.fill('input[name="email"]', email)
    await this.page.click('button[type="submit"]')
    await this.page.waitForSelector('input[name="password"]', { timeout: 10_000 })
    await this.page.fill('input[name="password"]', password)
  }

  async submit(): Promise<void> {
    await this.page.click('button[type="submit"]')
  }

  async expectRedirectTo(pathPattern: RegExp | string): Promise<void> {
    await expect(this.page).toHaveURL(pathPattern, { timeout: 15_000 })
  }
}
