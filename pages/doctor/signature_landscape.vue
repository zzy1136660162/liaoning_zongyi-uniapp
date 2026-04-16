<template>
  <view class="page">
    <view class="info-bar" v-if="doctorId && doctorName">
      <text>医生：{{ doctorName }}</text>
    </view>
    <view class="info-bar warn" v-else-if="doctorId && !doctorName">
      <text>正在加载医生信息...</text>
    </view>
    <view class="info-bar warn" v-else>
      <text>缺少医生ID，请返回重试</text>
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
      <view class="canvas-tip">请在上方区域内横屏签名</view>
    </view>

    <view class="btn-row" v-if="doctorId && doctorName">
      <button class="btn secondary" @click="clearCanvas">重签</button>
      <button class="btn primary" :loading="submitting" @click="submitSignature">确定</button>
    </view>
  </view>
</template>

<script>
import { BASE_URL, TOKEN_KEY, API_PATHS } from '@/utils/config.js'

export default {
  name: 'DoctorSignatureLandscape',
  data() {
    return {
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
    // 获取 doctorId
    if (options.doctorId) {
      this.doctorId = options.doctorId
      await this.loadDoctorInfo()
    }

    this.$nextTick(() => {
      this.initCanvas()
    })
  },
  methods: {
    async loadDoctorInfo() {
      if (!this.doctorId) return

      try {
        const token = uni.getStorageSync(TOKEN_KEY)
        const response = await new Promise((resolve, reject) => {
          uni.request({
            url: BASE_URL + API_PATHS.DOCTOR.DETAIL(this.doctorId),
            method: 'GET',
            header: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            success: (res) => {
              if (res.statusCode === 200 && res.data && res.data.code === 200) {
                resolve(res.data)
              } else {
                reject(new Error(res.data?.message || '获取医生信息失败'))
              }
            },
            fail: reject
          })
        })

        if (response.data) {
          this.doctorName = response.data.name || response.data.doctorName || '未知医生'
        }
      } catch (error) {
        console.error('获取医生信息失败:', error)
        this.doctorName = '未知医生'
        uni.showToast({
          title: '获取医生信息失败',
          icon: 'none'
        })
      }
    },

    initCanvas() {
      const systemInfo = uni.getSystemInfoSync()
      // 为了单屏展示：根据窗口高度动态计算可用画布高度，避免出现上下滚动
      const horizontalPadding = 16 // 页面左右留白更小
      const reservedHeight = 120 // 顶部信息+按钮区+间距的占位更小，留给画布更多空间
      const minHeight = 280 // 略增保底高度，让画布更大
      const maxHeight = systemInfo.windowHeight - 20 // 轻微余量

      const width = systemInfo.windowWidth - horizontalPadding
      let height = systemInfo.windowHeight - reservedHeight
      height = Math.max(minHeight, Math.min(height, maxHeight))

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
      this.ctx.beginPath()
      this.ctx.moveTo(p.x, p.y)
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

    // H5 / PC 端鼠标事件
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

    submitSignature() {
      if (!this.doctorId) {
        uni.showToast({ title: '缺少医生ID', icon: 'none' })
        return
      }
      if (this.submitting) return

      this.submitting = true

      uni.canvasToTempFilePath(
        {
          canvasId: 'signatureCanvas',
          success: res => {
            const tempFilePath = res.tempFilePath
            const token = uni.getStorageSync(TOKEN_KEY)
            const header = {}
            if (token) {
              header['Authorization'] = `Bearer ${token}`
            }
            uni.uploadFile({
              url: `${BASE_URL}/api/doctors/${this.doctorId}/signature`,
              filePath: tempFilePath,
              name: 'file',
              header: header,
              success: uploadRes => {
                try {
                  const data = JSON.parse(uploadRes.data || '{}')
                  if (data && data.code === 200) {
                    uni.showToast({
                      title: '签名已提交',
                      icon: 'success'
                    })
                    setTimeout(() => {
                      uni.navigateBack({ delta: 1 })
                    }, 1500)
                  } else {
                    uni.showToast({
                      title: data.message || '上传失败',
                      icon: 'none'
                    })
                  }
                } catch (e) {
                  uni.showToast({
                    title: '上传返回数据异常',
                    icon: 'none'
                  })
                }
              },
              fail: err => {
                console.error('上传签名失败:', err)
                uni.showToast({
                  title: '上传失败',
                  icon: 'none'
                })
              },
              complete: () => {
                this.submitting = false
              }
            })
          },
          fail: err => {
            console.error('导出签名失败:', err)
            uni.showToast({
              title: '导出签名失败',
              icon: 'none'
            })
            this.submitting = false
          }
        },
        this
      )
    }
  }
}
</script>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  background-color: #f5f6fa;
  padding: 12rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.info-bar {
  margin-bottom: 8rpx;
  font-size: 18rpx;
  color: #333;
}

.warn {
  color: #e64340;
}

.canvas-wrapper {
  flex: 1;
  margin-top: 4rpx;
  display: flex;
  flex-direction: column;
}

.signature-canvas {
  width: 100%;
  flex: 1;
  height: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 12rpx;
  background-color: #ffffff;
}

.canvas-tip {
  margin-top: 2rpx;
  font-size: 14rpx;
  color: #999999;
  text-align: center;
}

.btn-row {
  margin-top: 8rpx;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

.btn {
  flex: 1;
  margin: 0 6rpx;
  height: 56rpx;
  line-height: 56rpx;
  border-radius: 28rpx;
  font-size: 16rpx;
}

.primary {
  background-color: #2a82e4;
  color: #ffffff;
}

.secondary {
  background-color: #f5f5f5;
  color: #333333;
  border: 1px solid #333333;
}
</style>


