<script setup lang="ts">
useSeoMeta({ title: 'Хранилище — Secure Notes' })

const store = useNotesStore()
const demo = useRuntimeConfig().public.demo

onMounted(() => {
  store.init()
})
</script>

<template>
  <div>
    <AuthBar v-if="!demo" />
    <NotesView v-if="store.status === 'unlocked'" />
    <UContainer v-else class="flex justify-center py-16">
      <VaultSetup v-if="store.status === 'empty'" />
      <VaultUnlock v-else-if="store.status === 'locked'" />
      <div v-else class="text-muted">Загрузка…</div>
    </UContainer>
  </div>
</template>
