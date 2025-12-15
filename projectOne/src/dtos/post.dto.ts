// Post DTOs
export interface CreatePostDTO {
  title: string;
  slug: string;
  content: string;
  description?: string;
  status?: string;
}

export interface UpdatePostDTO {
  title?: string;
  slug?: string;
  content?: string;
  description?: string;
  status?: string;
  viewCount?: number;
}

export interface PostResponseDTO {
  id: string;
  title: string;
  slug: string;
  content: string;
  description?: string;
  status: string;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}
