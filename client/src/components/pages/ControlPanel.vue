<template>
  <div class="pa-2">
    <div class="text-h4">Control Panel</div>
    <LastNotification />
    <v-divider class="mb-2" />
    <v-expansion-panels>
      <v-expansion-panel v-for="device in deviceList" :key="device.name">
        <v-expansion-panel-title>{{ device.name }}</v-expansion-panel-title>
        <v-expansion-panel-text>
          <Device :device="device" />
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>
<script>
import Device from "@/components/Device.vue";
import LastNotification from "@/components/common/LastNotification.vue";
import { mapActions, mapState } from "vuex";

export default {
  components: {
    Device,
    LastNotification,
  },
  beforeMount() {
    this.sendMessage({ type: "get_devices" });
  },
  computed: {
    ...mapState(["devices"]),
    deviceList() {
      return Object.values(this.devices || {});
    },
  },
  methods: {
    ...mapActions(["sendMessage"]),
  },
};
</script>
