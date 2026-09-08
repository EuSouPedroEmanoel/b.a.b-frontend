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
import { segmentedControlContainerClasses, segmentedControlIndicatorClasses, segmentedControlItemClasses } from '@/components/ui/SegmentedControl'

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
    <div role="tablist" aria-label="Seções de gerenciamento" className={`${segmentedControlContainerClasses} max-w-xl grid grid-cols-2`}>
      <span aria-hidden="true" className={segmentedControlIndicatorClasses('primary', section === 'calendar' ? 1 : 0)} />
      <button type="button" role="tab" aria-selected={section === 'rules'} onClick={() => selectSection('rules')} className={segmentedControlItemClasses(section === 'rules', 'primary')}>Regras de circulação</button>
      <button type="button" role="tab" aria-selected={section === 'calendar'} onClick={() => selectSection('calendar')} className={segmentedControlItemClasses(section === 'calendar', 'primary')}>Calendário da biblioteca</button>
    </div>
    {section === 'rules' ? <CirculationPoliciesPage schoolIdOverride={schoolId} showSchoolSelector={false} /> : <LibraryCalendarPage schoolIdOverride={schoolId} showSchoolSelector={false} />}
  </div>
}
