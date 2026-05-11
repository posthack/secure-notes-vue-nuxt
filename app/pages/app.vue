<script setup lang="ts">
useSeoMeta({ title: 'Хранилище — Secure Notes' })

const store = useNotesStore()

const EVENTS = ['pointerdown', 'keydown', 'scroll'] as const
const onActivity = () => store.touch()

function onVisible() {
  if (document.visibilityState === 'visible' && store.status === 'unlocked' && store.remote) {
    store.sync()
  }
}

onMounted(() => {
  store.init()
  for (const e of EVENTS) window.addEventListener(e, onActivity, { passive: true })
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onVisible)
})

onBeforeUnmount(() => {
  for (const e of EVENTS) window.removeEventListener(e, onActivity)
  document.removeEventListener('visibilitychange', onVisible)
  window.removeEventListener('focus', onVisible)
})
</script>

<template>
  <div>
    <NotesView v-if="store.status === 'unlocked'" />
    <UContainer v-else class="flex justify-center items-center min-h-[60vh] py-16">
      <VaultSetup v-if="store.status === 'empty'" />
      <VaultUnlock v-else-if="store.status === 'locked'" />
      <div v-else class="text-muted">Загрузка…</div>
    </UContainer>
  </div>
</template>
