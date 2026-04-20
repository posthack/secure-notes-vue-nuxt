<script setup lang="ts">
import type { Note } from '~/stores/notes'

const store = useNotesStore()

const selectedId = ref<string | null>(store.notes[0]?.id ?? null)
const draft = reactive({ title: '', body: '' })
const dirty = ref(false)

const selected = computed(() => store.notes.find((n) => n.id === selectedId.value) ?? null)

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
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-4rem)]">
    <div class="flex items-center gap-3 px-4 h-14 border-b border-default">
      <h1 class="font-semibold">Заметки</h1>
      <div class="flex-1" />
      <UButton icon="i-lucide-plus" size="sm" @click="create">Новая</UButton>
      <UButton icon="i-lucide-lock" size="sm" color="neutral" variant="ghost" @click="store.lock()">
        Запереть
      </UButton>
    </div>

    <div class="flex flex-1 min-h-0 flex-col md:flex-row">
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

      <section v-if="selected" class="flex-1 min-h-0 flex flex-col p-4 gap-3">
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
          :rows="14"
          autoresize
          class="flex-1 px-0"
          @update:model-value="dirty = true"
        />
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
  </div>
</template>
