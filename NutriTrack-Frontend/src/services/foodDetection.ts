import api from './api';
import type { PredictResponse } from '../types/nutrition';
import { saveDetectionToFirestore, saveMealToFirestore, getUserDetections, deleteDetection } from './firestore';

export const uploadImage = async (formData: FormData) => {
  const res = await api.post<PredictResponse>('/predict', formData, { headers: { 'Content-Type': undefined }, timeout: 60000 });
  return res.data;
};

export { saveDetectionToFirestore, saveMealToFirestore, getUserDetections, deleteDetection };
