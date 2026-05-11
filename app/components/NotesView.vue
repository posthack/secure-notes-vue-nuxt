<script setup lang="ts">
import type { Note } from '~/stores/notes'

const store = useNotesStore()

const tab = ref<'mine' | 'shared'>('mine')
const selectedId = ref<string | null>(store.notes[0]?.id ?? null)
const selectedSharedId = ref<string | null>(null)

const selected = computed(() => store.notes.find((n) => n.id === selectedId.value) ?? null)
const selectedShared = computed(
  () => store.incoming.find((s) => s.id === selectedSharedId.value) ?? null,
)

function preview(note: Note) {
  return note.body.split('\n')[0]?.slice(0, 60) || 'пусто'
}

function expiryLabel(ts: number | null) {
  if (!ts) return 'без срока'
  const left = Math.ceil((ts - Date.now()) / 86_400_000)
  return left > 0 ? `ещё ${left} дн.` : 'истёк'
}

async function create() {
  const note = await store.addNote('Без названия', '')
  selectedId.value = note.id
}

function onDeleted() {
  selectedId.value = store.notes[0]?.id ?? null
}
</script>

<template>
  <div class="flex flex-col md:flex-row h-[calc(100dvh-4rem)]">
    <aside
      class="md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-default overflow-y-auto flex flex-col"
    >
      <div class="flex items-center gap-3 px-4 h-12 shrink-0 border-b border-default">
        <button
          class="text-sm font-semibold"
          :class="tab === 'mine' ? '' : 'text-muted'"
          @click="tab = 'mine'"
        >
          Заметки
        </button>
        <button
          v-if="store.remote"
          class="text-sm font-semibold flex items-center gap-1"
          :class="tab === 'shared' ? '' : 'text-muted'"
          @click="tab = 'shared'"
        >
          Поделились со мной
          <span v-if="store.incoming.length" class="text-xs text-primary">{{
            store.incoming.length
          }}</span>
        </button>
      </div>

      <div v-if="tab === 'mine'" class="p-2 shrink-0 border-b border-default">
        <UButton icon="i-lucide-plus" size="sm" variant="soft" block @click="create">
          Новая
        </UButton>
      </div>

      <div class="flex-1 overflow-y-auto">
        <template v-if="tab === 'mine'">
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
            @click="selectedSharedId = s.id"
          >
            <div class="font-medium truncate">{{ s.title || 'Без названия' }}</div>
            <div class="text-sm text-muted truncate">{{ s.ownerEmail }}</div>
          </button>
        </template>
      </div>
    </aside>

    <section class="flex-1 min-h-0 flex flex-col">
      <NoteEditor v-if="tab === 'mine' && selected" :note="selected" @deleted="onDeleted" />

      <div
        v-else-if="tab === 'mine'"
        class="flex-1 flex flex-col items-center justify-center gap-2 text-muted"
      >
        <UIcon name="i-lucide-notebook-pen" class="size-8" />
        <p>Выберите заметку или создайте новую</p>
      </div>

      <div v-else-if="selectedShared" class="flex-1 min-h-0 overflow-y-auto p-6">
        <div class="max-w-[68ch] mx-auto flex flex-col gap-3">
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
