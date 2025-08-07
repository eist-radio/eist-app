import { useInfiniteQuery } from '@tanstack/react-query'

export interface MixcloudShow {
  id: string
  title: string
  description: string
  playCount: number
  createdAt: string
  url: string
  tags: string[]
  thumbnailUrl: string
}

interface MixcloudApiResponse {
  data: Array<{
    key: string
    name: string
    biog?: string
    play_count: number
    created_time: string
    url: string
    tags?: Array<{ name: string }>
    pictures?: {
      medium_mobile?: string
      thumbnail?: string
      small?: string
    }
  }>
  paging?: {
    next?: string
  }
}

const fetchMixcloudShows = async (pageParam?: string): Promise<{
  shows: MixcloudShow[]
  nextCursor?: string
}> => {
  try {
    const url = pageParam || 'https://api.mixcloud.com/eistcork/cloudcasts/'
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data: MixcloudApiResponse = await response.json()
    
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response format from Mixcloud API')
    }
    
    const shows = data.data.map((show) => ({
      id: show.key,
      title: show.name,
      description: show.biog || '',
      playCount: show.play_count || 0,
      createdAt: show.created_time,
      url: show.url,
      tags: show.tags?.map((tag) => tag.name) || [],
      thumbnailUrl: show.pictures?.medium_mobile || show.pictures?.thumbnail || show.pictures?.small || ''
    }))

    return {
      shows,
      nextCursor: data.paging?.next
    }
  } catch (error) {
    console.error('Failed to fetch Mixcloud shows:', error)
    throw error
  }
}

export const useMixcloudShows = () => {
  return useInfiniteQuery({
    queryKey: ['mixcloud-shows'],
    queryFn: ({ pageParam }) => fetchMixcloudShows(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
} 