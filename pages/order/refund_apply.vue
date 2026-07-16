<template>
  <view class="page">
    <!-- 顶部导航 -->
    <!-- <view class="nav-bar">
      <view class="nav-left" @tap="goBack">
        <uni-icons type="back" size="20" color="#333"></uni-icons>
      </view>
      <view class="nav-title">申请退款</view>
      <view class="nav-right"></view>
    </view> -->

    <!-- 订单信息卡片 -->
    <view class="order-card">
      <view class="card-header">
        <text class="order-no">订单号：{{ orderInfo.orderNo }}</text>
        <text class="order-time">{{ formatDateTime(orderInfo.completeTime) }}</text>
      </view>

      <!-- 商品列表 -->
      <view class="products-section">
        <view class="section-title">退款商品</view>
        <view class="product-list">
          <view class="product-item" v-for="(item, index) in allProducts" :key="item.id">
            <view class="product-left">
              <image class="product-image" :src="item.image" mode="aspectFill" />
              <view class="product-info">
                <text class="product-name">{{ item.name }}</text>
                <text class="product-spec" v-if="item.specText">{{ item.specText }}</text>
                <text class="product-price">¥{{ item.price }}</text>
                <text class="product-refund-tip" v-if="Number(item.refundableQuantity || 0) <= 0">
                  {{ item.refundBlockedReason || '已无可退数量' }}
                </text>
                <text class="product-refund-tip" v-else>
                  可退 {{ item.refundableQuantity }} 件，已占用 {{ item.refundedQuantity || 0 }} 件
                </text>
              </view>
            </view>
            <view class="product-right">
              <view class="quantity-control">
                <button class="qty-btn" :disabled="Number(item.selectedQuantity || 0) <= 0" @tap="decreaseQuantity(index)">-</button>
                <text class="qty-text">{{ item.selectedQuantity }}</text>
                <button class="qty-btn" :disabled="Number(item.selectedQuantity || 0) >= Number(item.refundableQuantity || 0)" @tap="increaseQuantity(index)">+</button>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 退款原因 -->
      <view class="reason-section">
        <view class="section-title">退款原因</view>
        <view class="reason-options">
          <view
            class="reason-item"
            v-for="reason in reasonOptions"
            :key="reason"
            :class="{ active: form.refundReason === reason }"
            @tap="selectReason(reason)"
          >
            <text>{{ reason }}</text>
          </view>
        </view>
        <textarea
          class="reason-input"
          v-model="form.refundDescription"
          placeholder="请详细描述退款原因（可选）"
          maxlength="200"
        />
      </view>

      <!-- 上传图片 -->
      <view class="upload-section">
        <view class="section-title">上传凭证（可选）</view>
        <view class="upload-area">
          <view class="image-item" v-for="(image, index) in form.refundImages" :key="index">
            <image :src="image" mode="aspectFill" />
            <view class="delete-btn" @tap="removeImage(index)">
              <uni-icons type="close" size="16" color="#fff"></uni-icons>
            </view>
          </view>
          <view class="upload-btn" v-if="form.refundImages.length < 6" @tap="chooseImage">
            <uni-icons type="plus" size="24" color="#999"></uni-icons>
            <text>上传图片</text>
          </view>
        </view>
        <text class="upload-tip">最多可上传6张图片，支持jpg、png格式</text>
      </view>

      <!-- 退款金额预览 -->
      <view class="amount-section">
        <view class="amount-row">
          <text class="amount-label">退款金额</text>
          <text class="amount-value">¥{{ refundAmount.toFixed(2) }}</text>
        </view>
      </view>
    </view>

    <!-- 底部按钮 -->
    <view class="bottom-bar">
      <button class="submit-btn" @tap="submitRefund" :disabled="!canSubmit">
        提交申请
      </button>
    </view>
  </view>
</template>

<script>
import { getOrderDetail } from '@/api/order.js'
import { applyRefund, checkCanApplyRefund } from '@/api/refund.js'
import { uploadFile } from '@/api/common.js'
import { getImageUrl } from '@/utils/config.js'
import { logPageView, logButtonClick } from '@/utils/accessLog.js'
import { hasMixedTherapyAndNormalRefundItems, resolveRefundType } from '@/utils/refund.js'

export default {
  name: 'RefundApply',
  data() {
    return {
      orderId: null,
      orderInfo: {},
      allProducts: [], // 订单所有商品
      selectedProducts: [], // 选中的退款商品
      form: {
        refundType: 2, // 1全单退款 2部分退款
        refundReason: '',
        refundDescription: '',
        refundImages: []
      },
      reasonOptions: [
        '商品质量问题',
        '商品与描述不符',
        '包装损坏',
        '错发/漏发',
        '个人原因不想要了',
        '其他'
      ]
    }
  },

  computed: {
    refundAmount() {
      return this.allProducts.reduce((total, item) => {
        return total + (item.price * Number(item.selectedQuantity || 0))
      }, 0)
    },

    canSubmit() {
      return this.allProducts.some(item => Number(item.selectedQuantity || 0) > 0) &&
             this.form.refundReason &&
             this.refundAmount > 0
    }
  },

  onLoad(options) {
    this.orderId = options.orderId
    if (this.orderId) {
      this.loadOrderDetail()
    } else {
      uni.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(() => {
        this.safeNavigateBack()
      }, 1500)
    }

    logPageView('退款申请', 'REFUND_APPLY')
  },

  methods: {
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

    async loadOrderDetail() {
      try {
        uni.showLoading({ title: '加载中...' })

        // 检查是否可以申请退款
        const checkResult = await checkCanApplyRefund(this.orderId)
        if (!checkResult) {
          uni.showModal({
            title: '提示',
            content: '该订单不符合退款条件',
            showCancel: false,
            success: () => {
              this.safeNavigateBack()
            }
          })
          return
        }

        // 获取订单详情
        const order = await getOrderDetail(this.orderId)

        this.orderInfo = {
          orderNo: order.orderNo,
          completeTime: order.completeTime,
          doctorName: order.doctorName,
          prescriptionDiagnosis: order.prescriptionDiagnosis
        }

        // 处理商品数据
        this.allProducts = (order.items || []).map(item => ({
          id: item.id, // 订单项ID，用于提交退款申请
          productId: item.productId, // 商品ID
          name: item.productName, // 商品名称
          price: parseFloat(item.price || 0), // 商品价格
          quantity: item.quantity || 1, // 购买数量
          purchasedQuantity: item.quantity || 1,
          refundedQuantity: Number(item.refundedQuantity || item.refunded_quantity || 0),
          refundableQuantity: Number(item.refundableQuantity || item.refundable_quantity || 0),
          selectedQuantity: Number(item.refundableQuantity || item.refundable_quantity || 0),
          refundable: Boolean(item.refundable),
          refundBlockedReason: item.refundBlockedReason || item.refund_blocked_reason || '',
          image: getImageUrl(item.productImage || item.coverImage || item.image || ''), // 商品图片
          skuId: item.skuId || item.sku_id || null,
          skuCode: item.skuCode || item.sku_code || '',
          skuName: item.skuName || item.sku_name || '',
          specText: item.skuSpecText || item.sku_spec_text || item.specText || item.spec_text || '',
          unit: item.unit,
          redeemVouchers: item.redeemVouchers || item.redeem_vouchers || []
        }))
        this.selectedProducts = this.allProducts
          .filter(item => Number(item.selectedQuantity || 0) > 0)
          .map(item => ({ ...item, quantity: item.selectedQuantity }))

      } catch (error) {
        console.error('加载订单详情失败:', error)
        uni.showToast({
          title: error.message || '加载失败',
          icon: 'none'
        })
      } finally {
        uni.hideLoading()
      }
    },

    selectReason(reason) {
      this.form.refundReason = reason
    },

    increaseQuantity(index) {
      const product = this.allProducts[index]
      const maxQuantity = Number(product.refundableQuantity || 0)

      if (Number(product.selectedQuantity || 0) < maxQuantity) {
        product.selectedQuantity = Number(product.selectedQuantity || 0) + 1
      }
    },

    decreaseQuantity(index) {
      const product = this.allProducts[index]
      if (Number(product.selectedQuantity || 0) > 0) {
        product.selectedQuantity = Number(product.selectedQuantity || 0) - 1
      }
    },

    async chooseImage() {
      try {
        const result = await uni.chooseImage({
          count: 6 - this.form.refundImages.length,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera']
        })

        uni.showLoading({ title: '上传凭证中...' })
        for (const tempFilePath of result.tempFilePaths) {
          console.info('category=REFUND_EVIDENCE_UPLOAD action=upload_start result=pending orderId=%s filePath=%s', this.orderId, tempFilePath)
          const uploaded = await uploadFile(tempFilePath)
          this.form.refundImages.push(uploaded.url)
          console.info('category=REFUND_EVIDENCE_UPLOAD action=upload_complete result=success orderId=%s fileUrl=%s', this.orderId, uploaded.url)
        }
        uni.hideLoading()

      } catch (error) {
        uni.hideLoading()
        if (error?.errMsg && error.errMsg.includes('cancel')) {
          console.info('category=REFUND_EVIDENCE_UPLOAD action=choose_image result=cancelled orderId=%s', this.orderId)
          return
        }
        console.warn('category=REFUND_EVIDENCE_UPLOAD action=upload_complete result=failed orderId=%s message=%s', this.orderId, error?.message || error?.errMsg || error)
        uni.showToast({
          title: error.message || '凭证上传失败，请重试',
          icon: 'none'
        })
      }
    },

    removeImage(index) {
      this.form.refundImages.splice(index, 1)
    },

    async submitRefund() {
      if (!this.canSubmit) {
        uni.showToast({
          title: '请完善退款信息',
          icon: 'none'
        })
        return
      }

      try {
        logButtonClick('提交退款申请', 'REFUND_APPLY', this.orderId?.toString())

        const selectedProducts = this.allProducts
          .filter(item => Number(item.selectedQuantity || 0) > 0)
          .map(item => ({ ...item, quantity: Number(item.selectedQuantity || 0) }))

        if (hasMixedTherapyAndNormalRefundItems(selectedProducts)) {
          uni.showToast({
            title: '传统疗法退款和普通商品退货请分开申请',
            icon: 'none'
          })
          return
        }

        uni.showLoading({ title: '提交中...' })

        const submitData = {
          orderId: this.orderId,
          refundType: resolveRefundType(this.allProducts, selectedProducts),
          refundReason: this.form.refundReason,
          refundDescription: this.form.refundDescription,
          refundImages: this.form.refundImages,
          items: selectedProducts.map(item => ({
            orderItemId: item.id,
            quantity: item.quantity,
            refundReason: this.form.refundReason
          }))
        }

        await applyRefund(submitData)

        uni.hideLoading()
        uni.showToast({
          title: '申请提交成功',
          icon: 'success'
        })

        // 返回上一页
        setTimeout(() => {
          this.safeNavigateBack()
        }, 1500)

      } catch (error) {
        console.error('提交退款申请失败:', error)
        uni.hideLoading()
        uni.showToast({
          title: error.message || '提交失败',
          icon: 'none'
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
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
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

// 订单卡片
.order-card {
  background: #fff;
  margin: 20rpx;
  border-radius: 16rpx;
  overflow: hidden;

  .card-header {
    padding: 32rpx;
    border-bottom: 1rpx solid #f0f0f0;

    .order-no {
      display: block;
      font-size: 28rpx;
      color: #333;
      margin-bottom: 8rpx;
    }

    .order-time {
      display: block;
      font-size: 24rpx;
      color: #999;
    }
  }
}

// 通用section样式
.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 24rpx;
}

// 商品列表
.products-section {
  padding: 32rpx;

  .product-list {
    .product-item {
      display: flex;
      align-items: center;
      padding: 24rpx 0;
      border-bottom: 1rpx solid #f0f0f0;

      &:last-child {
        border-bottom: none;
      }

      .product-left {
        flex: 1;
        display: flex;
        align-items: center;

        .product-image {
          width: 120rpx;
          height: 120rpx;
          border-radius: 8rpx;
          margin-right: 24rpx;
        }

        .product-info {
          flex: 1;

          .product-name {
            display: block;
            font-size: 28rpx;
            color: #333;
            margin-bottom: 8rpx;
            line-height: 1.4;
          }

          .product-spec {
            display: block;
            font-size: 24rpx;
            color: #64748b;
            margin-bottom: 6rpx;
            line-height: 1.4;
          }

          .product-price {
            display: block;
            font-size: 26rpx;
            color: #ff6b35;
          }

          .product-refund-tip {
            display: block;
            margin-top: 6rpx;
            font-size: 22rpx;
            color: #999;
            line-height: 1.4;
          }
        }
      }

      .product-right {
        .quantity-control {
          display: flex;
          align-items: center;

          .qty-btn {
            width: 60rpx;
            height: 60rpx;
            border: 1rpx solid #ddd;
            background: #fff;
            color: #333;
            font-size: 32rpx;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4rpx;

            &[disabled] {
              color: #bbb;
              background: #f5f5f5;
            }
          }

          .qty-text {
            width: 80rpx;
            text-align: center;
            font-size: 28rpx;
            color: #333;
          }
        }
      }
    }
  }
}

// 退款原因
.reason-section {
  padding: 32rpx;
  border-top: 1rpx solid #f0f0f0;

  .reason-options {
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx;
    margin-bottom: 24rpx;

    .reason-item {
      padding: 16rpx 24rpx;
      border: 1rpx solid #ddd;
      border-radius: 20rpx;
      font-size: 26rpx;
      color: #666;
      background: #fff;

      &.active {
        border-color: #ff6b35;
        color: #ff6b35;
        background: rgba(255, 107, 53, 0.1);
      }
    }
  }

  .reason-input {
    width: 100%;
    height: 120rpx;
    border: 1rpx solid #ddd;
    border-radius: 8rpx;
    padding: 16rpx;
    font-size: 26rpx;
    color: #333;
  }
}

// 上传图片
.upload-section {
  padding: 32rpx;
  border-top: 1rpx solid #f0f0f0;

  .upload-area {
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx;
    margin-bottom: 16rpx;

    .image-item {
      position: relative;
      width: 120rpx;
      height: 120rpx;

      image {
        width: 100%;
        height: 100%;
        border-radius: 8rpx;
      }

      .delete-btn {
        position: absolute;
        top: -8rpx;
        right: -8rpx;
        width: 32rpx;
        height: 32rpx;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }

    .upload-btn {
      width: 120rpx;
      height: 120rpx;
      border: 2rpx dashed #ddd;
      border-radius: 8rpx;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #999;

      text {
        font-size: 24rpx;
        margin-top: 8rpx;
      }
    }
  }

  .upload-tip {
    font-size: 24rpx;
    color: #999;
  }
}

// 退款金额
.amount-section {
  padding: 32rpx;
  border-top: 1rpx solid #f0f0f0;
  background: #fafafa;

  .amount-row {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .amount-label {
      font-size: 28rpx;
      color: #333;
    }

    .amount-value {
      font-size: 32rpx;
      font-weight: 600;
      color: #ff6b35;
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
  z-index: 20;

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
