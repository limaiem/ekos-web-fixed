import { buildDevice } from "@/util/device";
import { createStore } from "vuex";

import {
  ALIGN_SOLVE,
  ALIGN_STOP,
  CAPTURE_PREVIEW,
  CAPTURE_SET_SETTINGS,
  CAPTURE_START,
  CAPTURE_STOP,
  DEVICE_GET,
  DEVICE_PROPERTY_SET,
  FOCUS_RESET,
  FOCUS_START,
  FOCUS_STOP,
  GET_CAMERAS,
  GET_CAPS,
  GET_DEVICES,
  GET_DOMES,
  GET_DRIVERS,
  GET_FILTER_WHEELS,
  GET_MOUNTS,
  GET_PROFILES,
  GET_STATES,
  GUIDE_CLEAR,
  GUIDE_START,
  GUIDE_STOP,
  IMAGE_DATA,
  LIVESTACK_IMAGE,
  LIVESTACK_LOG,
  MOUNT_ABORT,
  MOUNT_PARK,
  MOUNT_SET_TRACKING,
  MOUNT_UNPARK,
  NEW_ALIGN_STATE,
  NEW_CAMERA_STATE,
  NEW_CAPTURE_STATE,
  NEW_CONNECTION_STATE,
  NEW_FOCUS_STATE,
  NEW_GPS_STATE,
  NEW_GUIDE_STATE,
  NEW_MOUNT_STATE,
  NEW_NOTIFICATION,
  OPTION_SET_HIGH_BANDWIDTH,
  OPTION_SET_IMAGE_TRANSFER,
  OPTION_SET_NOTIFICATIONS,
  SET_CLIENT_STATE,
  START_PROFILE,
} from "../util/messageTypes";

const cloneDefaults = () => JSON.parse(JSON.stringify(defaultEkosStates));

const defaultEkosStates = {
  preview: {
    image: null,
  },
  mount: {
    status: "Idle",
    slewRate: null,
    target: null,
    at: null,
    az: null,
    de: null,
    ra: null,
  },
  guide: {
    status: "Idle",
  },
  focus: {
    status: "Idle",
  },
  capture: {
    status: "Idle",
  },
  align: {
    status: "Idle",
  },
  camera: null,
  cameras: [],
  filter_wheels: [],
  filters: [],
  notifications: [],
  lastNotification: null,
  devices: {},
  livestack: {
    messages: [],
    image: null,
  },
};

const store = createStore({
  state: {
    socket: {
      isConnected: false,
      message: "",
      reconnectError: false,
      connection: null,
    },
    connection: null,
    gps: {
      mode: 0,
      lat: null,
      lon: null,
      alt: null,
    },
    profiles: [],
    selectedProfile: null,
    ...cloneDefaults(),
  },
  getters: {
    mountPosition: (state) => {
      if (state.mount.ra !== null && state.mount.de !== null) {
        return [
          parseFloat(state.mount.ra.toFixed(3)),
          parseFloat(state.mount.de.toFixed(3)),
        ];
      }

      return null;
    },
    gpsLocation: (state) => {
      if (state.gps.lat !== null && state.gps.lon !== null) {
        return [
          parseFloat(state.gps.lat.toFixed(3)),
          parseFloat(state.gps.lon.toFixed(3)),
        ];
      }
      return null;
    },
    lastNotificationFormatted: (state) => {
      if (state.lastNotification) {
        return `${state.lastNotification.message} ${state.lastNotification.ts.toLocaleTimeString("en-US")}`;
      }

      return null;
    },
  },
  mutations: {
    SOCKET_ONOPEN(state, event) {
      state.socket.connection = event.currentTarget;
      state.socket.isConnected = true;
      state.socket.reconnectError = false;
    },
    SOCKET_ONCLOSE(state) {
      state.socket.isConnected = false;
    },
    SOCKET_ONERROR(state, event) {
      console.error(state, event);
    },
    SOCKET_ONMESSAGE(state, message) {
      const normalizedMessage = JSON.parse(JSON.stringify(message));
      state.socket.message = normalizedMessage;

      if (normalizedMessage?.type) {
        this.commit(normalizedMessage.type, normalizedMessage);
      }
    },
    SOCKET_RECONNECT(state, count) {
      console.info(state, count);
    },
    SOCKET_RECONNECT_ERROR(state) {
      state.socket.reconnectError = true;
    },
    SET_SELECTED_PROFILE(state, profile) {
      state.selectedProfile = profile;
    },
    RESET_EKOS_STATE(state) {
      Object.assign(state, cloneDefaults());
    },
    [IMAGE_DATA](state, message) {
      const shape = message.payload.resolution.split("x");

      message.payload.width = parseInt(shape[0], 10);
      message.payload.height = parseInt(shape[1], 10);

      switch (message.payload.uuid) {
        case "+G":
          state.guide.image = message.payload;
          break;
        case "+A":
          state.align.image = message.payload;
          break;
        case "+F":
          state.focus.image = message.payload;
          break;
        default:
          state.preview.image = message.payload;
      }
    },
    [NEW_MOUNT_STATE](state, message) {
      state.mount = {
        ...state.mount,
        ...message.payload,
      };
    },
    [NEW_CONNECTION_STATE](state, message) {
      state.connection = {
        ...state.connection,
        ...message.payload,
      };

      if (message.payload.connected) {
        if (message.payload.online) {
          this.dispatch("sendMessage", { type: SET_CLIENT_STATE, payload: { state: true } });
          this.dispatch("sendMessage", { type: GET_STATES });
          this.dispatch("sendMessage", { type: GET_CAMERAS });
          this.dispatch("sendMessage", { type: GET_MOUNTS });
          this.dispatch("sendMessage", { type: GET_FILTER_WHEELS });
          this.dispatch("sendMessage", { type: GET_DOMES });
          this.dispatch("sendMessage", { type: GET_CAPS });
          this.dispatch("sendMessage", { type: GET_DRIVERS });
          this.dispatch("sendMessage", { type: OPTION_SET_HIGH_BANDWIDTH, payload: true });
          this.dispatch("sendMessage", { type: OPTION_SET_IMAGE_TRANSFER, payload: true });
          this.dispatch("sendMessage", { type: OPTION_SET_NOTIFICATIONS, payload: true });
        } else {
          this.commit("RESET_EKOS_STATE");
          this.dispatch("sendMessage", { type: GET_PROFILES });
        }
      }
    },
    [NEW_GUIDE_STATE](state, message) {
      state.guide = {
        ...state.guide,
        ...message.payload,
      };
    },
    [NEW_FOCUS_STATE](state, message) {
      state.focus = {
        ...state.focus,
        ...message.payload,
      };
    },
    [NEW_CAPTURE_STATE](state, message) {
      state.capture = {
        ...state.capture,
        ...message.payload,
      };
    },
    [NEW_ALIGN_STATE](state, message) {
      state.align = {
        ...state.align,
        ...message.payload,
      };
    },
    [NEW_GPS_STATE](state, message) {
      state.gps = {
        ...state.gps,
        ...message.payload,
      };
    },
    [NEW_CAMERA_STATE](state, message) {
      state.camera = {
        ...state.camera,
        ...message.payload,
      };
    },
    [NEW_NOTIFICATION](state, message) {
      const msg = { ts: new Date(), ...message.payload };
      state.notifications.push(msg);
      state.lastNotification = msg;
    },
    [CAPTURE_SET_SETTINGS](state, message) {
      state.capture.settings = {
        ...state.capture.settings,
        ...message.payload,
      };

      state.filter_wheels.forEach((fw) => {
        if (fw.name === state.capture.settings.fw) {
          state.filters = [...fw.filters];
        }
      });
    },
    [GET_CAMERAS](state, message) {
      const cameras = [];
      for (const key in message.payload) {
        cameras.push(JSON.parse(JSON.stringify(message.payload[key])));
      }
      state.cameras = cameras;
    },
    [GET_FILTER_WHEELS](state, message) {
      const filterWheels = [];

      for (const key in message.payload) {
        const item = message.payload[key];

        if (state.capture.settings && state.capture.settings.fw && state.capture.settings.fw === item.name) {
          state.filters = [...item.filters];
        }

        filterWheels.push(JSON.parse(JSON.stringify(item)));
      }

      state.filter_wheels = filterWheels;
    },
    [GET_DEVICES](state, message) {
      for (const key in message.payload) {
        const item = JSON.parse(JSON.stringify(message.payload[key]));
        this.dispatch("sendMessage", { type: DEVICE_GET, payload: { device: item.name } });
      }
    },
    [DEVICE_GET](state, message) {
      const device = buildDevice(message.payload);
      if (device?.name) {
        state.devices[device.name] = device;
      }
    },
    [GET_PROFILES](state, message) {
      const profiles = [...(message.payload?.profiles || [])];
      state.profiles = profiles;
      if (!state.selectedProfile && profiles.length > 0) {
        state.selectedProfile = profiles[0].name;
      }
    },
    [LIVESTACK_LOG](state, message) {
      const msg = { ts: new Date(), message: message.payload };
      state.livestack.messages.push(msg);
    },
    [LIVESTACK_IMAGE](state, message) {
      state.livestack.image = message.payload;
    },
  },
  actions: {
    sendMessage: ({ state }, message) => {
      state.socket.connection?.send(JSON.stringify(message));
    },
    mountPark: ({ dispatch }) => {
      dispatch("sendMessage", { type: MOUNT_PARK });
    },
    mountUnpark: ({ dispatch }) => {
      dispatch("sendMessage", { type: MOUNT_UNPARK });
    },
    mountAbort: ({ dispatch }) => {
      dispatch("sendMessage", { type: MOUNT_ABORT });
    },
    mountSetTracking: ({ dispatch }, enabled) => {
      dispatch("sendMessage", {
        type: MOUNT_SET_TRACKING,
        payload: { enabled },
      });
    },
    guideStart: ({ dispatch }) => {
      dispatch("sendMessage", { type: GUIDE_START });
    },
    guideStop: ({ dispatch }) => {
      dispatch("sendMessage", { type: GUIDE_STOP });
    },
    guideClear: ({ dispatch }) => {
      dispatch("sendMessage", { type: GUIDE_CLEAR });
    },
    alignSolve: ({ dispatch }) => {
      dispatch("sendMessage", { type: ALIGN_SOLVE });
    },
    alignStop: ({ dispatch }) => {
      dispatch("sendMessage", { type: ALIGN_STOP });
    },
    focusStop: ({ dispatch }) => {
      dispatch("sendMessage", { type: FOCUS_STOP });
    },
    focusStart: ({ dispatch }) => {
      dispatch("sendMessage", { type: FOCUS_START });
    },
    focusReset: ({ dispatch }) => {
      dispatch("sendMessage", { type: FOCUS_RESET });
    },
    captureStop: ({ dispatch }) => {
      dispatch("sendMessage", { type: CAPTURE_STOP });
    },
    captureStart: ({ dispatch }) => {
      dispatch("sendMessage", { type: CAPTURE_START });
    },
    capturePreview: ({ dispatch, state }, settings) => {
      const mergedSettings = {
        ...state.capture.settings,
        ...settings,
      };

      dispatch("sendMessage", { type: CAPTURE_PREVIEW, payload: mergedSettings });
    },
    devicePropertySet: ({ dispatch }, data) => {
      dispatch("sendMessage", { type: DEVICE_PROPERTY_SET, payload: data });
    },
    startProfile: ({ dispatch }, profile) => {
      if (!profile) return;
      dispatch("sendMessage", { type: START_PROFILE, payload: { name: profile } });
    },
  },
});

export default store;
