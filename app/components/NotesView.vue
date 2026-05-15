<script setup lang="ts">
import type { Note } from '~/stores/notes'

const store = useNotesStore()

const tab = ref<'mine' | 'shared'>('mine')
const selectedId = ref<string | null>(store.notes[0]?.id ?? null)
const selectedSharedId = ref<string | null>(null)
const query = ref('')
const mobileOpen = ref(false)

function openNote(id: string) {
  selectedId.value = id
  mobileOpen.value = true
}

function openShared(id: string) {
  selectedSharedId.value = id
  mobileOpen.value = true
}

const selected = computed(() => store.notes.find((n) => n.id === selectedId.value) ?? null)
const selectedShared = computed(
  () => store.incoming.find((s) => s.id === selectedSharedId.value) ?? null,
)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return store.notes
  return store.notes.filter(
    (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
  )
})

function noteDate(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  if (d.getFullYear() === now.getFullYear())
    return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
  return d.toLocaleDateString('ru')
}

function noteTitle(note: Note) {
  if (note.title) return note.title
  const first = note.body.split('\n').find((l) => l.trim())
  return first ? first.slice(0, 40) : 'Без названия'
}

function preview(note: Note) {
  const lines = note.body.split('\n').filter((l) => l.trim())
  const src = note.title ? lines[0] : lines[1]
  return src?.slice(0, 60) || 'пусто'
}

function expiryLabel(ts: number | null) {
  if (!ts) return 'без срока'
  const left = Math.ceil((ts - Date.now()) / 86_400_000)
  return left > 0 ? `ещё ${left} дн.` : 'истёк'
}

async function create() {
  const note = await store.addNote('Без названия', '')
  selectedId.value = note.id
  mobileOpen.value = true
}

function onDeleted() {
  selectedId.value = store.notes[0]?.id ?? null
}
</script>

<template>
  <div class="flex flex-col md:flex-row h-[calc(100dvh-4rem)]">
    <aside
      class="md:w-80 shrink-0 md:border-r border-default overflow-y-auto flex-col"
      :class="mobileOpen ? 'hidden md:flex' : 'flex'"
    >
      <div class="p-3 space-y-2 shrink-0 border-b border-default">
        <div class="flex items-center gap-2">
          <UInput
            v-model="query"
            icon="i-lucide-search"
            placeholder="Поиск"
            size="sm"
            class="flex-1"
            :ui="{ trailing: 'pe-1' }"
          >
            <template v-if="query" #trailing>
              <UButton
                icon="i-lucide-x"
                variant="link"
                color="neutral"
                size="xs"
                aria-label="Очистить"
                @click="query = ''"
              />
            </template>
          </UInput>
          <UTooltip text="Новая заметка">
            <UButton icon="i-lucide-plus" size="sm" aria-label="Новая" @click="create">
              Новая
            </UButton>
          </UTooltip>
        </div>

        <UTabs
          v-if="store.remote"
          v-model="tab"
          size="xs"
          :content="false"
          :items="[
            { label: 'Мои', value: 'mine' },
            {
              label: `Со мной${store.incoming.length ? ' · ' + store.incoming.length : ''}`,
              value: 'shared',
            },
          ]"
          class="w-full"
        />
      </div>

      <div class="flex-1 overflow-y-auto">
        <template v-if="tab === 'mine'">
          <div
            v-if="!store.notes.length"
            class="flex flex-col items-center gap-2 p-8 text-center text-muted"
          >
            <UIcon name="i-lucide-notebook-pen" class="size-8" />
            <p class="text-sm">Пока пусто. Создайте первую заметку.</p>
          </div>
          <p v-else-if="!filtered.length" class="p-4 text-sm text-muted text-center">
            Ничего не нашлось
          </p>
          <button
            v-for="note in filtered"
            :key="note.id"
            class="w-full text-left px-4 py-3 border-b border-default transition-colors"
            :class="note.id === selectedId ? 'bg-primary/5' : 'hover:bg-elevated'"
            @click="openNote(note.id)"
          >
            <div class="flex items-baseline gap-2">
              <span
                class="font-medium truncate flex-1"
                :class="note.id === selectedId && 'text-highlighted'"
              >
                {{ noteTitle(note) }}
              </span>
              <span class="text-xs text-muted shrink-0">{{ noteDate(note.updatedAt) }}</span>
            </div>
            <div class="text-sm text-muted truncate mt-0.5">{{ preview(note) }}</div>
          </button>
        </template>

        <template v-else>
          <p v-if="!store.incoming.length" class="p-4 text-sm text-muted">
            С вами пока ничем не поделились.
          </p>
          <button
            v-for="s in store.incoming"
            :key="s.id"
            class="w-full text-left px-4 py-3 border-b border-default hover:bg-elevated"
            :class="{ 'bg-elevated': s.id === selectedSharedId }"
            @click="openShared(s.id)"
          >
            <div class="font-medium truncate">{{ s.title || 'Без названия' }}</div>
            <div class="text-sm text-muted truncate">{{ s.ownerEmail }}</div>
          </button>
        </template>
      </div>
    </aside>

    <section class="flex-1 min-h-0 flex-col" :class="mobileOpen ? 'flex' : 'hidden md:flex'">
      <NoteEditor
        v-if="tab === 'mine' && selected"
        :note="selected"
        @deleted="onDeleted"
        @back="mobileOpen = false"
      />

      <div
        v-else-if="tab === 'mine'"
        class="flex-1 flex flex-col items-center justify-center gap-2 text-muted"
      >
        <UIcon name="i-lucide-notebook-pen" class="size-8" />
        <p>Выберите заметку или создайте новую</p>
      </div>

      <div v-else-if="selectedShared" class="flex-1 min-h-0 overflow-y-auto p-6">
        <div class="max-w-3xl mx-auto w-full flex flex-col gap-3">
          <UButton
            icon="i-lucide-chevron-left"
            size="sm"
            color="neutral"
            variant="ghost"
            class="md:hidden self-start -ml-2"
            aria-label="Назад"
            @click="mobileOpen = false"
          />
          <h2 class="text-2xl font-semibold">{{ selectedShared.title || 'Без названия' }}</h2>
          <p class="text-sm text-muted">
            от {{ selectedShared.ownerEmail }} · {{ expiryLabel(selectedShared.expiresAt) }}
          </p>
          <p class="whitespace-pre-wrap leading-relaxed">{{ selectedShared.body }}</p>
        </div>
      </div>

      <div v-else class="flex-1 flex flex-col items-center justify-center gap-2 text-muted">
        <UIcon name="i-lucide-inbox" class="size-8" />
        <p>Выберите заметку</p>
      </div>
    </section>
  </div>
</template>
