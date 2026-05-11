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
const fileError = ref('')
const attaching = ref(false)

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
  fileError.value = ''
  if (file.size > MAX_FILE_BYTES) {
    fileError.value = `файл больше ${humanSize(MAX_FILE_BYTES)}`
    input.value = ''
    return
  }
  attaching.value = true
  try {
    const buf = new Uint8Array(await file.arrayBuffer())
    await store.addFile(props.note.id, file.name, file.type, buf)
  } catch {
    fileError.value = 'не удалось прикрепить файл'
  } finally {
    attaching.value = false
    input.value = ''
  }
}

async function download(f: FileItem) {
  fileError.value = ''
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
    fileError.value = 'не удалось расшифровать файл'
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

async function confirmDelete(close: () => void) {
  await store.removeNote(props.note.id)
  close()
  emit('deleted')
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center gap-3 px-6 h-14 shrink-0 border-b border-default">
      <span class="text-xs text-muted">
        {{ saveState === 'saving' ? 'сохранение…' : 'сохранено' }}
      </span>
      <div class="flex-1" />

      <UPopover>
        <UButton
          icon="i-lucide-paperclip"
          size="sm"
          color="neutral"
          variant="ghost"
          aria-label="Вложения"
        />
        <template #content>
          <div class="p-3 w-72 space-y-2">
            <input ref="fileInput" type="file" class="hidden" @change="onPick" />
            <UButton
              icon="i-lucide-paperclip"
              size="xs"
              variant="ghost"
              color="neutral"
              block
              :loading="attaching"
              @click="fileInput?.click()"
            >
              Прикрепить файл
            </UButton>
            <p v-if="fileError" class="text-xs text-error">{{ fileError }}</p>
            <ul v-if="attachments.length" class="flex flex-col gap-1">
              <li
                v-for="f in attachments"
                :key="f.id"
                class="flex items-center gap-2 text-sm rounded px-2 py-1 hover:bg-elevated"
              >
                <UIcon name="i-lucide-file" class="text-muted shrink-0" />
                <button class="truncate text-left hover:underline" @click="download(f)">
                  {{ f.name }}
                </button>
                <span class="text-muted text-xs shrink-0">{{ humanSize(f.size) }}</span>
                <div class="flex-1" />
                <UButton
                  icon="i-lucide-download"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  @click="download(f)"
                />
                <UButton
                  icon="i-lucide-x"
                  size="xs"
                  variant="ghost"
                  color="error"
                  @click="store.removeFile(f.id)"
                />
              </li>
            </ul>
            <p v-else class="text-xs text-muted">Пока ничего не прикреплено</p>
          </div>
        </template>
      </UPopover>

      <UPopover>
        <UButton
          icon="i-lucide-share-2"
          size="sm"
          color="neutral"
          variant="ghost"
          aria-label="Поделиться"
        />
        <template #content>
          <div class="p-3 w-72 space-y-2">
            <p v-if="!store.remote" class="text-xs text-muted">Нужен аккаунт для шаринга</p>
            <template v-else>
              <form class="flex flex-col gap-2" @submit.prevent="doShare">
                <UInput
                  v-model="shareEmail"
                  type="email"
                  placeholder="почта получателя"
                  size="sm"
                  class="w-full"
                />
                <USelect
                  v-model="shareExpiry"
                  size="sm"
                  class="w-full"
                  :items="[
                    { label: 'без срока', value: '0' },
                    { label: '1 день', value: '1' },
                    { label: '7 дней', value: '7' },
                    { label: '30 дней', value: '30' },
                  ]"
                />
                <UButton
                  type="submit"
                  size="sm"
                  :loading="sharing"
                  :disabled="!shareEmail.trim()"
                  block
                >
                  Поделиться
                </UButton>
                <p v-if="shareError" class="text-xs text-error">{{ shareError }}</p>
              </form>
              <ul v-if="noteShares.length" class="flex flex-col gap-1">
                <li
                  v-for="s in noteShares"
                  :key="s.id"
                  class="flex items-center gap-2 text-sm rounded px-2 py-1 hover:bg-elevated"
                >
                  <UIcon name="i-lucide-user" class="text-muted shrink-0" />
                  <span class="truncate">{{ s.recipientEmail }}</span>
                  <span class="text-muted text-xs shrink-0">{{ expiryLabel(s.expiresAt) }}</span>
                  <div class="flex-1" />
                  <UButton
                    icon="i-lucide-x"
                    size="xs"
                    variant="ghost"
                    color="error"
                    @click="store.revokeShare(s.id)"
                  />
                </li>
              </ul>
              <p class="text-xs text-muted">Уходит снимок заметки. Поправите — поделитесь заново</p>
            </template>
          </div>
        </template>
      </UPopover>

      <UPopover>
        <UButton
          icon="i-lucide-trash-2"
          size="sm"
          color="error"
          variant="ghost"
          aria-label="Удалить"
        />
        <template #content="{ close }">
          <div class="p-3 w-56 space-y-3">
            <p class="text-sm">Удалить заметку?</p>
            <div class="flex gap-2">
              <UButton size="xs" color="error" @click="confirmDelete(close)">Удалить</UButton>
              <UButton size="xs" variant="ghost" color="neutral" @click="close">Отмена</UButton>
            </div>
          </div>
        </template>
      </UPopover>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto px-6 py-4">
      <div class="max-w-[68ch] mx-auto flex flex-col gap-3">
        <UInput
          ref="titleInput"
          v-model="draft.title"
          variant="none"
          placeholder="Заголовок"
          :ui="{
            base: 'text-2xl font-semibold text-highlighted px-0 pb-3 border-b border-default',
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
          :ui="{ base: 'px-0 leading-relaxed' }"
          @update:model-value="scheduleSave"
          @blur="flush"
        />
      </div>
    </div>
  </div>
</template>
