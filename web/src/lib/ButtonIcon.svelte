<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";

  interface Props {
    children: () => any;
    size?: 'small' | 'normal';
  }

  let {children, size = 'normal', ...rest}: Props & HTMLButtonAttributes = $props();

  /** Callback when the button is clicked */
</script>

<button
  type="button"
  {...rest}
  class="button-primary btn-icon {size === 'small' ? 'btn-small' : 'btn'}"
>
  {@render children?.()}
</button>
