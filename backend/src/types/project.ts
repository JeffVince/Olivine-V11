export interface Project {
  id: string;
  org_id: string;
  title: string;
  type: 'feature_film' | 'tv_series' | 'commercial' | 'documentary' | 'short_film';
  status: 'development' | 'pre_production' | 'production' | 'post_production' | 'completed' | 'cancelled';
  start_date?: Date;
  budget?: number;
  metadata?: {
    genre?: string;
    director?: string;
    producer?: string;
    [key: string]: any;
  };
  created_at?: Date;
  updated_at?: Date;
}
