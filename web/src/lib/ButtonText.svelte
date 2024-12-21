<svelte:options runes={true} />

<script lang="ts">
  interface Props {
    /** Size */
    size?: 'small' | 'normal';
    /** Callback when the button is clicked */
    children?: import('svelte').Snippet;
  }

  let {
    size = 'normal',
    children,
    ...props
  }: Props & import('svelte/elements').HTMLButtonAttributes = $props();
</script>

<button type="button" {...props} class="button-primary btn-text">
  {@render children?.()}
</button>
