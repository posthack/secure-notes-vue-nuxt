<script setup lang="ts">
import { generatePassword } from '~/lib/password'

const store = useNotesStore()
const demo = useRuntimeConfig().public.demo

const password = ref('')
const confirm = ref('')
const error = ref('')
const busy = ref(false)
const reveal = ref(false)

// сгенерировали — сразу показываем и проставляем в оба поля, чтобы человек его сохранил
function generate() {
  const p = generatePassword(20)
  password.value = p
  confirm.value = p
  reveal.value = true
}

async function tryDemo() {
  busy.value = true
  try {
    await store.loadDemo()
  } finally {
    busy.value = false
  }
}

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
        <UInput
          v-model="password"
          :type="reveal ? 'text' : 'password'"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Ещё раз">
        <UInput
          v-model="confirm"
          :type="reveal ? 'text' : 'password'"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>

      <div class="flex items-center gap-2 text-sm">
        <UButton
          type="button"
          icon="i-lucide-dices"
          size="xs"
          variant="ghost"
          color="neutral"
          @click="generate"
        >
          Сгенерировать
        </UButton>
        <UButton type="button" size="xs" variant="ghost" color="neutral" @click="reveal = !reveal">
          {{ reveal ? 'скрыть' : 'показать' }}
        </UButton>
      </div>

      <p v-if="error" class="text-sm text-error">{{ error }}</p>

      <UButton type="submit" :loading="busy" block>Создать</UButton>

      <UButton v-if="demo" variant="link" color="neutral" block @click="tryDemo">
        или посмотреть на демо-данных
      </UButton>
    </form>
  </UCard>
</template>
