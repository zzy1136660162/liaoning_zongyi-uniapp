
// #ifndef VUE3
import Vue from 'vue'
import AppVue2 from './App'

Vue.config.productionTip = false

AppVue2.mpType = 'app'

const app = new Vue({
    ...AppVue2
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
import AppVue3 from './App.vue'
export function createApp() {
  const app = createSSRApp(AppVue3)
  return {
    app
  }
}
// #endif
