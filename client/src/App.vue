<template>
  <v-app id="app">
    <v-app-bar>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-toolbar-title>Ekos Web</v-toolbar-title>
      <v-spacer />
      <iconify-icon v-if="connected" icon="cloud" height="24" />
      <iconify-icon v-if="ekosStarted" icon="telescope" height="24" class="ml-2" />
    </v-app-bar>

    <v-navigation-drawer v-model="drawer">
      <v-list nav>
        <v-list-item
          v-for="r in routes"
          :key="r.name"
          :to="{ name: r.name }"
          :title="r.label || r.name"
          rounded="lg"
        >
          <template #prepend>
            <iconify-icon :icon="r.icon" height="24" />
          </template>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <div v-if="!ekosStarted" class="pa-2">
        <v-select
          v-model="selectedProfile"
          :items="profiles"
          label="Profile"
          item-title="name"
          item-value="name"
        />
        <v-btn @click.stop="startProfileClicked" :disabled="!selectedProfile">Start Profile</v-btn>
      </div>
      <router-view v-else />
    </v-main>
  </v-app>
</template>

<script>
import { IconifyIcon, routes } from "@/util/routes";
import { mapActions, mapState } from "vuex";

export default {
  components: {
    IconifyIcon,
  },
  computed: {
    ...mapState(["connection", "profiles"]),
    connected() {
      return this.connection?.connected;
    },
    ekosStarted() {
      return this.connection?.online;
    },
    selectedProfile: {
      get() {
        return this.$store.state.selectedProfile;
      },
      set(value) {
        this.$store.commit("SET_SELECTED_PROFILE", value);
      },
    },
  },
  data: () => ({
    drawer: null,
    routes,
  }),
  methods: {
    ...mapActions(["startProfile"]),
    startProfileClicked() {
      this.startProfile(this.selectedProfile);
    },
  },
};
</script>
