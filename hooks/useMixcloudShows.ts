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
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'EistApp/3.0.5'
      }
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data: MixcloudApiResponse = await response.json()
    
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response format from Mixcloud API')
    }
    
    const shows = data.data.map((show) => {
      const showUrl = show.url
      // Validate and clean the URL
      let cleanUrl = showUrl
      if (showUrl && !showUrl.startsWith('http')) {
        cleanUrl = `https://www.mixcloud.com${showUrl}`
      }
      
      return {
        id: show.key,
        title: show.name,
        description: show.biog || '',
        playCount: show.play_count || 0,
        createdAt: show.created_time,
        url: cleanUrl,
        tags: show.tags?.map((tag) => tag.name) || [],
        thumbnailUrl: show.pictures?.medium_mobile || show.pictures?.thumbnail || show.pictures?.small || ''
      }
    })

    return {
      shows,
      nextCursor: data.paging?.next
    }
  } catch (error) {

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your internet connection')
      }
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error - please check your internet connection')
      }
    }
    
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
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    retryOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })
} 