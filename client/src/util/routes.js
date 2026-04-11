import Align from '@/components/pages/Align.vue'
import Capture from '@/components/pages/Capture.vue'
import Focus from '@/components/pages/Focus.vue'
import Guide from '@/components/pages/Guide.vue'
import LiveStack from '@/components/pages/LiveStack.vue'
import Logs from '@/components/pages/Logs.vue'
import Main from '@/components/pages/Main.vue'
import Mount from '@/components/pages/Mount.vue'
//import ControlPanel from '@/components/pages/ControlPanel.vue'

import camera from "@iconify/icons-mdi/camera"
import cloud from "@iconify/icons-mdi/cloud"
import cogs from "@iconify/icons-mdi/cogs"
import comment from "@iconify/icons-mdi/comment"
import compass from "@iconify/icons-mdi/compass"
import home from "@iconify/icons-mdi/home"
import magnify from "@iconify/icons-mdi/magnify"
import target from "@iconify/icons-mdi/target"
import telescope from "@iconify/icons-mdi/telescope"
import { Icon, addIcon } from "@iconify/vue"

addIcon("telescope", telescope);
addIcon("target", target);
addIcon("home", home);
addIcon("camera", camera);
addIcon("compass", compass);
addIcon("magnify", magnify);
addIcon("comment", comment);
addIcon("cloud", cloud);
addIcon("cogs", cogs);

const routes = [{
  name: "Main",
  path: "/",
  icon: "home",
  component: Main,
},{
  name: "Capture",
  path: "/capture",
  icon: "camera",
  component: Capture,
},{
  name: "Mount",
  path: "/mount",
  icon: "telescope",
  component: Mount,
},{
  name: "Align",
  path: "/align",
  icon: "target",
  component: Align,
},{
  name: "Guide",
  path: "/guide",
  icon: "compass",
  component: Guide,
},{
  name: "Focus",
  path: "/focus",
  icon: "magnify",
  component: Focus,
},{
  name: "Logs",
  path: "/logs",
  icon: "comment",
  component: Logs,
},{
  name: "LiveStack",
  path: "/livestack",
  icon: "camera",
  component: LiveStack,
},/*{
  name: "ControlPanel",
  label: "Control Panel",
  path: "/controlpanel",
  icon: "cogs",
  component: ControlPanel,
}*/];

export {
  Icon as IconifyIcon, routes
}
