import { Link } from 'react-router-dom'
import { useLayoutEffect, useRef, useState } from 'react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { PageDescription } from '@/components/ui/PageDescription'

export const PRIVACY_NOTICE_VERSION = '1.0.0'
export const PRIVACY_NOTICE_LAST_UPDATED = '18 de outubro de 2026'

const dataSections = [
  {
    title: 'Dados de cadastro',
    items: 'Nome, usuário, CPF, data de nascimento, turma, escola e perfil de acesso.',
    description: 'Usamos essas informações para criar sua conta, identificar você e oferecer o acesso adequado às funções da biblioteca.',
  },
  {
    title: 'Uso da biblioteca',
    items: 'Empréstimos, devoluções e reservas.',
    description: 'Esses registros ajudam a organizar a circulação dos livros, informar prazos e manter o acervo disponível para a comunidade escolar.',
  },
  {
    title: 'Preferências de leitura',
    items: 'Favoritos, status de leitura e histórico de interação com o acervo.',
    description: 'Podemos usar essas informações para lembrar suas preferências e personalizar recomendações. Elas fazem parte da sua experiência de leitura.',
  },
]

export function PrivacyPage() {
  const dataGridRef = useRef<HTMLDivElement>(null)
  const [stackDataCards, setStackDataCards] = useState(false)

  useLayoutEffect(() => {
    const grid = dataGridRef.current
    if (!grid) return undefined

    const updateLayout = () => {
      if (!grid.clientWidth) return
      const rootStyle = getComputedStyle(document.documentElement)
      const textSize = rootStyle.getPropertyValue('--text-sm').trim()
      const rootFontSize = Number.parseFloat(rootStyle.fontSize) || 16
      const textPixels = textSize.endsWith('rem')
        ? Number.parseFloat(textSize) * rootFontSize
        : Number.parseFloat(textSize) || 14
      const minimumCardWidth = Math.max(18 * rootFontSize, textPixels * 14)
      const requiredRowWidth = minimumCardWidth * 3 + 32
      setStackDataCards(grid.clientWidth < requiredRowWidth)
    }

    updateLayout()
    const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(updateLayout)
    resizeObserver?.observe(grid)
    const fontObserver = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(updateLayout)
    fontObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-font-size'] })
    window.addEventListener('resize', updateLayout)
    return () => {
      resizeObserver?.disconnect()
      fontObserver?.disconnect()
      window.removeEventListener('resize', updateLayout)
    }
  }, [])

  return (
    <article className="mx-auto min-w-0 max-w-6xl space-y-8" aria-labelledby="privacy-title">
      <header>
        <h1 id="privacy-title" className="min-w-0 break-words text-2xl font-bold [text-wrap:balance] sm:text-3xl">Aviso de Privacidade</h1>
        <PageDescription className="max-w-3xl [text-wrap:pretty]">
          Entenda, de forma simples, quais informações usamos e como elas ajudam a biblioteca a funcionar.
        </PageDescription>
        <p className="mt-3 break-words text-sm text-slate-600 dark:text-slate-300">
          Versão {PRIVACY_NOTICE_VERSION} · Última atualização: {PRIVACY_NOTICE_LAST_UPDATED}
        </p>
      </header>

      <Card>
        <CardBody className="min-w-0 space-y-3 break-words text-sm leading-[inherit] [text-wrap:pretty]">
          <p>Este aviso explica como a Base de Acesso Bibliotecário utiliza informações pessoais para oferecer seus serviços de biblioteca, organizar o acervo e proteger as contas dos usuários.</p>
          <p>Buscamos limitar o uso de informações ao necessário para cada finalidade e cuidar delas com segurança e respeito à privacidade.</p>
        </CardBody>
      </Card>

      <section aria-labelledby="data-title">
        <h2 id="data-title" className="mb-3 text-xl font-semibold">Quais dados utilizamos</h2>
        <div ref={dataGridRef} className={`privacy-data-grid flex min-w-0 gap-4 ${stackDataCards ? 'flex-col' : 'flex-row'}`}>
          {dataSections.map((section) => (
            <Card key={section.title} className="min-w-0">
              <CardHeader><h3 className="text-lg font-semibold">{section.title}</h3></CardHeader>
              <CardBody className="min-w-0 space-y-3 break-words text-sm leading-[inherit] [text-wrap:pretty]">
                <p className="font-medium text-slate-800 dark:text-slate-100">{section.items}</p>
                <p>{section.description}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Segurança e administração</h2></CardHeader>
        <CardBody className="min-w-0 space-y-3 break-words text-sm leading-[inherit] [text-wrap:pretty]">
          <p>Também mantemos registros necessários para autenticação, segurança, prevenção de uso indevido e administração da biblioteca. Esses registros ajudam a investigar problemas e proteger usuários e escolas.</p>
          <p>As informações são mantidas somente pelo tempo necessário às finalidades para as quais foram coletadas e às obrigações legais aplicáveis.</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Crianças e adolescentes</h2></CardHeader>
        <CardBody className="min-w-0 space-y-3 break-words text-sm leading-[inherit] [text-wrap:pretty]">
          <p>O sistema pode tratar dados de alunos menores de idade. Esse tratamento deve sempre considerar o melhor interesse e a proteção especial de crianças e adolescentes.</p>
          <p>Quando aplicável, responsáveis legais podem participar do exercício dos direitos do titular e receber informações sobre o uso dos dados.</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Serviços externos</h2></CardHeader>
        <CardBody className="min-w-0 space-y-3 break-words text-sm leading-[inherit] [text-wrap:pretty]">
          <p>Alguns recursos podem utilizar serviços de terceiros para consultar metadados de livros, imagens de capas, calendários ou outras informações necessárias ao funcionamento da biblioteca.</p>
          <p>Esses serviços são usados apenas no contexto das funcionalidades correspondentes.</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Seus direitos</h2></CardHeader>
        <CardBody className="min-w-0 space-y-3 break-words text-sm leading-[inherit] [text-wrap:pretty]">
          <p>Você pode, observadas as condições e exceções previstas em lei:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>saber se seus dados são tratados e solicitar acesso a eles;</li>
            <li>pedir a correção de informações incompletas, incorretas ou desatualizadas;</li>
            <li>obter informações sobre o uso e os compartilhamentos realizados;</li>
            <li>solicitar anonimização, bloqueio ou eliminação quando aplicável;</li>
            <li>solicitar portabilidade, quando esse direito for aplicável; e</li>
            <li>revogar o consentimento quando o tratamento depender dele.</li>
          </ul>
          <p>O canal oficial para solicitações relacionadas aos seus dados será informado nesta página assim que estiver disponível.</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Quem é responsável</h2></CardHeader>
        <CardBody className="space-y-3 text-sm leading-6">
          <p>As informações oficiais sobre quem é responsável pelo tratamento dos dados, quem atende às solicitações e qual canal deve ser utilizado serão publicadas nesta página assim que forem definidas institucionalmente.</p>
          <p>Para dúvidas gerais sobre o funcionamento da biblioteca, procure a equipe responsável em sua escola.</p>
        </CardBody>
      </Card>

      <p className="text-sm text-slate-600 dark:text-slate-300"><Link to="/entrar" className="font-medium underline underline-offset-2">Voltar para o acesso</Link></p>
    </article>
  )
}
