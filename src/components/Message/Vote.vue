<template>
  <p>
    Voted "{{message.payload.choice}}" on the poll
    <router-link :to="'/u/' + message.payload.unit">
      <span class="monospace">{{message.payload.unit}}</span>
    </router-link>
  </p>
</template>

<script>
export default {
  props: ['message'],
};
</script>
