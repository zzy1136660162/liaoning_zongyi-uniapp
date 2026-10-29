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
        <text class="order-no">
          订单号：{{ orderInfo.orderNo }}
        </text>
        <text class="order-time">
          {{ formatDateTime(orderInfo.completeTime) }}
        </text>
      </view>

      <view
        v-if="refundGroups.length > 1"
        class="refund-groups"
      >
        <button
          v-for="group in refundGroups"
          :key="group.key"
          class="group-btn"
          :class="{ active: activeRefundGroup === group.key }"
          :disabled="formLocked"
          @tap="selectRefundGroup(group.key)"
        >
          {{ group.label }}
        </button>
        <text class="group-tip">
          实物商品与疗法次数分别申请，每次提交一组。
        </text>
      </view>
      <view
        v-if="pendingSubmission"
        class="submission-notice"
      >
        申请结果尚未确认，请重试确认本次申请，或到退款记录查看进度。
      </view>

      <view class="refund-policy-tip">
        制剂、健康产品可提交退款申请；已有运单或已发货时，由后台核查物流后处理。请在退款记录查看进度。
      </view>
      <!-- 商品列表 -->
      <view class="products-section">
        <view class="section-title">
          退款商品
        </view>
        <view class="product-list">
          <view
            v-for="item in visibleProducts"
            :key="item.id"
            class="product-item"
          >
            <view class="product-left">
              <image
                class="product-image"
                :src="item.image"
                mode="aspectFill"
              />
              <view class="product-info">
                <text class="product-name">
                  {{ item.name }}
                </text>
                <text
                  v-if="item.specText"
                  class="product-spec"
                >
                  {{ item.specText }}
                </text>
                <text class="product-price">
                  ¥{{ item.price }}
                </text>
                <text class="product-refund-tip">
                  购买 {{ item.quantity }} {{ item.refundGroup === 'THERAPY' ? '次' : '件' }}
                  <template v-if="item.refundGroup === 'THERAPY'">
                    ，已用 {{ item.redeemedQuantity }} 次
                  </template>
                  ，退款中 {{ item.refundFrozenQuantity }} {{ item.refundGroup === 'THERAPY' ? '次' : '件' }}
                </text>
                <text v-if="item.refundCompletedQuantity > 0" class="product-refund-tip">
                  已退款 {{ item.refundCompletedQuantity }} {{ item.refundGroup === 'THERAPY' ? '次' : '件' }}
                </text>
                <text
                  v-if="Number(item.refundableQuantity || 0) <= 0"
                  class="product-refund-tip"
                >
                  {{ item.refundBlockedReason || '已无可退数量' }}
                </text>
                <text
                  v-else
                  class="product-refund-tip"
                >
                  可退 {{ item.refundableQuantity }} {{ item.refundGroup === 'THERAPY' ? '次' : '件' }}
                </text>
              </view>
            </view>
            <view class="product-right">
              <view class="quantity-control">
                <button
                  class="qty-btn"
                  :disabled="formLocked || Number(item.selectedQuantity || 0) <= 0"
                  @tap="decreaseQuantity(item)"
                >
                  -
                </button>
                <text class="qty-text">
                  {{ item.selectedQuantity }}
                </text>
                <button
                  class="qty-btn"
                  :disabled="formLocked || Number(item.selectedQuantity || 0) >= Number(item.refundableQuantity || 0)"
                  @tap="increaseQuantity(item)"
                >
                  +
                </button>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 退款原因 -->
      <view class="reason-section">
        <view class="section-title">
          退款原因（必选）
        </view>
        <view class="reason-options">
          <view
            v-for="reason in reasonOptions"
            :key="reason"
            class="reason-item"
            :class="{ active: form.refundReason === reason }"
            @tap="selectReason(reason)"
          >
            <text>{{ reason }}</text>
          </view>
        </view>
        <textarea
          v-model="form.refundDescription"
          class="reason-input"
          :disabled="formLocked"
          placeholder="请详细描述退款原因（可选）"
          maxlength="200"
        />
      </view>

      <!-- 上传图片 -->
      <view class="upload-section">
        <view class="section-title">
          上传凭证（可选）
        </view>
        <view class="upload-area">
          <view
            v-for="(image, index) in form.refundImages"
            :key="index"
            class="image-item"
          >
            <image
              :src="image"
              mode="aspectFill"
            />
            <view
              v-if="!formLocked"
              class="delete-btn"
              @tap="removeImage(index)"
            >
              <uni-icons
                type="close"
                size="16"
                color="#fff"
              />
            </view>
          </view>
          <view
            v-if="!formLocked && form.refundImages.length < 6"
            class="upload-btn"
            @tap="chooseImage"
          >
            <uni-icons
              type="plus"
              size="24"
              color="#999"
            />
            <text>上传图片</text>
          </view>
        </view>
        <text class="upload-tip">
          最多可上传6张图片，支持jpg、png格式
        </text>
      </view>

      <!-- 退款金额预览 -->
      <view class="amount-section">
        <view class="amount-row">
          <text class="amount-label">
            退款金额
          </text>
          <text class="amount-value">
            ¥{{ refundAmount.toFixed(2) }}
          </text>
        </view>
      </view>
    </view>

    <!-- 底部按钮 -->
    <view class="bottom-bar">
      <button
        class="submit-btn"
        :class="{ disabled: !canSubmit }"
        :disabled="!canSubmit"
        @tap="submitRefund"
      >
        {{ submitting ? '提交中...' : pendingSubmission ? '重试确认申请' : '提交申请' }}
      </button>
    </view>
  </view>
</template>

<script>
import { getSessionGeneration, isCurrentSession, assertCurrentSession } from '@/utils/session.js'
import { createPageReturn } from '@/utils/page-return.js'
import { getOrderDetail } from '@/api/order.js'
import { applyRefund, checkCanApplyRefund } from '@/api/refund.js'
import { uploadFile } from '@/api/common.js'
import { getImageUrl } from '@/utils/config.js'
import { logPageView, logButtonClick, logAccess, getActionFailureResult } from '@/utils/accessLog.js'

const PAGE_LOG = { moduleCode: 'REFUND', accessType: '退款售后', pageType: 'REFUND_APPLY', requestUri: '/pages/order/refund_apply' }
import { hasMixedTherapyAndNormalRefundItems, isTherapyRefundItem, resolveRefundType, createRefundRequestId, getRefundErrorModal } from '@/utils/refund.js'

export default {
  name: 'RefundApply',
  data() {
    const pageSession = getSessionGeneration()
    return {
      orderId: null,
      pageSession,
      pageReturn: createPageReturn(() => isCurrentSession(pageSession)),
      requestId: createRefundRequestId(),
      pendingSubmission: null,
      loading: false,
      uploading: false,
      pageActive: true,
      detailRequestSequence: 0,
      submitting: false,
      submitted: false,
      orderInfo: {},
      allProducts: [], // 订单所有商品
      activeRefundGroup: '',
      form: {
        refundReason: '',
        refundDescription: '',
        refundImages: []
      }
    }
  },

  computed: {
    formLocked() {
      return this.loading || this.uploading || this.submitting || this.submitted || Boolean(this.pendingSubmission)
    },

    refundGroups() {
      return [
        { key: 'PHYSICAL', label: '实物商品' },
        { key: 'THERAPY', label: '疗法次数' }
      ].filter(group => this.allProducts.some(item => item.refundGroup === group.key))
    },

    visibleProducts() {
      return this.allProducts.filter(item => item.refundGroup === this.activeRefundGroup)
    },

    reasonOptions() {
      return this.activeRefundGroup === 'THERAPY'
        ? ['未使用的疗法次数不再需要', '行程或时间安排变化', '疗法服务问题', '其他']
        : ['商品质量问题', '商品与描述不符', '包装损坏', '错发/漏发', '个人原因不想要了', '其他']
    },

    refundAmount() {
      if (this.pendingSubmission) return this.pendingSubmission.amount
      return this.allProducts.reduce((total, item) => {
        return total + (item.price * Number(item.selectedQuantity || 0))
      }, 0)
    },

    canSubmit() {
      return !this.loading && !this.uploading && !this.submitting && !this.submitted
    }
  },

  onLoad(options) {
    this.pageReturn.bind()
    this.orderId = options.orderId
    if (!this.orderId) {
      uni.showToast({
        title: '参数错误',
        icon: 'none'
      })
      this.pageReturn.schedule(() => this.safeNavigateBack(), 1500)
    }

  },

  onShow() {
    this.pageReturn.show()
    if (!isCurrentSession(this.pageSession)) return
    logPageView({ ...PAGE_LOG, pageId: this.orderId || '', actionCode: 'REFUND_APPLY_VIEW', accessTitle: '申请退款', accessDescription: '进入退款申请页，选择退款商品并填写申请' })
    if (this.orderId) this.loadOrderDetail()
  },

  onHide() {
    this.pageReturn.hide()
  },

  onUnload() {
    this.pageReturn.dispose()
    // 页面离开时收起自己开启的加载提示，迟到响应不能再操作新页面的提示。
    if (this.loading && isCurrentSession(this.pageSession)) uni.hideLoading()
    this.loading = false
    this.pageActive = false
    this.detailRequestSequence += 1
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

    async loadOrderDetail({ silent = false } = {}) {
      // 超时请求必须原样重试，不能刷新表单后把新内容复用到旧 requestId。
      if (this.formLocked || !this.pageActive || !isCurrentSession(this.pageSession)) return
      const sequence = ++this.detailRequestSequence
      const isCurrent = () => this.pageActive && sequence === this.detailRequestSequence && isCurrentSession(this.pageSession)
      this.loading = true
      try {
        if (!silent) uni.showLoading({ title: '加载中...' })

        // 检查是否可以申请退款
        const checkResult = await checkCanApplyRefund(this.orderId)
        if (!isCurrent()) return
        if (!checkResult) {
          this.allProducts = []
          uni.showModal({
            title: '提示',
            content: '该订单不符合退款条件',
            showCancel: false,
            success: () => {
              if (isCurrent()) this.safeNavigateBack()
            }
          })
          return
        }

        // 获取订单详情
        const order = await getOrderDetail(this.orderId, { showLoading: false })
        if (!isCurrent()) return
        this.applyOrderData(order)

      } catch (error) {
        if (!isCurrent()) return
        console.error('event=ui_order_refund_apply stage=load_order_detail result=failed reason=operation_incomplete')
        if (!silent) {
          const modal = getRefundErrorModal(error)
          if (modal) uni.showModal(modal)
          else uni.showToast({ title: error.message || '加载失败', icon: 'none' })
        }
      } finally {
        if (isCurrent()) {
          this.loading = false
          if (!silent) uni.hideLoading()
        }
      }
    },

    applyOrderData(order) {
      const previous = new Map(this.allProducts.map(item => [String(item.id), item]))
      this.orderInfo = {
        orderNo: order.orderNo,
        orderType: order.orderType,
        completeTime: order.completeTime,
        doctorName: order.doctorName,
        prescriptionDiagnosis: order.prescriptionDiagnosis
      }

      // 金额、购买快照和次数均来自订单接口，不读取现商品分类，也不自行推算可退上限。
      this.allProducts = (order.items || []).map(item => ({
        id: item.id, // 退款传订单明细 ID，同一商品的不同明细不能混用。
        productId: item.productId,
        name: item.productName,
        price: parseFloat(item.price || 0),
        quantity: item.quantity || 1,
        refundedQuantity: Number(item.refundedQuantity || 0),
        refundCompletedQuantity: Number(item.refundCompletedQuantity || 0),
        redeemedQuantity: Number(item.redeemedQuantity || 0),
        refundFrozenQuantity: Number(item.refundFrozenQuantity || 0),
        refundableQuantity: Number(item.refundableQuantity || 0),
        selectedQuantity: 0,
        refundable: Boolean(item.refundable),
        refundBlockedReason: item.refundBlockedReason || '',
        image: getImageUrl(item.productImage || item.coverImage || item.image || ''),
        skuId: item.skuId || null,
        skuCode: item.skuCode || '',
        skuName: item.skuName || '',
        specText: item.skuSpecText || item.specText || '',
        unit: item.unit,
        productCategorySnapshot: item.productCategorySnapshot,
        redeemRequiredSnapshot: item.redeemRequiredSnapshot,
        refundGroup: isTherapyRefundItem(item, order) ? 'THERAPY' : 'PHYSICAL',
        redeemVouchers: item.redeemVouchers || []
      }))

      const availableGroups = ['PHYSICAL', 'THERAPY'].filter(group =>
        this.allProducts.some(item => item.refundGroup === group && item.refundableQuantity > 0))
      if (!availableGroups.includes(this.activeRefundGroup)) {
        this.activeRefundGroup = availableGroups[0] || this.allProducts[0]?.refundGroup || ''
        this.form.refundReason = ''
      }
      let adjusted = false
      this.allProducts.forEach(item => {
        const old = previous.get(String(item.id))
        if (item.refundGroup !== this.activeRefundGroup) return
        const requested = old ? Number(old.selectedQuantity || 0) : previous.size ? 0 : item.refundableQuantity
        item.selectedQuantity = Math.min(requested, item.refundableQuantity)
        if (old && requested !== item.selectedQuantity) adjusted = true
      })
      if (adjusted) uni.showToast({ title: '可退数量已变化，请重新确认', icon: 'none' })
    },

    selectRefundGroup(group) {
      if (this.formLocked || group === this.activeRefundGroup) return
      this.activeRefundGroup = group
      this.form.refundReason = ''
      // 不自动拆成两笔请求；切换后只选当前组，另一组可在本次成功后继续申请。
      this.allProducts.forEach(item => {
        item.selectedQuantity = item.refundGroup === group ? item.refundableQuantity : 0
      })
    },

    selectReason(reason) {
      if (this.formLocked) return
      this.form.refundReason = reason
    },

    increaseQuantity(product) {
      if (this.formLocked || product.refundGroup !== this.activeRefundGroup) return
      const maxQuantity = Number(product.refundableQuantity || 0)

      if (Number(product.selectedQuantity || 0) < maxQuantity) {
        product.selectedQuantity = Number(product.selectedQuantity || 0) + 1
      }
    },

    decreaseQuantity(product) {
      if (this.formLocked || product.refundGroup !== this.activeRefundGroup) return
      if (Number(product.selectedQuantity || 0) > 0) {
        product.selectedQuantity = Number(product.selectedQuantity || 0) - 1
      }
    },

    async chooseImage() {
      if (this.formLocked) return
      this.uploading = true
      try {
        const result = await uni.chooseImage({
          count: 6 - this.form.refundImages.length,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera']
        })
        if (!this.pageActive || !isCurrentSession(this.pageSession)) return

        uni.showLoading({ title: '上传凭证中...' })
        for (const tempFilePath of result.tempFilePaths) {
          console.info('event=ui_order_refund_apply stage=evidence_upload result=started')
          const uploaded = await uploadFile(tempFilePath)
          if (!this.pageActive || !isCurrentSession(this.pageSession)) return
          this.form.refundImages.push(uploaded.url)
          console.info('event=ui_order_refund_apply stage=evidence_upload result=success')
        }
        uni.hideLoading()

      } catch (error) {
        if (!this.pageActive || !isCurrentSession(this.pageSession)) return
        uni.hideLoading()
        if (error?.errMsg && error.errMsg.includes('cancel')) {
          console.info('event=ui_order_refund_apply stage=evidence_choose result=cancelled')
          return
        }
        console.warn('event=ui_order_refund_apply stage=evidence_upload result=failed reason=operation_incomplete')
        uni.showToast({
          title: error.message || '凭证上传失败，请重试',
          icon: 'none'
        })
      } finally {
        this.uploading = false
        uni.hideLoading()
      }
    },

    removeImage(index) {
      if (this.formLocked) return
      this.form.refundImages.splice(index, 1)
    },

    async submitRefund() {
      if (!this.pageActive || !isCurrentSession(this.pageSession) || !this.canSubmit) return
      const validationMessage = this.pendingSubmission ? ''
        : !this.allProducts.some(item => Number(item.selectedQuantity || 0) > 0) ? '请选择退款商品'
          : !this.form.refundReason ? '请选择退款原因'
            : !(this.refundAmount > 0) ? '退款金额须大于0' : ''
      if (validationMessage) {
        logAccess({ ...PAGE_LOG, pageId: this.orderId || '', actionType: 'BEHAVIOR', actionCode: 'REFUND_SUBMIT_RESULT', actionResult: 'FAILED', accessTitle: '提交退款申请', accessDescription: '退款申请表单校验未通过，尚未提交', extraData: { reason: 'INVALID_FORM' } })
        uni.showToast({
          title: validationMessage,
          icon: 'none'
        })
        return
      }

      this.submitting = true
      let refreshAfterFailure = false
      try {
        assertCurrentSession(this.pageSession)
        logButtonClick({ ...PAGE_LOG, pageId: this.orderId || '', actionCode: 'REFUND_SUBMIT', accessTitle: '提交退款申请', accessDescription: '提交所选商品的原路退款请求，最终结果以渠道进度为准', extraData: { itemCount: this.allProducts.filter(item => Number(item.selectedQuantity || 0) > 0).length } })

        if (!this.pendingSubmission) {
          const selectedProducts = this.allProducts
            .filter(item => Number(item.selectedQuantity || 0) > 0)
            .map(item => ({ ...item, quantity: Number(item.selectedQuantity || 0) }))

          if (hasMixedTherapyAndNormalRefundItems(selectedProducts, this.orderInfo)) {
            logAccess({ ...PAGE_LOG, pageId: this.orderId || '', actionType: 'BEHAVIOR', actionCode: 'REFUND_SUBMIT_RESULT', actionResult: 'FAILED', accessTitle: '提交退款申请', accessDescription: '传统疗法与普通商品需要分开申请，尚未提交退款', extraData: { reason: 'MIXED_REFUND_SCENES' } })
            uni.showToast({ title: '传统疗法退款和实物商品退款请分开申请', icon: 'none' })
            return
          }

          // 保存本次提交内容；超时只说明没收到结果，重试不能改变数量、原因或幂等编号。
          this.pendingSubmission = {
            amount: this.refundAmount,
            data: {
              orderId: this.orderId,
              requestId: this.requestId,
              refundType: resolveRefundType(this.allProducts, selectedProducts),
              refundReason: this.form.refundReason,
              refundDescription: this.form.refundDescription,
              refundImages: [...this.form.refundImages],
              items: selectedProducts.map(item => ({
                orderItemId: item.id,
                quantity: item.quantity,
                refundReason: this.form.refundReason
              }))
            }
          }
        }

        uni.showLoading({ title: '提交中...' })
        await applyRefund(this.pendingSubmission.data)
        assertCurrentSession(this.pageSession)
        if (!this.pageActive) return
        logAccess({ ...PAGE_LOG, pageId: this.orderId || '', actionType: 'BEHAVIOR', actionCode: 'REFUND_SUBMIT_RESULT', actionResult: 'SUCCESS', accessTitle: '退款申请已提交', accessDescription: '服务端已受理退款申请，退款资金结果仍以申请进度为准', extraData: { itemCount: this.pendingSubmission.data.items.length } })
        this.submitted = true
        this.pendingSubmission = null

        uni.hideLoading()
        uni.showToast({
          title: '申请提交成功',
          icon: 'success'
        })

        // 返回上一页
        this.pageReturn.schedule(() => this.safeNavigateBack(), 1500)

      } catch (error) {
        if (!this.pageActive || error.code === 'SESSION_CHANGED' || !isCurrentSession(this.pageSession)) return
        if (getActionFailureResult(error) === 'FAILED') {
          // 明确拒绝后才能编辑新申请；新内容必须使用新的 requestId。
          this.pendingSubmission = null
          this.requestId = createRefundRequestId()
          refreshAfterFailure = true
        }
        logAccess({ ...PAGE_LOG, pageId: this.orderId || '', actionType: 'BEHAVIOR', actionCode: 'REFUND_SUBMIT_RESULT', actionResult: getActionFailureResult(error), accessTitle: '提交退款申请', accessDescription: '退款申请未获得服务端受理确认', extraData: { reason: 'SUBMISSION_NOT_CONFIRMED' } })
        console.error('event=ui_order_refund_apply stage=submit_refund result=failed reason=operation_incomplete')
        uni.hideLoading()
        const modal = getRefundErrorModal(error)
        if (modal) uni.showModal(modal)
        else uni.showToast({
          title: this.pendingSubmission ? '申请结果未确认，请重试确认' : error.message || '提交失败',
          icon: 'none'
        })
      } finally {
        this.submitting = false
        if (refreshAfterFailure) this.loadOrderDetail({ silent: true })
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

.refund-policy-tip {
  padding: 24rpx 32rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #666;
}

// 订单卡片
.refund-groups {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  padding: 24rpx 32rpx;

  .group-btn {
    flex: 1;
    margin: 0;
    font-size: 28rpx;
    background: #f5f5f5;
    color: #666;

    &.active {
      background: #e8f5ee;
      color: #258654;
    }
  }

  .group-tip {
    width: 100%;
    font-size: 24rpx;
    color: #888;
  }
}

.submission-notice {
  padding: 24rpx 32rpx;
  font-size: 26rpx;
  line-height: 1.6;
  background: #fff7e8;
  color: #96651c;
}

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

    &.disabled {
      background: #ddd;
      color: #999;
    }
  }
}
</style>
