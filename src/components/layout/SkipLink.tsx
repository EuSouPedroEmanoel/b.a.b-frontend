export function SkipLink() {
  return (
    <a
      id="skip-link"
      href="#main-content"
      className="skip-link"
      onClick={() => document.getElementById('main-content')?.focus()}
    >
      Pular para o conteúdo principal
    </a>
  )
}
