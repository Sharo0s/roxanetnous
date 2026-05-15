import Image from 'next/image'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-[#e8dfd2] bg-[#faf7f2]">
      <div className="max-w-6xl mx-auto px-8 py-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-[auto_auto_1fr_auto_auto] items-center gap-4">
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
              width={64}
              height={22}
              className="opacity-70 group-hover:opacity-100 transition"
            />
            <span
              className="text-sm text-gray-400 group-hover:text-gray-600 transition"
              style={{ fontFamily: "var(--font-cormorant), serif" }}
            >
              Conçu et géré par Nysia
            </span>
          </a>

          <div aria-hidden="true" className="hidden md:block w-px h-8 bg-[#f4c8a3]" />

          <nav aria-label="Liens légaux" className="flex flex-wrap md:flex-nowrap justify-center gap-x-4 gap-y-2">
            <Link href="/mentions-legales" className="text-sm text-gray-600 hover:text-kraft transition whitespace-nowrap">
              Mentions légales
            </Link>
            <Link href="/politique-de-confidentialite" className="text-sm text-gray-600 hover:text-kraft transition whitespace-nowrap">
              Politique de confidentialité
            </Link>
            <Link href="/accessibilite" className="text-sm text-gray-600 hover:text-kraft transition whitespace-nowrap">
              Accessibilité
            </Link>
            <Link href="/cgu" className="text-sm text-gray-600 hover:text-kraft transition whitespace-nowrap">
              CGU
            </Link>
          </nav>

          <div aria-hidden="true" className="hidden md:block w-px h-8 bg-[#f4c8a3]" />

          <p className="text-sm text-gray-500 text-center md:text-right">
            roxanetnous · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  )
}
