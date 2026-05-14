<script setup lang="ts">
const store = useNotesStore()
const demo = useRuntimeConfig().public.demo

const password = ref('')
const error = ref('')
const busy = ref(false)
const reveal = ref(false)

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
  <div class="w-full max-w-sm flex flex-col items-center text-center gap-6">
    <span class="flex items-center justify-center size-14 rounded-2xl bg-primary/10 text-primary">
      <UIcon name="i-lucide-lock-keyhole" class="size-7" />
    </span>
    <div class="space-y-1.5">
      <h1 class="text-2xl font-semibold text-highlighted">Хранилище заперто</h1>
      <p class="text-sm text-muted text-balance">
        Ключи не хранятся на устройстве. Введите мастер-пароль, чтобы расшифровать заметки.
      </p>
    </div>

    <form class="w-full space-y-3 text-left" @submit.prevent="submit">
      <UInput
        v-model="password"
        :type="reveal ? 'text' : 'password'"
        autocomplete="current-password"
        autofocus
        placeholder="Мастер-пароль"
        size="xl"
        class="w-full"
        :ui="{ trailing: 'pe-1' }"
      >
        <template #trailing>
          <UButton
            :icon="reveal ? 'i-lucide-eye-off' : 'i-lucide-eye'"
            variant="link"
            color="neutral"
            size="sm"
            :aria-label="reveal ? 'Скрыть пароль' : 'Показать пароль'"
            @click="reveal = !reveal"
          />
        </template>
      </UInput>

      <p v-if="error" class="text-sm text-error">{{ error }}</p>
      <p v-if="demo" class="text-sm text-muted">демо-пароль: <code>demo</code></p>

      <UButton type="submit" :loading="busy" block size="xl">Разблокировать</UButton>
    </form>
  </div>
</template>
