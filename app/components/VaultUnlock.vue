<script setup lang="ts">
const store = useNotesStore()

const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    if (!(await store.unlock(password.value))) {
      error.value = 'неверный пароль'
      password.value = ''
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard class="w-full max-w-md">
    <template #header>
      <h1 class="text-lg font-semibold">Хранилище заперто</h1>
    </template>

    <form class="space-y-4" @submit.prevent="submit">
      <UFormField label="Мастер-пароль">
        <UInput
          v-model="password"
          type="password"
          autocomplete="current-password"
          autofocus
          class="w-full"
        />
      </UFormField>

      <p v-if="error" class="text-sm text-error">{{ error }}</p>

      <UButton type="submit" :loading="busy" block>Разблокировать</UButton>
    </form>
  </UCard>
</template>
