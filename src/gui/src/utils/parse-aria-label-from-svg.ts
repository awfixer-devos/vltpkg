export const parseAriaLabelFromSVG = (
  svg: string,
): string | undefined => {
  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(svg, 'image/svg+xml')
  const ariaLabel = svgDoc
    .querySelector('svg')
    ?.getAttribute('aria-label')
  if (!ariaLabel) return undefined
  const match = /[\d.]+\s*[kmb]?/i.exec(ariaLabel)
  return match?.[0].trim()
}
