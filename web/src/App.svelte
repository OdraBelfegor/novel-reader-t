<script lang="ts">
  import { Home, Writer, Reader, Options } from './views';
  import { currentView } from './stores';
</script>

<div class="view">
  {#if $currentView === 'home'}
    <Home />
  {:else if $currentView === 'writer'}
    <Writer />
  {:else if $currentView === 'reader'}
    <Reader />
  {:else if $currentView === 'options'}
    <Options />
  {/if}
</div>

<style>
  .view {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: calc(var(--area-padding) + 0.5rem);
  }
</style>
