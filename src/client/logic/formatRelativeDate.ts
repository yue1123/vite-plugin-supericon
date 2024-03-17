export function formatRelativeDate(_date: Date | string) {
  const date = typeof _date === 'string' ? new Date(_date) : _date

  const diff = Date.now() - date.getTime()
  const diffMap = {
    year: '%n%.year ago',
    month: '%n%.month ago',
    day: '%n%.day ago',
    hour: '%n%.hour ago',
    minute: '%n%.minute ago',
    second: '%n%.second ago'
  } as const
  
  let seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  let diffType: keyof typeof diffMap
  let diffValue = 0
  if (months > 0) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  } else {
    if (days > 0) {
      diffType = 'day'
      diffValue = days
    } else {
      if (hours > 0) {
        diffType = 'hour'
        diffValue = hours
      } else {
        if (minutes > 0) {
          diffType = 'minute'
          diffValue = minutes
        } else {
          diffType = 'second'
          diffValue = seconds === 0 ? (seconds = 1) : seconds
        }
      }
    }
  }
  return diffMap[diffType].replace('%n%', String(diffValue))
}
