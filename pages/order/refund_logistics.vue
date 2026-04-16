<template>
  <view class="page">
    <!-- 顶部导航 -->
     <!--
    <view class="nav-bar">
      <view class="nav-left" @tap="goBack">
        <uni-icons type="back" size="20" color="#333"></uni-icons>
      </view>
      <view class="nav-title">填写物流信息</view>
      <view class="nav-right"></view>
    </view> -->

    <!-- 退货申请信息 -->
    <view class="info-card">
      <view class="info-header">
        <text class="order-no">退货申请：{{ refundDetail.refundNo }}</text>
        <text class="refund-amount">退款金额：¥{{ refundDetail.refundAmount }}</text>
      </view>
      <view class="info-desc">
        请填写退货物流信息，以便商家快速处理您的退货申请
      </view>
    </view>

    <!-- 物流信息表单 -->
    <view class="form-card">
      <!-- 物流公司选择 -->
      <view class="form-section">
        <view class="section-title">物流公司</view>
        <view class="picker-container">
          <picker
            mode="selector"
            :range="logisticsCompanies"
            :value="selectedCompanyIndex"
            @change="onCompanyChange"
            :disabled="form.logisticsCompany && !isFromPresetList"
          >
            <view class="picker-display">
              <text class="picker-text" :class="{ placeholder: !form.logisticsCompany }">
                {{ form.logisticsCompany || '请选择物流公司' }}
              </text>
              <uni-icons type="right" size="16" color="#ccc"></uni-icons>
            </view>
          </picker>
        </view>

        <!-- 其他物流公司输入框 -->
        <view class="input-container" v-if="isOtherCompany">
          <input
            class="form-input"
            v-model="form.logisticsCompany"
            placeholder="请输入物流公司名称"
            maxlength="50"
          />
        </view>
      </view>

      <!-- 物流单号 -->
      <view class="form-section">
        <view class="section-title">物流单号</view>
        <view class="input-container">
          <input
            class="form-input"
            v-model="form.logisticsNo"
            placeholder="请输入物流单号"
            maxlength="64"
          />
        </view>
        <text class="input-tip">物流单号通常为数字和字母组合</text>
      </view>

      <!-- 发货时间 -->
      <view class="form-section">
        <view class="section-title">发货时间</view>
        <view class="picker-container">
          <picker
            mode="date"
            :value="form.returnTime"
            :start="minDate"
            :end="maxDate"
            @change="onReturnTimeChange"
          >
            <view class="picker-display">
              <text class="picker-text" :class="{ placeholder: !form.returnTime }">
                {{ form.returnTime || '请选择发货时间' }}
              </text>
              <uni-icons type="calendar" size="16" color="#ccc"></uni-icons>
            </view>
          </picker>
        </view>
      </view>
    </view>

    <!-- 底部按钮 -->
    <view class="bottom-bar">
      <button
        class="submit-btn"
        @tap="submitLogistics"
        :disabled="!canSubmit"
      >
        提交物流信息
      </button>
    </view>
  </view>
</template>

<script>
import { getRefundDetail, submitReturnLogistics } from '@/api/refund.js'
import { logPageView, logButtonClick } from '@/utils/accessLog.js'

export default {
  name: 'RefundLogistics',
  data() {
    return {
      refundApplicationId: null,
      refundDetail: {},
      selectedCompanyIndex: 0,
      logisticsCompanies: [
        '顺丰速运',
        '中通快递',
        '圆通速递',
        '韵达快递',
        '申通快递',
        '邮政EMS',
        '京东物流',
        '德邦物流',
        '天天快递',
        '百世快递',
        '其他'
      ],
      form: {
        logisticsCompany: '',
        logisticsNo: '',
        returnTime: ''
      },
      minDate: '',
      maxDate: ''
    }
  },

  computed: {
    isOtherCompany() {
      return this.form.logisticsCompany === '其他' ||
             (this.selectedCompanyIndex === this.logisticsCompanies.length - 1)
    },

    isFromPresetList() {
      return this.logisticsCompanies.includes(this.form.logisticsCompany) &&
             this.form.logisticsCompany !== '其他'
    },

    canSubmit() {
      return this.form.logisticsCompany &&
             this.form.logisticsNo &&
             this.form.returnTime
    }
  },

  onLoad(options) {
    this.refundApplicationId = options.refundApplicationId
    if (this.refundApplicationId) {
      this.loadRefundDetail()
      this.initDateRange()
    } else {
      uni.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(() => {
        uni.navigateBack()
      }, 1500)
    }

    logPageView('填写物流信息', 'REFUND_LOGISTICS')
  },

  methods: {
    async loadRefundDetail() {
      try {
        const result = await getRefundDetail(this.refundApplicationId)
        this.refundDetail = result || {}

      } catch (error) {
        console.error('加载退货详情失败:', error)
        uni.showToast({
          title: error.message || '加载失败',
          icon: 'none'
        })
      }
    },

    initDateRange() {
      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      this.minDate = this.formatDate(sevenDaysAgo)
      this.maxDate = this.formatDate(now)
    },

    formatDate(date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    },

    onCompanyChange(e) {
      const index = e.detail.value
      this.selectedCompanyIndex = index
      const selectedCompany = this.logisticsCompanies[index]

      if (selectedCompany === '其他') {
        this.form.logisticsCompany = ''
      } else {
        this.form.logisticsCompany = selectedCompany
      }
    },

    onReturnTimeChange(e) {
      this.form.returnTime = e.detail.value
    },

    async submitLogistics() {
      if (!this.canSubmit) {
        uni.showToast({
          title: '请完善物流信息',
          icon: 'none'
        })
        return
      }

      // 表单验证
      if (this.form.logisticsCompany.trim() === '') {
        uni.showToast({
          title: '请选择或填写物流公司',
          icon: 'none'
        })
        return
      }

      if (this.form.logisticsNo.trim() === '') {
        uni.showToast({
          title: '请输入物流单号',
          icon: 'none'
        })
        return
      }

      try {
        logButtonClick('提交退货物流信息', 'REFUND_LOGISTICS', this.refundApplicationId?.toString())

        uni.showLoading({ title: '提交中...' })

        const submitData = {
          returnLogisticsCompany: this.form.logisticsCompany.trim(),
          returnLogisticsNo: this.form.logisticsNo.trim(),
          returnTime: this.form.returnTime
        }

        await submitReturnLogistics(this.refundApplicationId, submitData)

        uni.hideLoading()
        uni.showToast({
          title: '物流信息提交成功',
          icon: 'success'
        })

        // 延迟返回，让用户看到成功提示
        setTimeout(() => {
          this.navigateAfterSubmit()
        }, 1500)

      } catch (error) {
        console.error('提交物流信息失败:', error)
        uni.hideLoading()
        uni.showToast({
          title: error.message || '提交失败，请重试',
          icon: 'none'
        })
      }
    },

    goBack() {
      uni.navigateBack()
    },

    navigateAfterSubmit() {
      // 检查页面栈，如果只有当前页面，则跳转到退货列表页面
      const pages = getCurrentPages()
      if (pages.length > 1) {
        // 有上一页，可以返回
        uni.navigateBack()
      } else {
        // 没有上一页，跳转到退货列表页面
        uni.redirectTo({
          url: '/pages/order/refund_list'
        })
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 120rpx;
}

// 导航栏
.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  background: #fff;
  padding: 0 32rpx;
  border-bottom: 1rpx solid #e5e5e5;

  .nav-left {
    width: 80rpx;
    height: 80rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
  }

  .nav-right {
    width: 80rpx;
  }
}

// 信息卡片
.info-card {
  background: #fff;
  margin: 20rpx;
  border-radius: 16rpx;
  padding: 32rpx;
  overflow: hidden;

  .info-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16rpx;

    .order-no {
      font-size: 28rpx;
      color: #333;
      font-weight: 600;
    }

    .refund-amount {
      font-size: 28rpx;
      color: #ff6b35;
      font-weight: 600;
    }
  }

  .info-desc {
    font-size: 26rpx;
    color: #666;
    line-height: 1.5;
  }
}

// 表单卡片
.form-card {
  background: #fff;
  margin: 20rpx;
  border-radius: 16rpx;
  overflow: hidden;
}

// 表单section
.form-section {
  padding: 32rpx;
  border-bottom: 1rpx solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }

  .section-title {
    font-size: 30rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 24rpx;
  }
}

// 选择器容器
.picker-container {
  .picker-display {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24rpx 0;
    border-bottom: 1rpx solid #f0f0f0;

    .picker-text {
      font-size: 28rpx;
      color: #333;

      &.placeholder {
        color: #ccc;
      }
    }
  }
}

// 输入框容器
.input-container {
  .form-input {
    width: 100%;
    height: 80rpx;
    border: 1rpx solid #ddd;
    border-radius: 8rpx;
    padding: 0 24rpx;
    font-size: 28rpx;
    color: #333;
    background: #fff;
  }
}

.input-tip {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-top: 12rpx;
}

// 底部按钮
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  padding: 24rpx 32rpx;
  border-top: 1rpx solid #e5e5e5;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));

  .submit-btn {
    width: 100%;
    height: 88rpx;
    background: linear-gradient(135deg, #ff6b35, #ff8c42);
    color: #fff;
    font-size: 32rpx;
    font-weight: 600;
    border-radius: 44rpx;
    border: none;

    &:disabled {
      background: #ddd;
      color: #999;
    }
  }
}
</style>
