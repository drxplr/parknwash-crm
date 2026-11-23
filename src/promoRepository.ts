import type { SupabaseClient } from '@supabase/supabase-js'

export type PromoInput = {
  code: string
  discount_percent: number
  packages: string[]
  regions: string[]
  first_wash_only: boolean
  enabled: boolean
  starts_at: string | null
  ends_at: string | null
}
export type Promo = PromoInput & { id: string; revision: number; updated_at: string }
export type PromoApi = {
  list: () => Promise<Promo[]>
  save: (draft: PromoInput, previous?: Promo) => Promise<Promo>
}
const fields =
  'id,code,discount_percent,packages,regions,first_wash_only,enabled,starts_at,ends_at,revision,updated_at'
export function createPromoApi(client: SupabaseClient, workspaceId: string): PromoApi {
  return {
    async list() {
      const result = await client
        .from('crm_promo_codes')
        .select(fields)
        .eq('workspace_id', workspaceId)
        .order('code')
      if (result.error)
        throw new Error('Could not load promo codes. Check your access and try again.')
      return result.data as Promo[]
    },
    async save(draft, previous) {
      const values: PromoInput = {
        code: draft.code.trim().toLowerCase(),
        discount_percent: draft.discount_percent,
        packages: draft.packages,
        regions: draft.regions,
        first_wash_only: draft.first_wash_only,
        enabled: draft.enabled,
        starts_at: draft.starts_at,
        ends_at: draft.ends_at,
      }
      const result = previous
        ? await client
            .from('crm_promo_codes')
            .update(values)
            .eq('workspace_id', workspaceId)
            .eq('id', previous.id)
            .eq('revision', previous.revision)
            .select(fields)
            .maybeSingle()
        : await client
            .from('crm_promo_codes')
            .insert({ ...values, workspace_id: workspaceId })
            .select(fields)
            .single()
      if (result.error)
        throw new Error(
          result.error.code === '23505'
            ? 'This code already exists.'
            : result.error.code === '42501'
              ? 'You do not have access to manage promo codes.'
              : 'Could not save this code. Check the fields and try again.',
        )
      if (!result.data)
        throw new Error(
          'This code changed in another session or your access was removed. Refresh before saving again.',
        )
      return result.data as Promo
    },
  }
}
