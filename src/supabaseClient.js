import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Chybí VITE_SUPABASE_URL nebo VITE_SUPABASE_ANON_KEY — appka se nemůže připojit k Supabase. ' +
    'Zkontroluj .env (lokálně) nebo Environment Variables (na Vercelu).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options = {}) => {
      const bustUrl = url + (url.includes('?') ? '&' : '?') + '_cb=' + Date.now()
      return fetch(bustUrl, { ...options, cache: 'no-store' })
    },
  },
})
