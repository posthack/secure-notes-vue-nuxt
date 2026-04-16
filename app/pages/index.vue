<script setup lang="ts">
useSeoMeta({ title: 'Secure Notes' })
</script>

<template>
  <UPageHero
    title="Заметки, которые сервер не может прочитать"
    description="Всё шифруется в браузере вашим мастер-паролем. На сервер уходит только шифртекст — ни заметки, ни файлы, ни ключи в открытом виде он не видит."
    :links="[{ label: 'Скоро', color: 'neutral', variant: 'subtle', disabled: true }]"
  />
</template>
