<script setup lang="ts">
import { authClient } from '~/lib/authClient'

const store = useNotesStore()
const session = authClient.useSession()

const mode = ref<'in' | 'up'>('in')
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

const user = computed(() => session.value.data?.user ?? null)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const res =
      mode.value === 'in'
        ? await authClient.signIn.email({ email: email.value, password: password.value })
        : await authClient.signUp.email({
            email: email.value,
            password: password.value,
            name: email.value,
          })
    if (res.error) {
      error.value = res.error.message ?? 'не вышло'
      return
    }
    password.value = ''
  } finally {
    busy.value = false
  }
}

watch(
  () => user.value?.id,
  async (id) => {
    if (!id) return
    await store.enableSync()
    await store.sync()
  },
  { immediate: true },
)
</script>

<template>
  <div class="border-b border-default bg-elevated/50">
    <UContainer class="py-2 flex items-center gap-3 text-sm">
      <template v-if="user">
        <UIcon name="i-lucide-cloud" class="text-primary" />
        <span class="text-muted">{{ user.email }} — синхронизация включена</span>
        <div class="flex-1" />
        <UButton size="xs" variant="ghost" @click="store.sync()">Обновить</UButton>
        <UButton size="xs" color="neutral" variant="ghost" @click="authClient.signOut()">
          Выйти
        </UButton>
      </template>

      <template v-else>
        <form class="flex flex-wrap items-center gap-2" @submit.prevent="submit">
          <UInput v-model="email" type="email" placeholder="почта" size="xs" />
          <UInput v-model="password" type="password" placeholder="пароль" size="xs" />
          <UButton type="submit" size="xs" :loading="busy">
            {{ mode === 'in' ? 'Войти' : 'Регистрация' }}
          </UButton>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            @click="mode = mode === 'in' ? 'up' : 'in'"
          >
            {{ mode === 'in' ? 'нет аккаунта?' : 'уже есть аккаунт' }}
          </UButton>
          <span v-if="error" class="text-error">{{ error }}</span>
        </form>
        <div class="flex-1" />
        <span class="text-muted hidden sm:block"
          >аккаунт нужен только для синка между устройствами</span
        >
      </template>
    </UContainer>
  </div>
</template>
