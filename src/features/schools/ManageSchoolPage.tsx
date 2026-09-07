import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { PageDescription } from '@/components/ui/PageDescription'
import { Autocomplete, type AutocompleteOption } from '@/components/ui/Autocomplete'
import { SchoolSuggestion } from '@/components/ui/SchoolSuggestion'
import { CirculationPoliciesPage } from '@/features/circulation/CirculationPoliciesPage'
import { LibraryCalendarPage } from './LibraryCalendarPage'

type School = { id: number; name: string }
type Paginated<T> = { items: T[] }
type Section = 'rules' | 'calendar'

export function ManageSchoolPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const initialSection: Section = params.get('tab') === 'calendar' ? 'calendar' : 'rules'
  const [section, setSection] = useState<Section>(initialSection)
  const isSuperAdmin = user?.role === 'super_admin'
  const schoolId = isSuperAdmin ? params.get('school') ?? '' : String(user?.school_id ?? '')
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
  return <div className="flex flex-col gap-6">
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
    <div role="tablist" aria-label="Seções de gerenciamento" className="grid max-w-xl grid-cols-2 rounded-lg border border-slate-300 bg-slate-100 p-1 dark:border-slate-600 dark:bg-slate-800">
      <button type="button" role="tab" aria-selected={section === 'rules'} onClick={() => selectSection('rules')} className={`rounded-md px-3 py-2 font-medium focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] ${section === 'rules' ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-200'}`}>Regras de circulação</button>
      <button type="button" role="tab" aria-selected={section === 'calendar'} onClick={() => selectSection('calendar')} className={`rounded-md px-3 py-2 font-medium focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] ${section === 'calendar' ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-200'}`}>Calendário da biblioteca</button>
    </div>
    {section === 'rules' ? <CirculationPoliciesPage schoolIdOverride={schoolId} showSchoolSelector={false} /> : <LibraryCalendarPage schoolIdOverride={schoolId} showSchoolSelector={false} />}
  </div>
}
