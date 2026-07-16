<template>
  <view class="questionnaire-container">
    <view v-if="loading" class="loading-section">
      <text>问卷加载中...</text>
    </view>
    <view class="content-section" v-else-if="questions && questions.length > 0">
      <view
        class="question-item"
        v-for="(question, index) in questions"
        :key="'question-' + index"
      >
        <view class="question-header">
          <text class="question-label">Q{{ index + 1 }}. {{ question.text }}</text>
          <text class="question-type">单选题</text>
        </view>
        <view class="options">
          <view
            class="option-item"
            v-for="(option, optIndex) in question.options"
            :key="'option-' + index + '-' + optIndex"
            :class="{ active: question.selectedOptionId === option.optionId }"
            @click="selectAnswer(index, option.optionId)"
          >
            <view class="radio">
              <view class="radio-inner" v-if="question.selectedOptionId === option.optionId"></view>
            </view>
            <text class="option-text">{{ option.label }}</text>
          </view>
        </view>
      </view>

      <view class="question-count">- 共 {{ questions.length }} 题 -</view>

      <view class="button-group">
        <button class="save-btn" @click="saveDraft">暂存</button>
        <button class="submit-btn" @click="submitAnswer">提交</button>
      </view>
    </view>
    <view v-else class="empty-section">
      <text>暂无问卷数据</text>
    </view>
  </view>
</template>

<script>
import { STORAGE_KEY_CURRENT_CONSULTATION_ID } from '@/utils/storage.js'
import {
  addCartItem,
  buildCartItemKey,
  getCartProductQuantity,
  prepareCheckout,
  resolveCartCompatibility
} from '@/utils/cart.js'
import { getProductDetail } from '@/api/product.js'
import { getQuestionnaireByProductId, submitQuestionnaire } from '@/api/questionnaire.js'
import { logPageView } from '@/api/access-log.js'

export default {
  data() {
    return {
      productId: '',
      skuId: '',
      questionnaireId: null,
      loading: false,
      questions: [],
      requestedQuantity: 1,
      action: 'cart',
      productDetail: null
    }
  },
  onLoad(options) {
    this.productId = options.id || ''
    this.skuId = options.skuId || ''
    this.requestedQuantity = Math.max(1, Number(options.quantity) || 1)
    this.action = options.action || 'cart'
    if (this.productId) {
      this.loadQuestionnaire()
    }
  logPageView('PRODUCT_QUESTIONNAIRE', this.productId)
  },
  methods: {
    resolveSelectedProduct(detail = this.productDetail) {
      if (!detail || !this.skuId) {
        return detail
      }
      const skus = Array.isArray(detail.skus) ? detail.skus : []
      const sku = skus.find(item => String(item.id) === String(this.skuId))
      if (!sku) {
        return detail
      }
      return {
        ...detail,
        productId: detail.id,
        skuId: sku.id,
        skuCode: sku.skuCode || '',
        skuName: sku.skuName || '',
        skuSpecText: sku.specText || sku.skuName || '',
        specText: sku.specText || sku.skuName || detail.specText,
        price: Number(sku.price || 0),
        originalPrice: Number(sku.originalPrice || 0),
        stock: Number(sku.stock ?? detail.stock ?? 0),
        unit: sku.unit || detail.unit,
        image: sku.image || detail.image,
        coverImage: sku.image || detail.coverImage || detail.image
      }
    },
    getCartKey(detail = this.productDetail) {
      return buildCartItemKey(detail?.productId || detail?.id || this.productId, detail?.skuId || this.skuId || null)
    },
    getSelectedQuantity() {
      return Math.max(1, Number(this.requestedQuantity) || getCartProductQuantity(this.productId, 1, this.skuId) || 1)
    },
    async ensureCartCompatible(detail) {
      const target = detail || this.productDetail || await getProductDetail(this.productId)
      if (!target) {
        return false
      }
      const saleProduct = this.resolveSelectedProduct(target)
      const flow = resolveCartCompatibility(saleProduct, {
        ignoreCartKey: this.getCartKey(saleProduct)
      })
      if (!flow.valid) {
        uni.showToast({
          title: flow.message,
          icon: 'none'
        })
        return false
      }
      this.productDetail = target
      return true
    },
    async loadQuestionnaire() {
      if (!this.productId) {
        uni.showToast({
          title: '缺少商品信息',
          icon: 'none'
        })
        return
      }

      try {
        this.loading = true
        uni.showLoading({ title: '问卷加载中...' })
        const response = await getQuestionnaireByProductId(this.productId)
        const questionnaire = response.data || response

        this.questionnaireId = questionnaire.questionnaireId
        this.questions = (questionnaire.questions || []).map(q => ({
          questionId: q.questionId,
          text: q.title,
          questionType: q.questionType,
          isRequired: q.isRequired,
          isCore: q.isCore,
          options: (q.options || []).map(opt => ({
            optionId: opt.optionId,
            label: opt.optionText,
            value: opt.valueKey,
            scoreValue: opt.scoreValue || 0,
            isPositive: opt.isPositive,
            contraindicationFlag: opt.contraindicationFlag
          })),
          answer: null,
          selectedOptionId: null
        }))
      } catch (error) {
        console.error('loadQuestionnaire failed:', error)
        uni.showToast({
          title: error.message || 'Failed to load questionnaire',
          icon: 'none'
        })
        setTimeout(() => {
          uni.navigateBack()
        }, 1200)
      } finally {
        this.loading = false
        uni.hideLoading()
      }
    },
    goCheckout(detail) {
      const saleProduct = this.resolveSelectedProduct(detail)
      const cartKey = this.getCartKey(saleProduct)
      const checkout = prepareCheckout([cartKey], [{
        id: 'questionnaire_checkout',
        products: [{
          ...saleProduct,
          id: cartKey,
          cartKey,
          productId: saleProduct.productId || saleProduct.id
        }]
      }])
      if (!checkout.valid) {
        uni.showToast({
          title: checkout.message,
          icon: 'none'
        })
        return false
      }

      const selectedItems = checkout.productIds.join(',')
      if (!checkout.requiresConsultation) {
        uni.removeStorageSync(STORAGE_KEY_CURRENT_CONSULTATION_ID)
        const therapyParam = checkout.allTraditionalTherapy ? '&therapy=1' : ''
        uni.navigateTo({
          url: `/pages/order/confirm?selectedItems=${selectedItems}${therapyParam}`
        })
        return true
      }

      uni.navigateTo({
        url: `/pages/dispense/apply?selectedItems=${selectedItems}`
      })
      return true
    },
    selectAnswer(questionIndex, optionId) {
      this.questions[questionIndex].selectedOptionId = optionId
      const option = this.questions[questionIndex].options.find(opt => opt.optionId === optionId)
      if (option) {
        this.questions[questionIndex].answer = option.value
      }
    },
    saveDraft() {
      uni.showToast({
        title: '已暂存',
        icon: 'success'
      })
    },
    async submitAnswer() {
      if (!this.productId) {
        uni.showToast({
          title: '缺少商品信息',
          icon: 'none'
        })
        return
      }

      if (!this.questionnaireId) {
        uni.showToast({
          title: '问卷信息不完整',
          icon: 'none'
        })
        return
      }

      const requiredQuestions = this.questions.filter(q => q.isRequired === 1)
      const allRequiredAnswered = requiredQuestions.every(q => q.selectedOptionId != null)
      if (!allRequiredAnswered) {
        uni.showToast({
          title: '请完成所有必答题',
          icon: 'none'
        })
        return
      }

      try {
        uni.showLoading({ title: '提交中...' })
        const answers = this.questions
          .filter(q => q.selectedOptionId != null)
          .map(q => ({
            questionId: q.questionId,
            optionId: q.selectedOptionId,
            inputValue: null
          }))

        const response = await submitQuestionnaire({
          productId: this.productId,
          questionnaireId: this.questionnaireId,
          answers
        })
        const result = response.data || response

        if (result.isMatch) {
          const detail = this.productDetail || await getProductDetail(this.productId)
          if (!(await this.ensureCartCompatible(detail))) {
            return
          }

          const saleProduct = this.resolveSelectedProduct(detail)
          const success = addCartItem(saleProduct, this.getSelectedQuantity(), {
            questionnairePassed: true,
            questionnaireId: this.questionnaireId,
            answerId: result.answerId
          })
          if (!success) {
            uni.showToast({
              title: '加入购物车失败',
              icon: 'none'
            })
            return
          }

          if (this.action === 'buy') {
            this.goCheckout(saleProduct)
            return
          }

          uni.showToast({
            title: result.tipMessage || '已加入购物车',
            icon: 'success'
          })

          setTimeout(() => {
            uni.navigateBack({
              delta: 2,
              success: () => {
                uni.$emit('refreshProductsList')
              }
            })
          }, 1200)
          return
        }

        uni.showModal({
          title: '提示',
          content: result.tipMessage || '当前情况暂不推荐使用该商品，请及时前往医院就诊。',
          showCancel: false,
          confirmText: '知道了',
          success: () => {
            uni.navigateBack()
          }
        })
      } catch (error) {
        console.error('submitAnswer failed:', error)
        uni.showToast({
          title: error.message || '提交失败，请稍后重试',
          icon: 'none'
        })
      } finally {
        uni.hideLoading()
      }
    }
  }
}
</script>

<style scoped>
.questionnaire-container {
  width: 100%;
  min-height: 100vh;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
}

.content-section {
  padding: 40rpx 30rpx;
  flex: 1;
}

.question-item {
  margin-bottom: 50rpx;
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.question-label {
  font-size: 30rpx;
  font-weight: 500;
  color: #333333;
}

.question-type {
  font-size: 24rpx;
  color: #FFB6C1;
  background-color: #FFF0F5;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.options {
  display: flex;
  flex-direction: column;
}

.options .option-item {
  margin-bottom: 20rpx;
}

.options .option-item:last-child {
  margin-bottom: 0;
}

.option-item {
  display: flex;
  align-items: center;
  padding: 20rpx;
  background-color: #f9f9f9;
  border-radius: 12rpx;
  transition: all 0.3s;
}

.option-item.active {
  background-color: #FFF0F5;
}

.radio {
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid #cccccc;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  transition: all 0.3s;
}

.option-item.active .radio {
  border-color: #FFB6C1;
}

.radio-inner {
  width: 24rpx;
  height: 24rpx;
  background-color: #FFB6C1;
  border-radius: 50%;
}

.option-text {
  font-size: 28rpx;
  color: #333333;
}

.question-count {
  text-align: center;
  font-size: 24rpx;
  color: #999999;
  margin: 40rpx 0;
}

.button-group {
  display: flex;
  margin-top: 40rpx;
}

.button-group .save-btn {
  margin-right: 20rpx;
}

.button-group .submit-btn {
  margin-left: 0;
}

.save-btn,
.submit-btn {
  flex: 1;
  height: 88rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.save-btn {
  background-color: #FFF0F5;
  color: #FFB6C1;
}

.submit-btn {
  background: linear-gradient(135deg, #FFB6C1 0%, #FFC0CB 100%);
  color: #ffffff;
  font-weight: 500;
}

.loading-section,
.empty-section {
  padding: 100rpx 30rpx;
  text-align: center;
  font-size: 28rpx;
  color: #999999;
}
</style>
