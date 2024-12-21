<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLDialogAttributes } from 'svelte/elements';

  interface Props {
    children: Snippet;
  }

  let { children, ...rest }: Props & HTMLDialogAttributes = $props();

  let dialog: HTMLDialogElement;

  export function open() {
    console.log('Opening dialog');
    dialog.showModal();
  }

  export function close() {
    dialog.close();
  }

  function onkeydown(event: KeyboardEvent) {}
</script>

<!-- <svelte:window onclick={() => {}} /> -->

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialog}
  onclick={event => {
    close();
  }}
  {...rest}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div onclick={event => event.stopPropagation()}>
    {@render children()}
  </div>
</dialog>

<style>
  dialog {
    z-index: 99;
    padding: 0;
    width: fit-content;
    height: fit-content;
    border: 2px inset var(--senary-color);
    border-radius: 1rem;
    background-color: var(--secondary-color);
  }

  dialog::backdrop {
    backdrop-filter: blur(1px);
    background-color: rgba(0, 0, 0, 0.5);
  }

  div {
    color: var(--text-color);
    align-items: center;
    justify-content: center;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
