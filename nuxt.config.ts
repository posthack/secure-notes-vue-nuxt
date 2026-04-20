// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@pinia/nuxt'],

  devtools: {
    enabled: true,
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/': { prerender: true },
    // хранилище работает с воркером, indexeddb и криптой — только на клиенте
    '/app': { ssr: false },
  },

  compatibilityDate: '2026-06-30',

  typescript: {
    strict: true,
    tsConfig: {
      compilerOptions: {
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true,
      },
    },
  },

  eslint: {
    config: {
      stylistic: false,
    },
  },
})
