import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-[#e8dfd2] bg-[#faf7f2]">
      <div className="max-w-4xl mx-auto px-4 py-8 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            roxanetnous · {new Date().getFullYear()}
          </p>
          <nav aria-label="Liens légaux" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
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
        </div>
      </div>
    </footer>
  )
}
