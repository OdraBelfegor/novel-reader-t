<script lang="ts">
  /** Title on hover */
  export let title: string;

  /** Size */
  export let size: 'small' | 'normal' = 'normal';

  /** Callback when the button is clicked */
</script>

<button
  type="button"
  {title}
  on:click
  class="button-primary btn-icon {size === 'small' ? 'btn-small' : 'btn'}"
>
  <slot />
</button>
