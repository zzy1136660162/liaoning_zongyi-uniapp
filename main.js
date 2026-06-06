
// #ifndef VUE3
import Vue from 'vue'
import AppVue2 from './App'
import { trackCurrentPageVisit } from '@/utils/page-tracker.js'

Vue.config.productionTip = false

Vue.mixin({
  onShow() {
    trackCurrentPageVisit()
  }
})

AppVue2.mpType = 'app'

const app = new Vue({
    ...AppVue2
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
import AppVue3 from './App.vue'
import { trackCurrentPageVisit } from '@/utils/page-tracker.js'

export function createApp() {
  const app = createSSRApp(AppVue3)

  app.mixin({
    onShow() {
      trackCurrentPageVisit()
    }
  })

  return {
    app
  }
}
// #endif
