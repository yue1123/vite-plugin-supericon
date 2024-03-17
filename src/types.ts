export interface IconDataItem {
  id: string
  useId: string
  svg: string
  svgBody: string
  relativePath: string
  absolutePath: string
  lastModified: Date
}
export type IconData = IconDataItem[]

export type UpdatePayload = {
  name: string
  cssPath: string
  iconList: IconData
}
