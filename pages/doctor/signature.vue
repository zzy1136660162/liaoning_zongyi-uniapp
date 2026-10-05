<template>
  <view class="page">
    <view class="card">
      <view class="title">医生签名确认</view>

      <view class="info" v-if="doctorId && doctorName">
        <text class="label">医生姓名：</text>
        <text class="value">{{ doctorName }}</text>
      </view>
      <view class="info" v-else-if="doctorId && !doctorName">
        <text class="warn">正在加载医生信息...</text>
      </view>
      <view class="info" v-else>
        <text class="warn">缺少医生ID，请通过扫码方式打开本页面。</text>
      </view>

      <view class="canvas-wrapper" v-if="doctorId && doctorName">
        <canvas
          canvas-id="signatureCanvas"
          class="signature-canvas"
          @touchstart="handleTouchStart"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
          @mousedown="handleMouseDown"
          @mousemove="handleMouseMove"
          @mouseup="handleMouseUp"
          @mouseleave="handleMouseUp"
        ></canvas>
        <view class="canvas-tip">请在上方区域内手写签名</view>
      </view>

      <view class="btn-row" v-if="doctorId && doctorName">
        <button class="btn secondary" @click="goLandscapePage">横屏签名</button>
        <button class="btn secondary" @click="clearCanvas">重签</button>
        <button class="btn primary" :loading="submitting" @click="submitSignature">确定</button>
      </view>
    </view>

  </view>
</template>

<script>
import { API_PATHS } from '@/utils/config.js'
import { get } from '@/utils/request.js'
import { uploadFile } from '@/api/common.js'
import { getSessionGeneration, isCurrentSession } from '@/utils/session.js'

export default {
  name: 'DoctorSignature',
  data() {
    return {
      sessionGeneration: getSessionGeneration(),
      doctorId: null,
      doctorName: null,
      ctx: null,
      drawing: false,
      lastPoint: { x: 0, y: 0 },
      canvasWidth: 0,
      canvasHeight: 0,
      submitting: false
    }
  },
  async onLoad(options) {
    // 从扫码链接中获取医生ID，如：/pages/doctor/signature?doctorId=1
    if (options.doctorId) {
      this.doctorId = options.doctorId
      // 获取医生信息
      await this.loadDoctorInfo()
    }

    // 延迟初始化画布，确保节点已渲染
    this.$nextTick(() => {
      if (isCurrentSession(this.sessionGeneration)) this.initCanvas()
    })
  },
  methods: {
    async loadDoctorInfo() {
      if (!this.doctorId) return

      try {
        const response = await get(API_PATHS.DOCTOR.DETAIL(this.doctorId), {}, { showLoading: false })
        if (!isCurrentSession(this.sessionGeneration)) return
        if (response) this.doctorName = response.name || response.doctorName || '未知医生'

      } catch (error) {
        if (!isCurrentSession(this.sessionGeneration) || error.code === 'SESSION_CHANGED') return
        console.warn('event=doctor_signature stage=load result=failed')
        this.doctorName = '未知医生'
        uni.showToast({
          title: '获取医生信息失败',
          icon: 'none'
        })
      }
    },

    initCanvas() {
      const systemInfo = uni.getSystemInfoSync()
      // 普通模式
      const width = systemInfo.windowWidth - 40 // 两侧留边
      const height = Math.floor(width * 0.4)

      this.canvasWidth = width
      this.canvasHeight = height

      const query = uni.createSelectorQuery().in(this)
      query
        .select('.signature-canvas')
        .fields({ node: true, size: true })
        .exec(res => {
          const canvas = res && res[0] && res[0].node
          if (!canvas) {
            // 非自定义渲染（小程序外），使用 createCanvasContext
            this.ctx = uni.createCanvasContext('signatureCanvas', this)
            this.ctx.setStrokeStyle('#000000')
            this.ctx.setLineWidth(3)
            this.ctx.setLineCap('round')
            this.ctx.setLineJoin('round')
            this.clearCanvas()
            return
          }

          // 微信小程序自定义渲染模式
          const dpr = systemInfo.pixelRatio || 1
          canvas.width = width * dpr
          canvas.height = height * dpr

          const ctx = canvas.getContext('2d')
          ctx.scale(dpr, dpr)
          ctx.lineWidth = 3
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.strokeStyle = '#000000'

          this.ctx = ctx
          this.clearCanvas()
        })
    },

    // 跳转到横屏页面（小程序使用 pageOrientation: landscape）
    goLandscapePage() {
      if (!this.doctorId) {
        uni.showToast({ title: '缺少医生ID', icon: 'none' })
        return
      }
      uni.navigateTo({
        url: `/pages/doctor/signature_landscape?doctorId=${this.doctorId}`
      })
    },

    getCanvasPoint(e) {
      const touch = e.touches && e.touches[0]
      if (touch) {
        return { x: touch.x || touch.clientX, y: touch.y || touch.clientY }
      }
      if (e.detail && typeof e.detail.x === 'number') {
        return { x: e.detail.x, y: e.detail.y }
      }
      return null
    },

    handleTouchStart(e) {
      const p = this.getCanvasPoint(e)
      if (!p || !this.ctx) return
      this.drawing = true
      this.lastPoint = p
      if (this.ctx.beginPath) {
        this.ctx.beginPath()
        this.ctx.moveTo(p.x, p.y)
      } else {
        this.ctx.beginPath()
        this.ctx.moveTo(p.x, p.y)
      }
    },
    handleTouchMove(e) {
      if (!this.drawing || !this.ctx) return
      const p = this.getCanvasPoint(e)
      if (!p) return
      this.ctx.lineTo(p.x, p.y)
      this.ctx.stroke()
      this.lastPoint = p
    },
    handleTouchEnd() {
      this.drawing = false
      if (this.ctx && this.ctx.draw) {
        this.ctx.draw(true)
      }
    },

    // H5 / PC 端鼠标事件，方便调试
    handleMouseDown(e) {
      const p = { x: e.offsetX, y: e.offsetY }
      if (!this.ctx) return
      this.drawing = true
      this.lastPoint = p
      this.ctx.beginPath()
      this.ctx.moveTo(p.x, p.y)
    },
    handleMouseMove(e) {
      if (!this.drawing || !this.ctx) return
      const p = { x: e.offsetX, y: e.offsetY }
      this.ctx.lineTo(p.x, p.y)
      this.ctx.stroke()
      this.lastPoint = p
    },
    handleMouseUp() {
      this.drawing = false
      if (this.ctx && this.ctx.draw) {
        this.ctx.draw(true)
      }
    },

    clearCanvas() {
      if (!this.ctx) return
      if (this.ctx.clearRect) {
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
      } else {
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
        this.ctx.draw()
      }
    },

    async submitSignature() {
      const session = this.sessionGeneration
      if (!isCurrentSession(session) || this.submitting) return
      if (!this.doctorId) {
        uni.showToast({ title: '缺少医生ID', icon: 'none' })
        return
      }
      this.submitting = true
      try {
        const image = await new Promise((resolve, reject) => uni.canvasToTempFilePath({
          canvasId: 'signatureCanvas', success: resolve, fail: reject
        }, this))
        if (!isCurrentSession(session)) return
        await uploadFile(image.tempFilePath, { url: `/api/doctors/${this.doctorId}/signature` })
        if (!isCurrentSession(session)) return
        uni.showToast({ title: '签名已提交', icon: 'success' })
        setTimeout(() => {
          if (isCurrentSession(session)) uni.navigateBack({ delta: 1 })
        }, 1500)
      } catch (error) {
        if (!isCurrentSession(session) || error.code === 'SESSION_CHANGED') return
        console.warn('event=doctor_signature stage=submit result=failed')
        uni.showToast({ title: error.message || '签名提交失败', icon: 'none' })
      } finally {
        if (isCurrentSession(session)) this.submitting = false
      }
    }
  }
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background-color: #f5f6fa;
  padding: 40rpx 20rpx;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
}

.card {
  width: 100%;
  max-width: 700rpx;
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 32rpx 24rpx 40rpx;
  box-shadow: 0 6rpx 18rpx rgba(0, 0, 0, 0.06);
}

.title {
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  margin-bottom: 24rpx;
  color: #333333;
}

.info {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 20rpx;
}

.label {
  font-size: 26rpx;
  color: #666666;
}

.value {
  font-size: 28rpx;
  color: #333333;
  margin-left: 10rpx;
}

.warn {
  font-size: 26rpx;
  color: #e64340;
}

.canvas-wrapper {
  margin-top: 20rpx;
}

.signature-canvas {
  width: 100%;
  height: 260rpx;
  border: 1px solid #e0e0e0;
  border-radius: 12rpx;
  background-color: #ffffff;
}

.canvas-tip {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #999999;
}

.btn-row {
  margin-top: 32rpx;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

.btn {
  flex: 1;
  margin: 0 8rpx;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
}

.primary {
  background-color: #2a82e4;
  color: #ffffff;
}

.secondary {
  background-color: #f5f5f5;
  color: #333333;
}
</style>


