<template>
  <div class="pa-2">
    <div class="text-h4">Logs</div>
    <v-divider class="mb-2" />
    <v-list>
      <v-list-item
        v-for="(message, index) in messages"
        :key="`${message.ts?.getTime?.() || index}-${index}`"
        :title="message.message"
        :subtitle="message.ts.toLocaleTimeString('en-US')"
      />
    </v-list>
  </div>
</template>
<script>
import { mapState } from "vuex";

export default {
  computed: {
    ...mapState(["notifications"]),
    messages() {
      return this.notifications.slice().reverse().slice(0, 10);
    },
  },
};
</script>
