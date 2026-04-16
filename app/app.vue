<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'ru' },
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }]
})

useSeoMeta({
  title: 'Secure Notes',
  description: 'Заметки со сквозным шифрованием на клиенте. Сервер хранит только шифртекст.'
})
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink
          to="/"
          class="font-semibold text-highlighted"
        >
          Secure Notes
        </NuxtLink>
      </template>

      <template #right>
        <UColorModeButton />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
