<script>
import { restoreAccountSession, getAccountSessionState } from './utils/auth-session.js'

const restoreOnShow = () => {
  if (!['unchecked', 'unavailable'].includes(getAccountSessionState().status)) return
  restoreAccountSession({ retry: getAccountSessionState().status === 'unavailable' }).catch(error => {
    if (error.code !== 'SESSION_CHANGED') uni.showToast({ title: error.message || '登录校验暂不可用，请重试', icon: 'none' })
  })
}

export default {
	globalData: {
		mallIntroPlayed: false
	},
	onLaunch: function() {
		this.globalData.mallIntroPlayed = false
		restoreOnShow()
		console.warn('当前组件仅支持 uni_modules 目录结构 ，请升级 HBuilderX 到 3.1.0 版本以上！')
		console.log('App Launch')
	},
	onShow: function() {
		console.log('App Show')
		restoreOnShow()
	},
	onHide: function() {
		console.log('App Hide')
	}
}
</script>

<style lang="scss">
	/*每个页面公共css */
	@import '@/uni_modules/uni-scss/index.scss';
	/* #ifndef APP-NVUE */
	@import '@/static/customicons.css';
	// 设置整个项目的背景色
	page {
		background-color: #f5f5f5;
	}

	/* #endif */
	.example-info {
		font-size: 14px;
		color: #333;
		padding: 10px;
	}
</style>
