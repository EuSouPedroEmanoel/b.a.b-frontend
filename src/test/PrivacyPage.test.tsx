import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PrivacyPage } from '@/features/privacy/PrivacyPage'

describe('PrivacyPage', () => {
  it('presents the public privacy notice with its version and update date', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Aviso de Privacidade' })).toBeInTheDocument()
    expect(screen.getByText('Versão 1.0.0 · Última atualização: 18 de outubro de 2026')).toBeInTheDocument()
    expect(screen.getByText(/Buscamos limitar o uso de informações ao necessário/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Serviços externos' })).toBeInTheDocument()
    expect(screen.getByText('Para dúvidas gerais sobre o funcionamento da biblioteca, procure a equipe responsável em sua escola.')).toBeInTheDocument()
    expect(screen.getByText('A escola responsável define como o vínculo com responsáveis legais será verificado e como eles participarão do exercício dos direitos do titular.')).toBeInTheDocument()
    expect(screen.getByText('O sistema não cadastra responsáveis legais nem substitui os procedimentos institucionais da escola. Solicitações relacionadas a titulares menores podem depender de validação pela escola.')).toBeInTheDocument()
    expect(screen.queryByText(/publicadas nesta página assim que estiverem oficialmente disponíveis/)).not.toBeInTheDocument()
    expect(screen.getByRole('article')).toHaveClass('min-w-0')
    const dataGrid = screen.getByRole('heading', { name: 'Quais dados utilizamos' }).nextElementSibling
    expect(dataGrid).toHaveClass('privacy-data-grid', 'flex', 'flex-row')
    expect(dataGrid?.firstElementChild).toHaveClass('min-w-0')
    expect(screen.getAllByText(/Este aviso explica|Nome, usuário|Também mantemos registros/)[0].closest('div')).toHaveClass('leading-[inherit]')
  })
})
