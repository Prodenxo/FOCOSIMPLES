export function AppFooter() {
  return (
    <footer className="mt-8 flex flex-col gap-2 border-t border-[var(--card-border)] py-6 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
      <p>© {new Date().getFullYear()} Foco Simples. Todos os direitos reservados.</p>
      <p>Simples hoje. Mais possibilidades amanhã.</p>
    </footer>
  );
}
