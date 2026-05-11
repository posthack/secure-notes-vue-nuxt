<script setup lang="ts">
import { authClient } from '~/lib/authClient'

const store = useNotesStore()
const demo = useRuntimeConfig().public.demo
const session = authClient.useSession()

const mode = ref<'in' | 'up'>('in')
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

const user = computed(() => session.value.data?.user ?? null)

const syncIcon = computed(() => {
  switch (store.syncStatus) {
    case 'syncing':
      return 'i-lucide-loader-circle'
    case 'synced':
      return 'i-lucide-cloud-check'
    case 'error':
      return 'i-lucide-cloud-off'
    default:
      return 'i-lucide-cloud'
  }
})

const syncText = computed(() => {
  switch (store.syncStatus) {
    case 'syncing':
      return 'синхронизация…'
    case 'synced':
      return 'синхронизировано'
    case 'error':
      return 'ошибка синхронизации'
    default:
      return 'синхронизация'
  }
})

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
  <div class="flex items-center gap-1">
    <UTooltip v-if="!demo && store.remote" :text="syncText">
      <UIcon
        :name="syncIcon"
        class="size-4"
        :class="[
          store.syncStatus === 'syncing' && 'animate-spin',
          store.syncStatus === 'error' ? 'text-error' : 'text-muted',
        ]"
      />
    </UTooltip>

    <UTooltip v-if="store.status === 'unlocked'" text="Запереть хранилище">
      <UButton
        icon="i-lucide-lock"
        size="sm"
        color="neutral"
        variant="ghost"
        aria-label="Запереть"
        @click="store.lock()"
      />
    </UTooltip>

    <UPopover v-if="!demo">
      <UButton
        icon="i-lucide-user"
        size="sm"
        color="neutral"
        variant="ghost"
        aria-label="Аккаунт"
      />

      <template #content>
        <div v-if="user" class="p-3 w-56 space-y-2">
          <p class="text-sm truncate">{{ user.email }}</p>
          <p class="text-xs text-muted">синхронизация включена</p>
          <UButton
            icon="i-lucide-refresh-cw"
            size="xs"
            variant="ghost"
            color="neutral"
            block
            @click="store.sync()"
          >
            Обновить
          </UButton>
          <UButton
            icon="i-lucide-log-out"
            size="xs"
            variant="ghost"
            color="neutral"
            block
            @click="authClient.signOut()"
          >
            Выйти
          </UButton>
        </div>

        <form v-else class="p-3 w-64 space-y-2" @submit.prevent="submit">
          <UInput v-model="email" type="email" placeholder="почта" size="sm" class="w-full" />
          <UInput
            v-model="password"
            type="password"
            placeholder="пароль"
            size="sm"
            class="w-full"
          />
          <UButton type="submit" size="sm" :loading="busy" block>
            {{ mode === 'in' ? 'Войти' : 'Регистрация' }}
          </UButton>
          <UButton
            type="button"
            size="xs"
            variant="ghost"
            color="neutral"
            block
            @click="mode = mode === 'in' ? 'up' : 'in'"
          >
            {{ mode === 'in' ? 'нет аккаунта?' : 'уже есть аккаунт' }}
          </UButton>
          <p v-if="error" class="text-xs text-error">{{ error }}</p>
          <p class="text-xs text-muted">
            аккаунт нужен только для синхронизации между устройствами
          </p>
        </form>
      </template>
    </UPopover>
  </div>
</template>
