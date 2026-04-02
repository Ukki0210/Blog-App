export interface Post {
  id: string
  authorId: string
  title: string
  slug: string
  excerpt?: string
  content: string
  coverImage?: string
  category?: string
  tags?: string[]
  status: 'draft' | 'published' | 'scheduled'
  featured: boolean
  readingTime: number
  views: number
  likes: number
  publishedAt?: string
  scheduledAt?: string
  metaDescription?: string
  createdAt: string
  updatedAt: string
  // joined
  authorName?: string
  authorAvatar?: string
  authorUsername?: string
  commentCount: number
  userLiked: boolean
}

export interface Comment {
  id: string
  postId: string
  authorId: string
  parentId?: string
  content: string
  likes: number
  status: string
  createdAt: string
  updatedAt: string
  authorName?: string
  authorAvatar?: string
  authorUsername?: string
  replies: Comment[]
  userLiked: boolean
}

export interface Profile {
  id: string
  email: string
  username?: string
  fullName?: string
  avatarUrl?: string
  bio?: string
  website?: string
  twitter?: string
  instagram?: string
  role: 'admin' | 'editor' | 'author' | 'reader'
  createdAt: string
  updatedAt: string
}

export interface PostsResponse {
  posts: Post[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type Category = 'culture' | 'food' | 'home' | 'style' | 'travel' | 'wellness'

export const CATEGORIES: { value: string; label: string }[] = [
  { value: 'culture', label: 'Culture' },
  { value: 'food', label: 'Food' },
  { value: 'home', label: 'Home' },
  { value: 'style', label: 'Style' },
  { value: 'travel', label: 'Travel' },
  { value: 'wellness', label: 'Wellness' },
]
