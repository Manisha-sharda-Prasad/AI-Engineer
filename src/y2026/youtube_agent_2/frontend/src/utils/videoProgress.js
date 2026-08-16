export const isVideoMarkedForDelete = video => video.labels?.includes('mark_for_delete') === true

export const isVideoWatched = video => Boolean(video.watched || video.labels?.includes('watched'))

export function getProgressEligibleVideos(videos = []) {
  return videos.filter(video => !isVideoMarkedForDelete(video))
}

export function getVideoProgress(videos = []) {
  const eligibleVideos = getProgressEligibleVideos(videos)
  const watched = eligibleVideos.filter(isVideoWatched).length
  const total = eligibleVideos.length
  return {
    eligibleVideos,
    watched,
    total,
    progress: total ? Math.round((watched / total) * 100) : 0,
  }
}
