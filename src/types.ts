export interface IconDataItem {
  id: string
  useId: string
  svg: string
  svgBody: string
  relativePath: string
  absolutePath: string
  lastModified: Date
  /** srcDir 下从外到内的每层目录名；根级图标为 [] */
  tags: string[]
}
export type IconData = IconDataItem[]

export type UpdatePayload = {
  name: string
  cssPath: string
  iconList: IconData
}
