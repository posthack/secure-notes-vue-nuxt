<script setup lang="ts">
import { authClient } from '~/lib/authClient'

useSeoMeta({ title: 'Secure Notes' })

const checking = ref(true)

onMounted(async () => {
  const { getVaultMeta } = await import('~/lib/db')
  const meta = await getVaultMeta()
  if (meta) {
    await navigateTo('/app')
    return
  }

  const session = await authClient.getSession()
  if (session.data?.user) {
    await navigateTo('/app')
    return
  }

  checking.value = false
})
</script>

<template>
  <UPageHero
    v-if="!checking"
    title="Заметки, которые сервер не может прочитать"
    description="Всё шифруется в браузере вашим мастер-паролем. На сервер уходит только шифртекст — ни заметки, ни файлы, ни ключи в открытом виде он не видит."
    :links="[{ label: 'Открыть хранилище', to: '/app', trailingIcon: 'i-lucide-arrow-right' }]"
  />
</template>
