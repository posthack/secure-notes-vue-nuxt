<script setup lang="ts">
const store = useNotesStore()

const password = ref('')
const confirm = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  if (password.value.length < 8) {
    error.value = 'пароль хотя бы 8 символов'
    return
  }
  if (password.value !== confirm.value) {
    error.value = 'пароли не совпадают'
    return
  }
  busy.value = true
  try {
    await store.setup(password.value)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard class="w-full max-w-md">
    <template #header>
      <h1 class="text-lg font-semibold">Новое хранилище</h1>
      <p class="text-sm text-muted mt-1">
        Пароль не уходит с устройства и восстановить его нельзя. Забудете — данные пропадут.
      </p>
    </template>

    <form class="space-y-4" @submit.prevent="submit">
      <UFormField label="Мастер-пароль">
        <UInput v-model="password" type="password" autocomplete="new-password" class="w-full" />
      </UFormField>
      <UFormField label="Ещё раз">
        <UInput v-model="confirm" type="password" autocomplete="new-password" class="w-full" />
      </UFormField>

      <p v-if="error" class="text-sm text-error">{{ error }}</p>

      <UButton type="submit" :loading="busy" block>Создать</UButton>
    </form>
  </UCard>
</template>
