<template>
  <view class="feedback-page">
    <view
      v-if="submitted"
      class="panel receipt"
    >
      <view class="receipt-mark">
        <uni-icons
          type="checkmarkempty"
          size="30"
          color="#806029"
        />
      </view>
      <text class="heading">
        反馈已提交
      </text>
      <button
        class="action"
        @click="returnToProfile"
      >
        返回我的页面
      </button>
    </view>
    <view
      v-else
      class="panel"
    >
      <label
        for="feedback-content"
        class="heading"
      >
        问题描述
      </label>
      <view class="editor">
        <textarea
          id="feedback-content"
          v-model="content"
          class="description"
          aria-label="问题描述，最多500字"
          placeholder="请描述在哪个页面、进行什么操作时遇到了问题，也可以写下您的建议。"
          placeholder-class="placeholder"
          :disabled="submitting"
          :maxlength="500"
          :cursor-spacing="32"
          @input="error = ''"
        />
        <text class="counter">
          {{ content.length }} / 500
        </text>
      </view>
      <text
        v-if="error"
        class="error"
      >
        {{ error }}
      </text>
      <button
        class="action"
        :disabled="submitting"
        :loading="submitting"
        @click="submit"
      >
        {{ submitting ? '正在提交' : '提交反馈' }}
      </button>
    </view>
  </view>
</template>

<script>
import { submitFeedback } from '@/api/feedback.js'
import { requireAccountSession } from '@/utils/auth-session.js'
import { createTraceId } from '@/utils/diagnostics.js'

export default {
  data() {
    return {
      content: '',
      error: '',
      submitting: false,
      submitted: false,
      lastContent: '',
      requestId: ''
    }
  },
  methods: {
    async submit() {
      if (this.submitting || this.submitted) return
      const content = this.content.trim()
      if (!content || content.length > 500) {
        this.error = '请填写 1 至 500 字的问题描述'
        return
      }
      this.submitting = true
      this.error = ''
      try {
        if (!await requireAccountSession('/pages/feedback/index')) return
        // 网络中断时可能已经写入，同一内容重试必须沿用原提交标识。
        if (this.lastContent !== content) {
          this.requestId = createTraceId()
          this.lastContent = content
        }
        await submitFeedback(content, this.requestId)
        this.submitted = true
      } catch (error) {
        if ([400, 409].includes(error?.code) && error.message) {
          this.error = error.message
          if (error.code === 409) this.lastContent = ''
        } else if (error?.code === 401) {
          this.error = '登录已过期，请重新登录后提交'
        } else if (error?.code === 'AUTH_RETRY_REQUIRED') {
          this.error = '登录已恢复，请再次提交'
        } else {
          this.error = '暂未确认提交结果，请检查网络后重试'
        }
      } finally {
        this.submitting = false
      }
    },
    returnToProfile() {
      const pages = getCurrentPages()
      if (pages[pages.length - 2]?.route === 'pages/user/profile') {
        uni.navigateBack()
      } else {
        uni.reLaunch({ url: '/pages/user/profile' })
      }
    }
  }
}
</script>

<style scoped>
.feedback-page {
  min-height: 100vh;
  padding: 32rpx 24rpx;
  box-sizing: border-box;
  background: #f6f5f1;
  color: #292b29;
}
.panel {
  padding: 40rpx 32rpx;
  border: 1rpx solid #e8e5dd;
  border-radius: 24rpx;
  background: #fff;
}
.heading {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
}
.editor {
  margin-top: 26rpx;
  padding: 24rpx;
  border: 1rpx solid #dcd9d0;
  border-radius: 12rpx;
  background: #fcfbf8;
}
.editor:focus-within {
  border-color: #9b7d4f;
}
.description {
  width: 100%;
  height: 260rpx;
  font-size: 30rpx;
  line-height: 1.65;
}
.placeholder, .counter {
  color: #77766d;
}
.counter {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  text-align: right;
}
.error {
  display: block;
  margin-top: 16rpx;
  color: #a24437;
  font-size: 26rpx;
}
.action {
  margin-top: 36rpx;
  border-radius: 12rpx;
  color: #fff;
  background: #313332;
  font-size: 30rpx;
  line-height: 88rpx;
  font-weight: 600;
}
.action::after {
  border: 0;
}
.action[disabled] {
  background: #777872;
  color: #fff;
}
.receipt {
  text-align: center;
}
.receipt-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96rpx;
  height: 96rpx;
  margin: 0 auto 24rpx;
  border-radius: 50%;
  background: #f3e9ce;
}
</style>
