export function formatXml(xml: string, indent = '  ') {
  let formatted = ''
  let pad = 0

  xml
    .replace(/>\s*</g, '>\n<')
    .split('\n')
    .forEach((node) => {
      if (node.match(/^<\/\w/)) pad--
      formatted += indent.repeat(Math.max(pad, 0)) + node + '\n'
      if (node.match(/^<\w[^>]*[^\/]>.*$/) && !node.includes('</')) pad++
    })
  return formatted.trim()
}
