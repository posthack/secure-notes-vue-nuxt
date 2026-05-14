<script setup lang="ts">
import { MAX_FILE_BYTES, type FileItem, type Note } from '~/stores/notes'

const props = defineProps<{ note: Note }>()
const emit = defineEmits<{ deleted: [] }>()

const store = useNotesStore()

const draft = reactive({ title: props.note.title, body: props.note.body })
let original = { title: props.note.title, body: props.note.body }
let currentId = props.note.id
const saveState = ref<'saved' | 'saving'>('saved')
let saveTimer: ReturnType<typeof setTimeout> | null = null

const titleInput = ref<{ inputRef?: HTMLInputElement | null } | null>(null)

const attachments = computed(() => store.files.filter((f) => f.noteId === props.note.id))
const noteShares = computed(() => store.outgoing.filter((s) => s.noteId === props.note.id))

const fileInput = ref<HTMLInputElement | null>(null)
const attaching = ref(false)
const confirmOpen = ref(false)
const toast = useToast()

const shareOpen = ref(false)
const shareEmail = ref('')
const shareExpiry = ref('0')
const shareError = ref('')
const sharing = ref(false)
const EXPIRY: Record<string, number> = { '1': 1, '7': 7, '30': 30 }

function isDirty() {
  return draft.title !== original.title || draft.body !== original.body
}

function scheduleSave() {
  saveState.value = 'saving'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void flush(), 700)
}

// дебаунс + принудительный флеш на blur/переключении/анмаунте — правки не теряются
async function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (!isDirty()) {
    saveState.value = 'saved'
    return
  }
  const id = currentId
  const title = draft.title
  const body = draft.body
  original = { title, body }
  await store.updateNote(id, { title, body })
  saveState.value = 'saved'
}

function focusTitleIfEmpty() {
  if (props.note.title || props.note.body) return
  nextTick(() => titleInput.value?.inputRef?.focus())
}

watch(
  () => props.note.id,
  (id) => {
    flush() // сохраняем то, что успели ввести в предыдущей заметке
    currentId = id
    original = { title: props.note.title, body: props.note.body }
    draft.title = props.note.title
    draft.body = props.note.body
    saveState.value = 'saved'
    focusTitleIfEmpty()
  },
)

function onUnload() {
  if (isDirty()) void flush()
}

onMounted(() => {
  focusTitleIfEmpty()
  window.addEventListener('beforeunload', onUnload)
})

onBeforeUnmount(() => {
  flush()
  window.removeEventListener('beforeunload', onUnload)
})

function humanSize(n: number) {
  if (n < 1024) return `${n} Б`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`
  return `${(n / 1024 / 1024).toFixed(1)} МБ`
}

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > MAX_FILE_BYTES) {
    toast.add({ title: `файл больше ${humanSize(MAX_FILE_BYTES)}`, color: 'error' })
    input.value = ''
    return
  }
  attaching.value = true
  try {
    const buf = new Uint8Array(await file.arrayBuffer())
    await store.addFile(props.note.id, file.name, file.type, buf)
  } catch {
    toast.add({ title: 'не удалось прикрепить файл', color: 'error' })
  } finally {
    attaching.value = false
    input.value = ''
  }
}

async function download(f: FileItem) {
  try {
    const { name, type, data } = await store.readFile(f.id)
    const blob = new Blob([data], { type: type || 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.add({ title: 'не удалось расшифровать файл', color: 'error' })
  }
}

async function doShare() {
  if (!shareEmail.value.trim()) return
  shareError.value = ''
  sharing.value = true
  try {
    const days = EXPIRY[shareExpiry.value]
    const expiresAt = days ? Date.now() + days * 86_400_000 : null
    await store.share(props.note.id, shareEmail.value, expiresAt)
    shareEmail.value = ''
  } catch (e) {
    shareError.value =
      (e as { statusCode?: number }).statusCode === 404
        ? 'у получателя нет аккаунта или ключа'
        : 'поделиться не вышло'
  } finally {
    sharing.value = false
  }
}

function expiryLabel(ts: number | null) {
  if (!ts) return 'без срока'
  const left = Math.ceil((ts - Date.now()) / 86_400_000)
  return left > 0 ? `ещё ${left} дн.` : 'истёк'
}

async function confirmDelete() {
  await store.removeNote(props.note.id)
  confirmOpen.value = false
  emit('deleted')
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="shrink-0 border-b border-default">
      <div class="max-w-3xl mx-auto w-full flex items-center gap-2 px-6 md:px-8 h-14">
        <span class="text-xs text-muted">
          {{ saveState === 'saving' ? 'сохранение…' : 'сохранено' }}
        </span>
        <div class="flex-1" />

        <input ref="fileInput" type="file" class="hidden" @change="onPick" />
        <UTooltip text="Прикрепить файл">
          <UButton
            icon="i-lucide-paperclip"
            size="sm"
            color="neutral"
            variant="ghost"
            aria-label="Вложения"
            :loading="attaching"
            @click="fileInput?.click()"
          />
        </UTooltip>

        <UTooltip text="Поделиться">
          <UButton
            icon="i-lucide-share-2"
            size="sm"
            color="neutral"
            variant="ghost"
            aria-label="Поделиться"
            @click="shareOpen = true"
          />
        </UTooltip>

        <UModal v-model:open="shareOpen" title="Поделиться заметкой">
          <template #body>
            <div class="space-y-4">
              <p v-if="!store.remote" class="text-sm text-muted">
                Для шаринга нужен аккаунт — иконка человека в шапке.
              </p>
              <template v-else>
                <form class="space-y-3" @submit.prevent="doShare">
                  <UFormField label="Почта получателя">
                    <UInput
                      v-model="shareEmail"
                      type="email"
                      placeholder="user@example.com"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField label="Доступ истекает">
                    <USelect
                      v-model="shareExpiry"
                      class="w-full"
                      :items="[
                        { label: 'никогда', value: '0' },
                        { label: 'через 1 день', value: '1' },
                        { label: 'через 7 дней', value: '7' },
                        { label: 'через 30 дней', value: '30' },
                      ]"
                    />
                  </UFormField>
                  <UButton type="submit" :loading="sharing" :disabled="!shareEmail.trim()" block>
                    Поделиться
                  </UButton>
                  <p v-if="shareError" class="text-sm text-error">{{ shareError }}</p>
                </form>

                <div v-if="noteShares.length" class="space-y-1">
                  <p class="text-xs font-medium text-muted uppercase">Уже есть доступ</p>
                  <ul class="flex flex-col gap-1">
                    <li
                      v-for="s in noteShares"
                      :key="s.id"
                      class="flex items-center gap-2 text-sm rounded px-2 py-1 hover:bg-elevated"
                    >
                      <UIcon name="i-lucide-user" class="text-muted shrink-0" />
                      <span class="truncate">{{ s.recipientEmail }}</span>
                      <span class="text-muted text-xs shrink-0">{{
                        expiryLabel(s.expiresAt)
                      }}</span>
                      <div class="flex-1" />
                      <UButton
                        icon="i-lucide-x"
                        size="xs"
                        variant="ghost"
                        color="error"
                        aria-label="Отозвать доступ"
                        @click="store.revokeShare(s.id)"
                      />
                    </li>
                  </ul>
                </div>

                <p class="text-xs text-muted">
                  Получатель увидит копию заметки на момент отправки. Отредактируете — поделитесь
                  ещё раз.
                </p>
              </template>
            </div>
          </template>
        </UModal>

        <UDropdownMenu
          :items="[
            {
              label: 'Удалить заметку',
              icon: 'i-lucide-trash-2',
              color: 'error',
              onSelect: () => (confirmOpen = true),
            },
          ]"
        >
          <UButton
            icon="i-lucide-ellipsis-vertical"
            size="sm"
            color="neutral"
            variant="ghost"
            aria-label="Ещё"
          />
        </UDropdownMenu>

        <UModal v-model:open="confirmOpen" title="Удалить заметку?" :ui="{ footer: 'justify-end' }">
          <template #body>
            <p class="text-sm text-muted">Вложения удалятся вместе с ней. Отменить нельзя.</p>
          </template>
          <template #footer>
            <UButton variant="ghost" color="neutral" @click="confirmOpen = false">Отмена</UButton>
            <UButton color="error" @click="confirmDelete">Удалить</UButton>
          </template>
        </UModal>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto">
      <div class="max-w-3xl mx-auto w-full flex flex-col gap-4 px-6 md:px-8 py-10">
        <UInput
          ref="titleInput"
          v-model="draft.title"
          variant="none"
          placeholder="Заголовок"
          class="w-full"
          :ui="{
            base: 'w-full text-3xl md:text-3xl font-semibold text-highlighted px-0 pb-1 rounded-none focus:outline-none',
          }"
          @update:model-value="scheduleSave"
          @blur="flush"
        />

        <div v-if="attachments.length" class="flex flex-wrap gap-2">
          <div
            v-for="f in attachments"
            :key="f.id"
            class="flex items-center gap-1.5 text-xs rounded-full border border-default pl-2.5 pr-1.5 py-1 hover:bg-elevated"
          >
            <UIcon name="i-lucide-file" class="size-3.5 text-muted shrink-0" />
            <button class="truncate max-w-32 hover:underline" @click="download(f)">
              {{ f.name }}
            </button>
            <button
              class="text-muted hover:text-error shrink-0"
              aria-label="Удалить вложение"
              @click="store.removeFile(f.id)"
            >
              <UIcon name="i-lucide-x" class="size-3.5" />
            </button>
          </div>
        </div>

        <UTextarea
          v-model="draft.body"
          variant="none"
          placeholder="Начните писать…"
          autoresize
          :rows="1"
          :ui="{ base: 'px-0 text-[15px] md:text-[15px] leading-relaxed' }"
          @update:model-value="scheduleSave"
          @blur="flush"
        />
      </div>
    </div>
  </div>
</template>
