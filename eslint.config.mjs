// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import prettier from 'eslint-config-prettier'

export default withNuxt(
  // форматирование целиком за prettier — гасим конфликтующие правила
  prettier,
)
