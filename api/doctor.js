import { get } from '@/utils/request.js'

export const getConsultationDoctors = () => get('/api/doctors/consultation', {}, {
  needAuth: false, showLoading: false, silent: true
})
