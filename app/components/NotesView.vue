<script setup lang="ts">
import { MAX_FILE_BYTES, type FileItem, type Note } from '~/stores/notes'

const store = useNotesStore()

const tab = ref<'mine' | 'shared'>('mine')
const selectedId = ref<string | null>(store.notes[0]?.id ?? null)
const draft = reactive({ title: '', body: '' })
const dirty = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const fileError = ref('')
const busy = ref(false)

const shareEmail = ref('')
const shareExpiry = ref('0')
const shareError = ref('')
const sharing = ref(false)

const selected = computed(() => store.notes.find((n) => n.id === selectedId.value) ?? null)
const attachments = computed(() => store.files.filter((f) => f.noteId === selectedId.value))
const noteShares = computed(() => store.outgoing.filter((s) => s.noteId === selectedId.value))

const EXPIRY: Record<string, number> = { '1': 1, '7': 7, '30': 30 }

async function doShare() {
  if (!selected.value || !shareEmail.value.trim()) return
  shareError.value = ''
  sharing.value = true
  try {
    const days = EXPIRY[shareExpiry.value]
    const expiresAt = days ? Date.now() + days * 86_400_000 : null
    await store.share(selected.value.id, shareEmail.value, expiresAt)
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

watch(
  selected,
  (note) => {
    draft.title = note?.title ?? ''
    draft.body = note?.body ?? ''
    dirty.value = false
  },
  { immediate: true },
)

async function create() {
  const note = await store.addNote('Без названия', '')
  selectedId.value = note.id
}

async function save() {
  if (!selected.value) return
  await store.updateNote(selected.value.id, { title: draft.title, body: draft.body })
  dirty.value = false
}

async function remove(note: Note) {
  await store.removeNote(note.id)
  if (selectedId.value === note.id) selectedId.value = store.notes[0]?.id ?? null
}

function preview(note: Note) {
  return note.body.split('\n')[0]?.slice(0, 60) || 'пусто'
}

function humanSize(n: number) {
  if (n < 1024) return `${n} Б`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`
  return `${(n / 1024 / 1024).toFixed(1)} МБ`
}

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !selected.value) return
  fileError.value = ''
  if (file.size > MAX_FILE_BYTES) {
    fileError.value = `файл больше ${humanSize(MAX_FILE_BYTES)}`
    input.value = ''
    return
  }
  busy.value = true
  try {
    const buf = new Uint8Array(await file.arrayBuffer())
    await store.addFile(selected.value.id, file.name, file.type, buf)
  } catch {
    fileError.value = 'не удалось прикрепить файл'
  } finally {
    busy.value = false
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
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-4rem)]">
    <div class="flex items-center gap-3 px-4 h-14 border-b border-default">
      <button
        class="font-semibold"
        :class="tab === 'mine' ? '' : 'text-muted'"
        @click="tab = 'mine'"
      >
        Заметки
      </button>
      <button
        v-if="store.remote"
        class="font-semibold flex items-center gap-1"
        :class="tab === 'shared' ? '' : 'text-muted'"
        @click="tab = 'shared'"
      >
        Поделились со мной
        <span v-if="store.incoming.length" class="text-xs text-primary">{{
          store.incoming.length
        }}</span>
      </button>
      <div class="flex-1" />
      <template v-if="tab === 'mine'">
        <UButton icon="i-lucide-plus" size="sm" @click="create">Новая</UButton>
      </template>
      <UButton icon="i-lucide-lock" size="sm" color="neutral" variant="ghost" @click="store.lock()">
        Запереть
      </UButton>
    </div>

    <div v-if="tab === 'mine'" class="flex flex-1 min-h-0 flex-col md:flex-row">
      <aside
        class="md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-default overflow-y-auto"
      >
        <p v-if="!store.notes.length" class="p-4 text-sm text-muted">
          Пока пусто. Создайте первую заметку.
        </p>
        <button
          v-for="note in store.notes"
          :key="note.id"
          class="w-full text-left px-4 py-3 border-b border-default hover:bg-elevated"
          :class="{ 'bg-elevated': note.id === selectedId }"
          @click="selectedId = note.id"
        >
          <div class="font-medium truncate">{{ note.title || 'Без названия' }}</div>
          <div class="text-sm text-muted truncate">{{ preview(note) }}</div>
        </button>
      </aside>

      <section v-if="selected" class="flex-1 min-h-0 overflow-y-auto flex flex-col p-4 gap-3">
        <UInput
          v-model="draft.title"
          placeholder="Заголовок"
          variant="none"
          class="text-lg font-semibold px-0"
          @update:model-value="dirty = true"
        />
        <UTextarea
          v-model="draft.body"
          placeholder="Текст заметки…"
          variant="none"
          :rows="8"
          autoresize
          class="px-0"
          @update:model-value="dirty = true"
        />
        <div class="border-t border-default pt-3">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-sm font-medium text-muted">Вложения</span>
            <input ref="fileInput" type="file" class="hidden" @change="onPick" />
            <UButton
              icon="i-lucide-paperclip"
              size="xs"
              variant="ghost"
              :loading="busy"
              @click="fileInput?.click()"
            >
              Прикрепить
            </UButton>
            <span v-if="fileError" class="text-xs text-error">{{ fileError }}</span>
          </div>
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
          <p v-else class="text-xs text-muted">
            Файлы шифруются в браузере так же, как заметки — имя и содержимое.
          </p>
        </div>

        <div class="border-t border-default pt-3">
          <div class="text-sm font-medium text-muted mb-2">Поделиться</div>
          <p v-if="!store.remote" class="text-xs text-muted">
            Нужен аккаунт: заметка заворачивается публичным ключом получателя.
          </p>
          <template v-else>
            <form class="flex flex-wrap items-center gap-2" @submit.prevent="doShare">
              <UInput v-model="shareEmail" type="email" placeholder="почта получателя" size="sm" />
              <USelect
                v-model="shareExpiry"
                size="sm"
                :items="[
                  { label: 'без срока', value: '0' },
                  { label: '1 день', value: '1' },
                  { label: '7 дней', value: '7' },
                  { label: '30 дней', value: '30' },
                ]"
              />
              <UButton type="submit" size="sm" :loading="sharing" :disabled="!shareEmail.trim()">
                Поделиться
              </UButton>
              <span v-if="shareError" class="text-xs text-error">{{ shareError }}</span>
            </form>
            <ul v-if="noteShares.length" class="flex flex-col gap-1 mt-2">
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
            <p class="text-xs text-muted mt-1">
              Уходит снимок заметки. Поправите — поделитесь заново, у получателя останется старая
              версия.
            </p>
          </template>
        </div>

        <div class="flex items-center gap-2">
          <UButton :disabled="!dirty" @click="save">Сохранить</UButton>
          <span v-if="dirty" class="text-sm text-muted">есть несохранённые правки</span>
          <div class="flex-1" />
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            @click="remove(selected)"
          />
        </div>
      </section>

      <section v-else class="flex-1 flex items-center justify-center text-muted">
        Выберите заметку или создайте новую
      </section>
    </div>

    <div v-else class="flex-1 min-h-0 overflow-y-auto p-4">
      <p v-if="!store.incoming.length" class="text-sm text-muted">
        С вами пока ничем не поделились.
      </p>
      <div class="flex flex-col gap-3 max-w-2xl">
        <article
          v-for="s in store.incoming"
          :key="s.id"
          class="border border-default rounded-lg p-4"
        >
          <div class="flex items-baseline gap-2 mb-1">
            <h2 class="font-semibold truncate">{{ s.title || 'Без названия' }}</h2>
            <div class="flex-1" />
            <span class="text-xs text-muted shrink-0">{{ expiryLabel(s.expiresAt) }}</span>
          </div>
          <p class="text-xs text-muted mb-2">от {{ s.ownerEmail }}</p>
          <p class="text-sm whitespace-pre-wrap">{{ s.body }}</p>
        </article>
      </div>
    </div>
  </div>
</template>
