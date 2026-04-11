import { createApp } from "vue";
import App from "./App.vue";

import router from "@/plugins/router";
import vuetify from "@/plugins/vuetify";
import store from "@/plugins/vuex";

import VueNativeSock from "vue-native-websocket-vue3";
import "vuetify/styles";

const socketProtocol = window.location.protocol === "https:" ? "wss" : "ws";
const socketHost = window.location.host;

const app = createApp(App);

app.use(VueNativeSock, `${socketProtocol}://${socketHost}/interface`, {
  reconnection: true,
  store,
  format: "json",
});

app.use(vuetify);
app.use(store);
app.use(router);

app.mount("#app");
