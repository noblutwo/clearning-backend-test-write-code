import cors from 'cors';
import { CORS_OPTIONS } from '@/config/constants';
export const corsMiddleware = cors(CORS_OPTIONS);
