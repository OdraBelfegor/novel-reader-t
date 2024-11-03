<script lang="ts">
  import { Home, Writer, Reader, Options } from './views';
  import { currentView } from './stores.svelte';
</script>

{#if $currentView === 'home'}
  <Home />
{:else if $currentView === 'writer'}
  <Writer />
{:else if $currentView === 'reader'}
  <Reader />
{:else if $currentView === 'options'}
  <Options />
{/if}
