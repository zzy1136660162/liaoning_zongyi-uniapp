<template>
  <view class="questionnaire-container">
    <view v-if="loading" class="loading-section">
      <text>问卷加载中...</text>
    </view>
    <view v-else-if="questionnaireError" class="empty-section">
      <text>{{ questionnaireError }}</text>
    </view>
    <view class="content-section" v-else-if="questions && questions.length > 0">
      <SingleChoiceQuestion v-for="(question, index) in questions" :key="question.questionId"
        :question="question" :index="index" :disabled="submitting || submissionCompleted"
        @select="selectAnswer(index, $event)" />

      <view class="question-count">- 共 {{ questions.length }} 题 -</view>

      <view class="button-group">
        <button class="save-btn" :disabled="submitting || submissionCompleted" @click="saveDraft">暂存</button>
        <button class="submit-btn" :loading="submitting" :disabled="submitting || submissionCompleted" @click="submitAnswer">提交</button>
      </view>
    </view>
    <view v-else class="empty-section">
      <text>暂无问卷数据</text>
    </view>
  </view>
</template>

<script>
import SingleChoiceQuestion from '@/components/questionnaire/SingleChoiceQuestion.vue'
import {
  UNSUPPORTED_QUESTION_TYPE_MESSAGE,
  normalizeQuestionnaireQuestions,
  hasSupportedQuestionTypes,
  hasRequiredQuestionnaireAnswers,
  buildQuestionnaireAnswers
} from '@/utils/questionnaire-form.js'
import { resolveProductSku, withProductSku } from '@/utils/product-sku.js'
import { getSessionGeneration, isCurrentSession, onSessionChanged } from '@/utils/session.js'
import {
  getQuestionnaireDraftAccountId,
  saveQuestionnaireDraft,
  restoreQuestionnaireDraft,
  clearQuestionnaireDraft
} from '@/utils/questionnaire-draft.js'
import { STORAGE_KEY_CURRENT_CONSULTATION_ID } from '@/utils/storage.js'
import {
  addCartItem,
  buildCartItemKey,
  getCartEntries,
  getCartProductQuantity,
  prepareCheckout,
  resolveCartCompatibility,
  updateCartQuestionnaire
} from '@/utils/cart.js'
import { loadCartProducts } from '@/utils/cart-products.js'
import { getProductDetail } from '@/api/product.js'
import { getQuestionnaireByProductId, submitQuestionnaire } from '@/api/questionnaire.js'
import { logPageView } from '@/api/access-log.js'

export default {
  components: { SingleChoiceQuestion },
  data() {
    return {
      sessionGeneration: getSessionGeneration(),
      draftAccountId: '',
      stopSessionListener: null,
      productId: '',
      skuId: '',
      questionnaireId: null,
      questionnaireError: '',
      questionnaireRequestSeq: 0,
      submissionRequestSeq: 0,
      pageActive: true,
      submitting: false,
      submissionCompleted: false,
      returnTimer: null,
      loading: false,
      questions: [],
      requestedQuantity: 1,
      action: 'cart',
      selectedItems: [],
      productDetail: null
    }
  },
  onLoad(options) {
    this.stopSessionListener = onSessionChanged(() => {
      this.submissionRequestSeq += 1
      clearTimeout(this.returnTimer)
      this.questions = []
      this.questionnaireId = null
      this.questionnaireError = '登录状态已变更，请重新进入页面'
      this.loading = false
      this.submitting = false
    })
    this.productId = options.id || ''
    this.skuId = options.skuId || ''
    this.requestedQuantity = Math.max(1, Number(options.quantity) || 1)
    this.action = options.action || 'cart'
    this.selectedItems = decodeURIComponent(options.selectedItems || '').split(',').filter(Boolean)
    logPageView('PRODUCT_QUESTIONNAIRE', this.productId)
  },
  onShow() {
    if (this.productId && !this.submitting && !this.submissionCompleted) this.loadQuestionnaire()
  },
  onUnload() {
    if ((this.loading || this.submitting) && isCurrentSession(this.sessionGeneration)) uni.hideLoading()
    this.pageActive = false
    this.questionnaireRequestSeq += 1
    this.submissionRequestSeq += 1
    clearTimeout(this.returnTimer)
    this.stopSessionListener?.()
  },
  methods: {
    isQuestionnaireSessionCurrent() {
      return this.pageActive && isCurrentSession(this.sessionGeneration) && this.draftAccountId === getQuestionnaireDraftAccountId()
    },
    isSubmissionCurrent(sequence) {
      return this.isQuestionnaireSessionCurrent() && sequence === this.submissionRequestSeq
    },
    resolveSelectedProduct(detail = this.productDetail) {
      return detail ? withProductSku(detail, resolveProductSku(detail, this.skuId)) : null
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
      if (!this.pageActive || this.submitting || !isCurrentSession(this.sessionGeneration)) return
      const requestSeq = ++this.questionnaireRequestSeq
      this.draftAccountId = getQuestionnaireDraftAccountId()
      if (!this.productId) {
        uni.showToast({
          title: '缺少商品信息',
          icon: 'none'
        })
        return
      }

      try {
        this.loading = true
        this.questionnaireError = ''
        uni.showLoading({ title: '问卷加载中...' })
        const response = await getQuestionnaireByProductId(this.productId)
        if (!this.isQuestionnaireSessionCurrent() || requestSeq !== this.questionnaireRequestSeq) return
        const questionnaire = response
        const previousAnswers = String(this.questionnaireId) === String(questionnaire.questionnaireId)
          ? new Map(this.questions.map(question => [String(question.questionId), question.selectedOptionId]))
          : new Map()

        if (!hasSupportedQuestionTypes(questionnaire.questions || [])) {
          this.questions = []
          this.questionnaireId = null
          this.questionnaireError = UNSUPPORTED_QUESTION_TYPE_MESSAGE
          return
        }
        this.questionnaireId = questionnaire.questionnaireId
        this.questions = normalizeQuestionnaireQuestions(questionnaire.questions || [])
        if (this.draftAccountId) {
          try {
            this.questions = restoreQuestionnaireDraft(this.draftAccountId, this.productId, this.questionnaireId, this.questions)
          } catch (_) {
            uni.showToast({ title: '草稿读取失败，请重新作答', icon: 'none' })
          }
        }
        this.questions.forEach(question => {
          if (!previousAnswers.has(String(question.questionId))) return
          const optionId = previousAnswers.get(String(question.questionId))
          const option = optionId == null ? null : question.options.find(item => String(item.optionId) === String(optionId))
          question.selectedOptionId = option ? option.optionId : null
        })
      } catch (error) {
        if (!this.pageActive || !isCurrentSession(this.sessionGeneration) || requestSeq !== this.questionnaireRequestSeq) return
        this.questions = []
        this.questionnaireId = null
        console.error('event=questionnaire_load result=failed')
        uni.showToast({
          title: error.message || '问卷加载失败',
          icon: 'none'
        })
        this.returnTimer = setTimeout(() => {
          if (!this.isQuestionnaireSessionCurrent() || requestSeq !== this.questionnaireRequestSeq) return
          uni.navigateBack()
        }, 1200)
      } finally {
        if (requestSeq === this.questionnaireRequestSeq) {
          this.loading = false
          if (isCurrentSession(this.sessionGeneration)) uni.hideLoading()
        }
      }
    },
    async goCheckout(detail, sequence) {
      if (!this.isSubmissionCurrent(sequence)) return false
      const saleProduct = this.resolveSelectedProduct(detail)
      const cartKey = this.getCartKey(saleProduct)
      const selectedKeys = this.action === 'checkout' ? this.selectedItems : [cartKey]
      const products = this.action === 'checkout'
        ? await loadCartProducts(selectedKeys, getCartEntries(), getProductDetail)
        : [{ ...saleProduct, id: cartKey, cartKey, productId: saleProduct.productId || saleProduct.id }]
      if (!this.isSubmissionCurrent(sequence)) return false
      const checkout = prepareCheckout(selectedKeys, [{
        id: 'questionnaire_checkout',
        products
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
        uni.navigateTo({
          url: `/pages/order/confirm?selectedItems=${selectedItems}`
        })
        return true
      }

      uni.navigateTo({
        url: `/pages/dispense/apply?selectedItems=${selectedItems}`
      })
      return true
    },
    selectAnswer(questionIndex, optionId) {
      if (!this.isQuestionnaireSessionCurrent() || this.submitting || this.submissionCompleted) return
      this.questions[questionIndex].selectedOptionId = optionId
    },
    saveDraft() {
      if (!this.isQuestionnaireSessionCurrent() || this.submitting || this.submissionCompleted) return
      try {
        if (!this.draftAccountId || this.questionnaireError || this.loading || !this.questions.length) {
          throw new Error('问卷暂存信息不完整')
        }
        saveQuestionnaireDraft(this.draftAccountId, this.productId, this.questionnaireId, this.questions)
        uni.showToast({ title: '已暂存', icon: 'success' })
      } catch (_) {
        uni.showToast({ title: '暂存失败，请稍后重试', icon: 'none' })
      }
    },
    async submitAnswer() {
      if (!this.isQuestionnaireSessionCurrent() || this.submitting || this.submissionCompleted) return
      if (this.questionnaireError || !hasSupportedQuestionTypes(this.questions)) {
        uni.showToast({ title: UNSUPPORTED_QUESTION_TYPE_MESSAGE, icon: 'none' })
        return
      }
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

      if (!hasRequiredQuestionnaireAnswers(this.questions)) {
        uni.showToast({
          title: '请完成所有必答题',
          icon: 'none'
        })
        return
      }

      const answers = buildQuestionnaireAnswers(this.questions)
      if (!answers.length) {
        uni.showToast({ title: '请先选择问卷答案', icon: 'none' })
        return
      }
      const sequence = ++this.submissionRequestSeq
      this.submitting = true
      try {
        uni.showLoading({ title: '提交中...' })

        const response = await submitQuestionnaire({
          productId: this.productId,
          questionnaireId: this.questionnaireId,
          answers
        })
        if (!this.isSubmissionCurrent(sequence)) return
        const result = response
        if (this.draftAccountId) {
          try {
            clearQuestionnaireDraft(this.draftAccountId, this.productId, this.questionnaireId)
          } catch (_) {
            console.warn('event=questionnaire_draft stage=clear result=failed reason=storage_error')
          }
        }

        if (result.isMatch) {
          const detail = await getProductDetail(this.productId)
          if (!this.isSubmissionCurrent(sequence)) return
          if (Number(detail.needQuestionnaire) !== 1 || String(detail.questionnaireId) !== String(this.questionnaireId)) {
            uni.showToast({ title: '商品问卷已更新，请重新进入后填写', icon: 'none' })
            return
          }
          if (!(await this.ensureCartCompatible(detail))) {
            return
          }

          const saleProduct = this.resolveSelectedProduct(detail)
          if (!this.isSubmissionCurrent(sequence)) return
          const submission = {
            questionnairePassed: true,
            questionnaireId: this.questionnaireId,
            answerId: result.answerId
          }
          // 混合结算只补最小商品 ID 的问卷凭据，不改原购物车数量或勾选。
          const success = this.action === 'repair' || this.action === 'checkout'
            ? updateCartQuestionnaire(saleProduct, submission)
            : addCartItem(saleProduct, this.getSelectedQuantity(), submission)
          if (!success) {
            uni.showToast({
              title: this.action === 'repair' || this.action === 'checkout' ? '购物车商品已变化，请返回后重试' : '加入购物车失败',
              icon: 'none'
            })
            return
          }

          if (this.action === 'buy' || this.action === 'checkout') {
            this.submissionCompleted = await this.goCheckout(saleProduct, sequence)
            return
          }
          this.submissionCompleted = true
          uni.showToast({
            title: result.tipMessage || '已加入购物车',
            icon: 'success'
          })

          this.returnTimer = setTimeout(() => {
            if (!this.isSubmissionCurrent(sequence)) return
            uni.navigateBack({
              delta: 2,
              success: () => {
                uni.$emit('refreshProductsList')
              }
            })
          }, 1200)
          return
        }

        this.submissionCompleted = true
        uni.showModal({
          title: '提示',
          content: result.tipMessage || '当前情况暂不推荐使用该商品，请及时前往医院就诊。',
          showCancel: false,
          confirmText: '知道了',
          success: () => {
            if (!this.isSubmissionCurrent(sequence)) return
            uni.navigateBack()
          }
        })
      } catch (error) {
        if (!this.isSubmissionCurrent(sequence)) return
        console.error('event=questionnaire_submit result=failed')
        uni.showToast({
          title: error.message || '提交失败，请稍后重试',
          icon: 'none'
        })
      } finally {
        if (this.isSubmissionCurrent(sequence)) {
          this.submitting = false
          uni.hideLoading()
        }
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
