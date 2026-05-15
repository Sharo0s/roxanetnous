import Image from 'next/image'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-[#e8dfd2] bg-[#faf7f2]">
      <div className="max-w-4xl mx-auto px-4 py-8 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <nav aria-label="Liens légaux" className="flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-2">
            <Link
              href="/mentions-legales"
              className="text-sm text-gray-600 hover:text-kraft transition"
            >
              Mentions légales
            </Link>
            <Link
              href="/politique-de-confidentialite"
              className="text-sm text-gray-600 hover:text-kraft transition"
            >
              Politique de confidentialité
            </Link>
            <Link
              href="/accessibilite"
              className="text-sm text-gray-600 hover:text-kraft transition"
            >
              Accessibilité
            </Link>
            <Link
              href="/cgu"
              className="text-sm text-gray-600 hover:text-kraft transition"
            >
              CGU
            </Link>
          </nav>

          <div className="flex flex-col items-center gap-3">
            <a
              href="https://nysia.fr"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Nysia — Conçu et géré par Nysia"
              className="flex flex-col items-center gap-1.5 group"
            >
              <Image
                src="/nysia-footer-dark.svg"
                alt="Nysia"
                width={80}
                height={28}
                className="opacity-70 group-hover:opacity-100 transition"
              />
              <span
                className="text-xs text-gray-400 group-hover:text-gray-600 transition"
                style={{ fontFamily: "var(--font-cormorant), serif" }}
              >
                Conçu et géré par Nysia
              </span>
            </a>
          </div>

          <p className="text-sm text-gray-500">
            roxanetnous · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  )
}
