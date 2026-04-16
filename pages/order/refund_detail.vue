<template>
  <view class="page">
    <!-- 顶部导航 -->
    <!-- <view class="nav-bar">
      <view class="nav-left" @tap="goBack">
        <uni-icons type="back" size="20" color="#333"></uni-icons>
      </view>
      <view class="nav-title">退货详情</view>
      <view class="nav-right"></view>
    </view> -->

    <!-- 申请信息卡片 -->
    <view class="detail-card">
      <!-- 申请状态 -->
      <view class="status-section">
        <view class="status-icon" :class="'status-' + detail.status">
          <uni-icons :type="getStatusIcon(detail.status)" size="48" :color="getStatusColor(detail.status)"></uni-icons>
        </view>
        <view class="status-info">
          <text class="status-text">{{ detail.statusText }}</text>
          <text class="status-desc">{{ getStatusDesc(detail.status) }}</text>
        </view>
      </view>

      <!-- 基本信息 -->
      <view class="info-section">
        <view class="info-row">
          <text class="info-label">退货申请单号</text>
          <text class="info-value">{{ detail.refundNo }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">申请时间</text>
          <text class="info-value">{{ formatDateTime(detail.createdAt) }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">退货金额</text>
          <text class="info-value amount">¥{{ detail.refundAmount }}</text>
        </view>
      </view>

      <!-- 订单信息 -->
      <view class="order-section" v-if="detail.orderInfo">
        <view class="section-title">订单信息</view>
        <view class="info-row">
          <text class="info-label">订单号</text>
          <text class="info-value">{{ detail.orderInfo.orderNo }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">完成时间</text>
          <text class="info-value">{{ formatDateTime(detail.orderInfo.completeTime) }}</text>
        </view>
      </view>

      <!-- 退货商品 -->
      <view class="products-section">
        <view class="section-title">退货商品</view>
        <view class="product-list">
          <view class="product-item" v-for="item in detail.items" :key="item.id">
            <image class="product-image" :src="item.productImage" mode="aspectFill" />
            <view class="product-info">
              <text class="product-name">{{ item.productName }}</text>
              <view class="product-meta">
                <text class="price">¥{{ item.price }}</text>
                <text class="quantity">×{{ item.quantity }}</text>
                <text class="subtotal">¥{{ item.subtotalAmount }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 退货原因 -->
      <view class="reason-section">
        <view class="section-title">退货原因</view>
        <view class="reason-content">
          <text class="reason-text">{{ detail.refundReason }}</text>
          <text class="description" v-if="detail.refundDescription">{{ detail.refundDescription }}</text>
        </view>
      </view>

      <!-- 退货物流 -->
      <view class="logistics-section" v-if="detail.returnLogisticsCompany">
        <view class="section-title">退货物流信息</view>
        <view class="logistics-info">
          <view class="info-row">
            <text class="info-label">物流公司</text>
            <text class="info-value">{{ detail.returnLogisticsCompany }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">物流单号</text>
            <text class="info-value">{{ detail.returnLogisticsNo }}</text>
          </view>
          <view class="info-row" v-if="detail.returnTime">
            <text class="info-label">发货时间</text>
            <text class="info-value">{{ formatDateTime(detail.returnTime) }}</text>
          </view>
        </view>
      </view>

      <!-- 审核信息 -->
      <view class="audit-section" v-if="detail.status >= 1">
        <view class="section-title">审核信息</view>
        <view class="audit-info">
          <view class="info-row" v-if="detail.reviewTime">
            <text class="info-label">审核时间</text>
            <text class="info-value">{{ formatDateTime(detail.reviewTime) }}</text>
          </view>
          <view class="info-row" v-if="detail.reviewRemark">
            <text class="info-label">审核备注</text>
            <text class="info-value">{{ detail.reviewRemark }}</text>
          </view>
        </view>
      </view>

      <!-- 退款信息 -->
      <view class="refund-section" v-if="detail.status === 4 && detail.refundTime">
        <view class="section-title">退款信息</view>
        <view class="refund-info">
          <view class="info-row">
            <text class="info-label">退款时间</text>
            <text class="info-value">{{ formatDateTime(detail.refundTime) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">退款金额</text>
            <text class="info-value amount">¥{{ detail.refundAmount }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部操作按钮 -->
    <view class="bottom-bar" v-if="showActionButton">
      <button
        class="action-btn"
        :class="getActionButtonClass()"
        @tap="handleAction"
      >
        {{ getActionButtonText() }}
      </button>
    </view>
  </view>
</template>

<script>
import { getRefundDetail, submitReturnLogistics } from '@/api/refund.js'
import { getImageUrl } from '@/utils/config.js'
import { logPageView, logButtonClick } from '@/utils/accessLog.js'

export default {
  name: 'RefundDetail',
  data() {
    return {
      refundApplicationId: null,
      detail: {}
    }
  },

  computed: {
    showActionButton() {
      // 审核通过状态且未填写物流信息时显示操作按钮
      return this.detail.status === 1 && !this.detail.returnLogisticsCompany
    }
  },

  onLoad(options) {
    this.refundApplicationId = options.refundApplicationId
    if (this.refundApplicationId) {
      this.loadDetail()
    } else {
      uni.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(() => {
        this.safeNavigateBack()
      }, 1500)
    }

    logPageView('退货详情', 'REFUND_DETAIL')
  },

  methods: {
    async loadDetail() {
      try {
        uni.showLoading({ title: '加载中...' })

        const detail = await getRefundDetail(this.refundApplicationId)
        this.detail = detail || {}

        // 处理商品图片URL（如果后端没有返回，使用占位图）
        if (this.detail.items && this.detail.items.length > 0) {
          this.detail.items = this.detail.items.map(item => ({
            ...item,
            productImage: item.productImage 
              ? getImageUrl(item.productImage) 
              : '/static/images/product-placeholder.png' // 占位图
          }))
        }

      } catch (error) {
        console.error('加载退货详情失败:', error)
        uni.showToast({
          title: error.message || '加载失败',
          icon: 'none'
        })
      } finally {
        uni.hideLoading()
      }
    },

    getStatusIcon(status) {
      const iconMap = {
        0: 'clock',      // 待审核
        1: 'checkmark',  // 审核通过
        2: 'close',      // 审核拒绝
        3: 'truck',      // 退货中
        4: 'checkmark',  // 已退货
        5: 'close'       // 退货失败
      }
      return iconMap[status] || 'help'
    },

    getStatusColor(status) {
      const colorMap = {
        0: '#ff6b35', // 待审核 - 橙色
        1: '#007aff', // 审核通过 - 蓝色
        2: '#ff3b30', // 审核拒绝 - 红色
        3: '#ff9500', // 退货中 - 橙色
        4: '#34c759', // 已退货 - 绿色
        5: '#8e8e93'  // 退货失败 - 灰色
      }
      return colorMap[status] || '#666'
    },

    getStatusDesc(status) {
      const descMap = {
        0: '您的退货申请已提交，等待商家审核',
        1: '退货申请审核通过，请填写退货物流信息',
        2: '退货申请审核未通过',
        3: '退货物流信息已提交，等待商家处理',
        4: '退货完成，款项已退回您的账户',
        5: '退货申请失败'
      }
      return descMap[status] || ''
    },

    getActionButtonText() {
      if (this.detail.status === 1) {
        return '填写物流信息'
      }
      return '操作'
    },

    getActionButtonClass() {
      if (this.detail.status === 1) {
        return 'primary-btn'
      }
      return 'default-btn'
    },

    async handleAction() {
      if (this.detail.status === 1) {
        // 跳转到物流填写页面或弹窗填写
        this.showLogisticsDialog()
      }
    },

    showLogisticsDialog() {
      // 这里可以跳转到专门的物流填写页面，或者使用弹窗
      uni.navigateTo({
        url: `/pages/order/refund_logistics?refundApplicationId=${this.refundApplicationId}`
      })
    },

    // 安全返回上一页，如果是首页则跳转到订单列表
    safeNavigateBack() {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        uni.navigateBack()
      } else {
        // 如果是首页，跳转到订单列表
        uni.redirectTo({
          url: '/pages/order/order_list'
        })
      }
    },

    goBack() {
      this.safeNavigateBack()
    },

    formatDateTime(dateTime) {
      if (!dateTime) return ''
      const date = new Date(dateTime)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  },

  // 页面显示时刷新数据
  onShow() {
    if (this.refundApplicationId) {
      this.loadDetail()
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 180rpx;
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

// 详情卡片
.detail-card {
  background: #fff;
  margin: 20rpx;
  border-radius: 16rpx;
  overflow: hidden;
}

// 状态section
.status-section {
  display: flex;
  align-items: center;
  padding: 40rpx 32rpx;
  background: linear-gradient(135deg, #fff, #fafafa);

  .status-icon {
    width: 96rpx;
    height: 96rpx;
    border-radius: 50%;
    background: rgba(255, 107, 53, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 24rpx;

    &.status-0 { background: rgba(255, 107, 53, 0.1); }
    &.status-1 { background: rgba(0, 122, 255, 0.1); }
    &.status-2 { background: rgba(255, 59, 48, 0.1); }
    &.status-3 { background: rgba(255, 149, 0, 0.1); }
    &.status-4 { background: rgba(52, 199, 89, 0.1); }
    &.status-5 { background: rgba(142, 142, 147, 0.1); }
  }

  .status-info {
    flex: 1;

    .status-text {
      display: block;
      font-size: 32rpx;
      font-weight: 600;
      color: #333;
      margin-bottom: 8rpx;
    }

    .status-desc {
      display: block;
      font-size: 26rpx;
      color: #666;
      line-height: 1.4;
    }
  }
}

// 通用section样式
.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  padding: 32rpx 32rpx 0;
}

.info-section,
.order-section,
.audit-section,
.refund-section,
.logistics-section {
  padding: 32rpx;
  border-top: 1rpx solid #f0f0f0;

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16rpx 0;

    .info-label {
      font-size: 28rpx;
      color: #666;
    }

    .info-value {
      font-size: 28rpx;
      color: #333;
      text-align: right;
      max-width: 400rpx;

      &.amount {
        color: #ff6b35;
        font-weight: 600;
        font-size: 32rpx;
      }
    }
  }
}

// 商品列表
.products-section {
  padding: 32rpx;
  border-top: 1rpx solid #f0f0f0;

  .product-list {
    .product-item {
      display: flex;
      align-items: center;
      padding: 24rpx 0;
      border-bottom: 1rpx solid #f0f0f0;

      &:last-child {
        border-bottom: none;
      }

      .product-image {
        width: 120rpx;
        height: 120rpx;
        border-radius: 8rpx;
        margin-right: 24rpx;
        flex-shrink: 0;
      }

      .product-info {
        flex: 1;

        .product-name {
          display: block;
          font-size: 28rpx;
          color: #333;
          margin-bottom: 12rpx;
          line-height: 1.4;
        }

        .product-meta {
          display: flex;
          align-items: center;
          gap: 16rpx;

          .price {
            font-size: 26rpx;
            color: #666;
          }

          .quantity {
            font-size: 26rpx;
            color: #666;
          }

          .subtotal {
            font-size: 28rpx;
            color: #ff6b35;
            font-weight: 600;
          }
        }
      }
    }
  }
}

// 退货原因
.reason-section {
  padding: 32rpx;
  border-top: 1rpx solid #f0f0f0;

  .reason-content {
    .reason-text {
      display: block;
      font-size: 28rpx;
      color: #333;
      margin-bottom: 16rpx;
    }

    .description {
      display: block;
      font-size: 26rpx;
      color: #666;
      line-height: 1.5;
    }
  }
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

  .action-btn {
    width: 100%;
    height: 88rpx;
    border: none;
    border-radius: 44rpx;
    font-size: 32rpx;
    font-weight: 600;

    &.primary-btn {
      background: linear-gradient(135deg, #ff6b35, #ff8c42);
      color: #fff;
    }

    &.default-btn {
      background: #f5f5f5;
      color: #666;
    }
  }
}
</style>
