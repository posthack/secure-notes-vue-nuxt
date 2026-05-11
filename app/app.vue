<script setup lang="ts">
const route = useRoute()

useHead({
  htmlAttrs: { lang: 'ru' },
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
})

useSeoMeta({
  title: 'Secure Notes',
  description: 'Заметки со сквозным шифрованием на клиенте. Сервер хранит только шифртекст.',
})
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink to="/" class="font-semibold text-highlighted"> Secure Notes </NuxtLink>
      </template>

      <template #right>
        <ClientOnly>
          <AppAccount v-if="route.path === '/app'" />
        </ClientOnly>
        <UColorModeButton />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
