<template>
  <div id="celestial-map"></div>
</template>
<style>
  #celestial-map {
    max-width: 800px;
  }
  #celestial-map canvas {
    margin: auto;
    display: block;
    position: relative;
  }
</style>
<script>
export default {
  props: {
    center: Array,
  },
  async mounted() {
    const skymap = await import('d3-celestial');
    this.Celestial = skymap.Celestial();
    const cfg = this.buildConfig();
    this.Celestial.display(cfg);
  },
  data() {
    return {
      Celestial: null,
    };
  },
  methods: {
    buildConfig() {
      return {
        projection: "orthographic",
        transform: "equatorial",
        planets: { show: true, names: true },
        horizon: { show: true, opacity: 1 },
        stars: { propername: true },
        follow: "center",
        center: this.center,
        controls: false,
        form: false,
        zoomlevel: 10,
        datapath: "https://ofrohn.github.io/data/",
      };
    },
  },
  watch: {
    center(nv, ov) {
      if (!this.Celestial) return;

      let update = false;
      if (!ov || ov.length != 2 || nv[0] !== ov[0] || nv[1] !== ov[1]) {
        update = true;
      }

      if (update && nv.length === 2) {
        this.Celestial.stop(true);
        this.Celestial.rotate({ center: [...nv, 0] });
      }
    },
  },
};
</script>
