import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            roxanetnous - {new Date().getFullYear()}
          </p>
          <nav className="flex gap-6">
            <Link
              href="/mentions-legales"
              className="text-sm text-gray-500 hover:text-black transition"
            >
              Mentions legales
            </Link>
            <Link
              href="/politique-de-confidentialite"
              className="text-sm text-gray-500 hover:text-black transition"
            >
              Politique de confidentialite
            </Link>
            <Link
              href="/cgu"
              className="text-sm text-gray-500 hover:text-black transition"
            >
              CGU
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
