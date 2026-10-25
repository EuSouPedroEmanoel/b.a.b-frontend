import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { PageDescription } from '@/components/ui/PageDescription'
import { Button } from '@/components/ui/Button'
import { Autocomplete, type AutocompleteOption } from '@/components/ui/Autocomplete'
import { SchoolSuggestion } from '@/components/ui/SchoolSuggestion'
import { CirculationPoliciesPage } from '@/features/circulation/CirculationPoliciesPage'
import { LibraryCalendarPage } from './LibraryCalendarPage'
import { segmentedControlContainerClasses, segmentedControlItemClasses } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { Input } from '@/components/ui/Input'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { getErrorMessage } from '@/lib/errors'

type School = { id: number; name: string; allow_student_condition_filter?: boolean; allow_student_restricted_availability?: boolean }
type PrivacyPolicy = { processing_mode: 'automatic_anonymization' | 'administrative_review'; privacy_contact_email: string | null }
type Paginated<T> = { items: T[] }
type Section = 'rules' | 'calendar' | 'settings'

export function ManageSchoolPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const initialSection: Section = params.get('tab') === 'calendar' ? 'calendar' : params.get('tab') === 'settings' ? 'settings' : 'rules'
  const [section, setSection] = useState<Section>(initialSection)
  const [privacyEmail, setPrivacyEmail] = useState('')
  const [privacyJustification, setPrivacyJustification] = useState('')
  const isSuperAdmin = user?.role === 'super_admin'
  const schoolId = isSuperAdmin ? params.get('school') ?? '' : String(user?.school_id ?? '')
  const queryClient = useQueryClient()
  const announce = useAnnouncer()
  const schools = useQuery({
    queryKey: ['schools', 'manage-school'],
    queryFn: async () => (await api.get<Paginated<School>>('/schools/?size=100')).data.items,
    enabled: isSuperAdmin,
  })
  const schoolOptions: AutocompleteOption<School>[] = (schools.data ?? []).map((school) => ({
    value: String(school.id),
    label: school.name,
    data: school,
  }))
  const schoolSettings = useQuery({
    queryKey: ['school-settings', schoolId],
    queryFn: async () => (await api.get<School>(`/schools/${schoolId}/settings`)).data,
    enabled: !!schoolId && !!user && ['super_admin', 'school_admin', 'librarian'].includes(user.role),
  })
  const updateSchoolSettings = useMutation({
    mutationFn: async (settings: { allow_student_condition_filter: boolean; allow_student_restricted_availability: boolean }) => (await api.patch<School>(`/schools/${schoolId}/settings`, settings)).data,
    onSuccess: (data) => {
      queryClient.setQueryData(['school-settings', schoolId], data)
      queryClient.invalidateQueries({ queryKey: ['schools', 'manage-school'] })
      void announce('Preferências da escola atualizadas.', 'polite')
    },
    onError: (error: unknown) => {
      void announce(getErrorMessage(error, 'Não foi possível atualizar as preferências da escola.'), 'assertive')
    },
  })
  const canManagePrivacy = ['super_admin', 'school_admin'].includes(user?.role ?? '')
  const privacyPolicy = useQuery({
    queryKey: ['privacy-policy', schoolId],
    queryFn: async () => (await api.get<PrivacyPolicy>(`/privacy/schools/${schoolId}/policy`)).data,
    enabled: !!schoolId && canManagePrivacy,
  })
  const updatePrivacyPolicy = useMutation({
    mutationFn: async () => (await api.put<PrivacyPolicy>(`/privacy/schools/${schoolId}/policy`, {
      processing_mode: privacyPolicy.data?.processing_mode ?? 'automatic_anonymization',
      privacy_contact_email: privacyEmail.trim() || null,
      justification: privacyJustification.trim(),
    })).data,
    onSuccess: (data) => {
      queryClient.setQueryData(['privacy-policy', schoolId], data)
      setPrivacyJustification('')
      void announce('Configuração de privacidade atualizada.', 'polite')
    },
    onError: (error: unknown) => void announce(getErrorMessage(error, 'Não foi possível atualizar o canal de privacidade.'), 'assertive'),
  })
  const selectSection = (next: Section) => {
    setSection(next)
    setParams((current) => {
      current.set('tab', next)
      return current
    })
  }
  const selectSchool = (next: string) => setParams((current) => {
    current.set('school', next)
    return current
  })

  if (!user || !['super_admin', 'school_admin', 'librarian'].includes(user.role)) {
    return <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">Você não tem permissão para gerenciar a escola.</p>
  }
  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
    <header><h1 className="text-2xl font-bold sm:text-3xl">Gerenciar escola</h1><PageDescription>Consulte e, quando permitido, altere as configurações da biblioteca.</PageDescription></header>
    {isSuperAdmin && (
      <div className="max-w-xl">
        <Autocomplete
          id="manage-school-search"
          label="Escola"
          value={schoolId}
          options={schoolOptions}
          placeholder="Busque uma escola"
          autoFocus
          onChange={selectSchool}
          renderOption={(option) => <SchoolSuggestion option={option} />}
        />
      </div>
    )}
    <div role="tablist" aria-label="Seções de gerenciamento" className={`${segmentedControlContainerClasses} max-w-xl`}>
      <button type="button" role="tab" aria-selected={section === 'rules'} onClick={() => selectSection('rules')} className={segmentedControlItemClasses(section === 'rules', 'primary')}>Regras de circulação</button>
      <button type="button" role="tab" aria-selected={section === 'calendar'} onClick={() => selectSection('calendar')} className={segmentedControlItemClasses(section === 'calendar', 'primary')}>Calendário da biblioteca</button>
      <button type="button" role="tab" aria-selected={section === 'settings'} onClick={() => selectSection('settings')} className={segmentedControlItemClasses(section === 'settings', 'primary')}>Preferências</button>
    </div>
    {section === 'rules' ? <CirculationPoliciesPage schoolIdOverride={schoolId} showSchoolSelector={false} /> : section === 'calendar' ? <LibraryCalendarPage schoolIdOverride={schoolId} showSchoolSelector={false} /> : (
      <section aria-labelledby="school-preferences-title" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 id="school-preferences-title" className="text-lg font-semibold">Preferências da escola</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Defina quais filtros ficam disponíveis para os alunos no acervo.</p>
        {schoolSettings.isError && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"><span>Não foi possível carregar as preferências da escola.</span><button type="button" className="font-medium underline" onClick={() => void schoolSettings.refetch()}>Tentar novamente</button></div>}
        {!schoolId && isSuperAdmin && <p role="status" className="mt-5 rounded-md border border-slate-200 p-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Selecione uma escola para consultar suas preferências.</p>}
        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
          <Switch
            controlOnRight
            label="Permitir filtro por estado de conservação para alunos"
            description="Quando ativado, alunos poderão filtrar livros por Novo, Bom, Regular, Ruim ou Péssimo."
            checked={schoolSettings.data?.allow_student_condition_filter ?? false}
            disabled={schoolSettings.isLoading || updateSchoolSettings.isPending}
            accessibleLabel="Permitir filtro por estado de conservação para alunos"
            onChange={(checked) => updateSchoolSettings.mutate({ allow_student_condition_filter: checked, allow_student_restricted_availability: schoolSettings.data?.allow_student_restricted_availability ?? false })}
          />
          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
            <Switch
              controlOnRight
              label="Permitir filtros de disponibilidade restrita para alunos"
              description="Quando ativado, alunos poderão consultar livros Perdidos e Arquivados no acervo."
              checked={schoolSettings.data?.allow_student_restricted_availability ?? false}
              disabled={schoolSettings.isLoading || updateSchoolSettings.isPending}
              accessibleLabel="Permitir filtros de disponibilidade restrita para alunos"
              onChange={(checked) => updateSchoolSettings.mutate({ allow_student_condition_filter: schoolSettings.data?.allow_student_condition_filter ?? false, allow_student_restricted_availability: checked })}
            />
          </div>
        </div>
        {canManagePrivacy && <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700"><h3 className="font-semibold">Canal de privacidade</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">O e-mail será exibido aos titulares da escola para dúvidas e solicitações de privacidade.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><Input label="E-mail institucional" type="email" value={privacyEmail || privacyPolicy.data?.privacy_contact_email || ''} onChange={(event) => setPrivacyEmail(event.target.value)} placeholder="privacidade@escola.edu.br" /><Input label="Justificativa da alteração" value={privacyJustification} onChange={(event) => setPrivacyJustification(event.target.value)} required /></div><Button className="mt-4" disabled={!privacyJustification.trim() || privacyPolicy.isLoading || updatePrivacyPolicy.isPending} onClick={() => updatePrivacyPolicy.mutate()}>Salvar canal de privacidade</Button></div>}
      </section>
    )}
  </div>
}
