<template>
	<view class="questionnaire-container">
		<view v-if="loading" class="loading-section">
			<text>加载问卷中...</text>
		</view>
		<view class="content-section" v-else-if="questions && questions.length > 0">
			<view 
				class="question-item" 
				v-for="(question, index) in questions" 
				:key="'question-' + index"
			>
				<view class="question-header">
					<text class="question-label">Q{{ index + 1 }}. {{ question.text }}</text>
					<text class="question-type">单选</text>
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
			
			<view class="question-count">- 共{{ questions.length }}题 -</view>
			
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
import { STORAGE_KEY_VERIFIED_PRODUCTS } from '@/utils/storage.js'
import { getCartProductQuantity, saveToCart } from '@/utils/cart.js'
import { getProductDetail } from '@/api/product.js'
import { getQuestionnaireByProductId, submitQuestionnaire } from '@/api/questionnaire.js'
import { logPageView } from '@/api/access-log.js'
import { resolveProductFlow } from '@/utils/product-biz.js'

export default {
	data() {
		return {
			productId: '',
			questionnaireId: null,
			loading: false,
			questions: [] // 从后端获取
		}
	},
	onLoad(options) {
		this.productId = options.id || ''
		if (this.productId) {
			this.loadQuestionnaire()
		}

		// 记录页面访问日志
		logPageView('产品问卷', '用户进入产品问卷页面')
	},
	methods: {
		getSelectedQuantity() {
			return getCartProductQuantity(this.productId, 1)
		},
		async ensureCartCompatible() {
			const currentProduct = await getProductDetail(this.productId)
			if (!currentProduct) {
				return false
			}

			const verifiedProducts = uni.getStorageSync(STORAGE_KEY_VERIFIED_PRODUCTS) || {}
			const existingIds = Object.keys(verifiedProducts)
				.filter(id => verifiedProducts[id] && String(id) !== String(this.productId))
			if (existingIds.length === 0) {
				return true
			}

			const existingProducts = []
			for (const productId of existingIds) {
				try {
					const detail = await getProductDetail(productId)
					if (detail) {
						existingProducts.push(detail)
					}
				} catch (error) {
					console.warn('检查购物车商品失败:', productId, error)
				}
			}

			const flow = resolveProductFlow([currentProduct, ...existingProducts])
			if (!flow.valid) {
				uni.showToast({
					title: flow.message,
					icon: 'none'
				})
				return false
			}
			return true
		},
		// 加载问卷数据
		async loadQuestionnaire() {
			if (!this.productId) {
				uni.showToast({
					title: '商品ID不能为空',
					icon: 'none'
				})
				return
			}
			
			try {
				this.loading = true
				uni.showLoading({ title: '加载问卷...' })
				
				const response = await getQuestionnaireByProductId(this.productId)
				const questionnaire = response.data || response
				
				this.questionnaireId = questionnaire.questionnaireId
				
				// 转换问卷数据格式
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
					answer: null, // 用户选择的选项ID
					selectedOptionId: null // 用于存储选中的选项ID
				}))
				
				console.log('问卷加载成功:', this.questions.length, '题')
			} catch (error) {
				console.error('加载问卷失败:', error)
				uni.showToast({
					title: error.message || '加载问卷失败',
					icon: 'none'
				})
				// 加载失败，返回上一页
				setTimeout(() => {
					uni.navigateBack()
				}, 1500)
			} finally {
				this.loading = false
				uni.hideLoading()
			}
		},
		// 选择答案
		selectAnswer(questionIndex, optionId) {
			this.questions[questionIndex].selectedOptionId = optionId
			// 兼容旧代码
			const option = this.questions[questionIndex].options.find(opt => opt.optionId === optionId)
			if (option) {
				this.questions[questionIndex].answer = option.value
			}
		},
		// 暂存（暂时不实现）
		saveDraft() {
			uni.showToast({
				title: '已暂存',
				icon: 'success'
			})
		},
		// 提交答案
		async submitAnswer() {
			if (!this.productId) {
				uni.showToast({
					title: '缺少商品信息，请重新选择',
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
			
			// 检查是否所有必答题都已作答
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
				
				// 构建提交数据
				const answers = this.questions
					.filter(q => q.selectedOptionId != null)
					.map(q => ({
						questionId: q.questionId,
						optionId: q.selectedOptionId,
						inputValue: null // 填空题暂不支持
					}))
				
				const submitData = {
					productId: this.productId,
					questionnaireId: this.questionnaireId,
					answers: answers
				}
				
				console.log('提交问卷数据:', submitData)
				
				// 调用后端API提交
				const response = await submitQuestionnaire(submitData)
				const result = response.data || response
				
				uni.hideLoading()
				
				console.log('问卷提交结果:', result)
				
				// 根据后端返回的结果处理
				if (result.isMatch) {
					const canAdd = await this.ensureCartCompatible()
					if (!canAdd) {
						return
					}
					// 符合条件，保存到购物车并返回列表页
					saveToCart(this.productId, this.getSelectedQuantity())
					
					uni.showToast({
						title: result.tipMessage || '已添加到购物车',
						icon: 'success'
					})
					
					// 使用更健壮的页面刷新策略
					setTimeout(() => {
						// 返回到列表页（跳过注意页面）
						uni.navigateBack({
							delta: 2,
							success: () => {
								// 返回成功后，确保数据被正确加载
								// 由于页面栈可能已经改变，我们通过全局事件机制通知列表页刷新
								uni.$emit('refreshProductsList')
							}
						})
					}, 1500)
				} else {
					// 不符合条件，弹出提示
					uni.showModal({
						title: '提示',
						content: result.tipMessage || '考虑到您当前的情况，暂时不推荐使用，建议您去医院就诊',
						showCancel: false,
						confirmText: '确定',
						success: (res) => {
							if (res.confirm) {
								// 返回上一页
								uni.navigateBack()
							}
						}
					})
				}
			} catch (error) {
				uni.hideLoading()
				console.error('提交问卷失败:', error)
				uni.showToast({
					title: error.message || '提交失败，请重试',
					icon: 'none'
				})
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
