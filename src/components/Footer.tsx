export default function Footer() {
  return (
    <footer className="border-t border-border/40 bg-surface">
      <div className="container mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
        <p className="text-sm text-text-secondary">
          &copy; {new Date().getFullYear()} Bolt Pizza. Todos los derechos reservados.
        </p>
        <p className="text-sm text-text-secondary">
          Creado con ❤️ por <a href="https://stackblitz.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Bolt</a>
        </p>
      </div>
    </footer>
  );
}
