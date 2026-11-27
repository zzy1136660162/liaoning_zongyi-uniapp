import { get } from '@/utils/request.js'

export const getConsultationDoctors = (productId) => get('/api/doctors/consultation', productId == null ? {} : { productId }, {
  needAuth: false, showLoading: false, silent: true
})

export const getPrescribingDoctors = (productId) => get('/api/doctors/prescribing-consultation', { productId }, {
  showLoading: false, silent: true
})
